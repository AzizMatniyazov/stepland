// lib/services/movement_service.dart
// Ядро трекинга — агрегирует данные всех сенсоров в единый стрим пакетов.
// Запускается через flutter_background_service в отдельном Isolate.

import 'dart:async';
import 'dart:math' as math;

import 'package:geolocator/geolocator.dart';
import 'package:pedometer/pedometer.dart';
import 'package:rxdart/rxdart.dart';
import 'package:sensors_plus/sensors_plus.dart';

import '../models/gps_point.dart';
import '../models/step_data_packet.dart';
import 'anti_cheat_validator.dart';
import 'kalman_filter.dart';

class MovementService {
  // ─── Конфигурация ──────────────────────────────────────────────────────────

  /// Размер окна для расчёта дисперсии ускорения (в тиках ~50 мс)
  static const int _accelWindowSize = 50; // ~2.5 секунды

  /// Настройки GPS: высокая точность, минимальный фильтр расстояния
  static const LocationSettings _locationSettings = LocationSettings(
    accuracy: LocationAccuracy.high,
    distanceFilter: 2, // обновлять при смещении ≥ 2 м
  );

  // ─── Зависимости ───────────────────────────────────────────────────────────

  final GpsKalmanFilter _kalman = GpsKalmanFilter();
  final AntiCheatValidator _antiCheat = AntiCheatValidator();

  // ─── Состояние ─────────────────────────────────────────────────────────────

  /// Буфер магнитуд ускорения для скользящего окна
  final List<double> _accelBuffer = [];

  /// Последняя известная позиция (нужна при задержке GPS-стрима)
  GpsPoint? _lastPosition;

  /// Шаги на момент начала сессии (для вычисления delta)
  int _sessionBaseSteps = 0;

  StreamSubscription? _subscription;

  // ─── Публичный интерфейс ───────────────────────────────────────────────────

  /// Главный стрим пакетов — на него подписывается BLoC.
  /// asBroadcastStream() позволяет иметь несколько подписчиков.
  late final Stream<StepDataPacket> dataStream;

  /// Прямой доступ к валидатору для BLoC (проверка shouldBlockSession)
  AntiCheatValidator get antiCheat => _antiCheat;

  void start() {
    // ── 1. Шагомер ──────────────────────────────────────────────────────────
    // Нативный pedometer: iOS CMPedometer / Android StepCounter sensor
    final stepStream = Pedometer.stepCountStream
        .map((e) => e.steps)
        .distinct() // пропускаем дубли при одинаковом значении
        .handleError((e) => 0); // не роняем стрим при ошибке сенсора

    // ── 2. Линейное ускорение без гравитации ────────────────────────────────
    // UserAccelerometer — именно то, что нужно для паттерна шага
    final userAccelStream = userAccelerometerEventStream(
      samplingPeriod: SensorInterval.normalInterval, // ~50 мс
    ).handleError((_) {});

    // ── 3. GPS-поток → Kalman → сглаженная позиция ─────────────────────────
    final gpsStream = Geolocator.getPositionStream(
      locationSettings: _locationSettings,
    ).map(_positionToGpsPoint).map((raw) {
      final filtered = _kalman.update(raw);
      _lastPosition = filtered;
      return filtered;
    }).handleError((_) {});

    // ── 4. Агрегация акселерометра в 1-секундные тики ───────────────────────
    // bufferTime — rxdart: собирает события за период в список
    final accelTickStream = userAccelStream
        .bufferTime(const Duration(seconds: 1))
        .map(_computeVarianceFromBuffer);

    // ── 5. CombineLatest3: пакет формируется при обновлении любого источника ─
    dataStream = Rx.combineLatest3<int, double, GpsPoint, StepDataPacket>(
      stepStream,
      accelTickStream,
      gpsStream,
      (steps, variance, position) => _buildPacket(
        rawSteps: steps,
        variance: variance,
        position: position,
      ),
    ).asBroadcastStream();
  }

  void dispose() {
    _subscription?.cancel();
    _kalman.reset();
    _antiCheat.reset();
    _accelBuffer.clear();
  }

  // ─── Внутренние методы ─────────────────────────────────────────────────────

  /// Собирает StepDataPacket из сырых данных и прогоняет через античит.
  StepDataPacket _buildPacket({
    required int rawSteps,
    required double variance,
    required GpsPoint position,
  }) {
    // Скорость берём из GPS (м/с). При плохом сигнале ставим 0.
    final speed = position.accuracy < 30.0
        ? _estimateSpeed(position)
        : 0.0;

    final validationResult = _antiCheat.validate(
      accelVariance: variance,
      speedMs: speed,
      gpsAccuracy: position.accuracy,
    );

    return StepDataPacket(
      stepCount: rawSteps - _sessionBaseSteps,
      position: position,
      accelVariance: variance,
      speed: speed,
      isSuspicious: !validationResult.isHuman,
      reason: validationResult.reason,
      confidenceScore: validationResult.confidenceScore,
      timestamp: DateTime.now(),
    );
  }

  /// Вычисляет дисперсию магнитуд ускорения за буфер событий.
  /// Дисперсия < порога = слишком равномерное движение = качалка.
  double _computeVarianceFromBuffer(List<UserAccelerometerEvent> events) {
    if (events.isEmpty) return 0.0;

    // Магнитуда вектора ускорения: √(x²+y²+z²)
    final magnitudes = events
        .map((e) => math.sqrt(e.x * e.x + e.y * e.y + e.z * e.z))
        .toList();

    // Добавляем в скользящий буфер
    _accelBuffer.addAll(magnitudes);
    if (_accelBuffer.length > _accelWindowSize * 50) {
      _accelBuffer.removeRange(0, magnitudes.length);
    }

    // Дисперсия = E[(x - μ)²]
    final mean = magnitudes.reduce((a, b) => a + b) / magnitudes.length;
    final variance = magnitudes
            .map((m) => (m - mean) * (m - mean))
            .reduce((a, b) => a + b) /
        magnitudes.length;

    return variance;
  }

  /// Оценивает скорость по двум последним GPS-точкам.
  /// Используется вместо Position.speed (ненадёжен на некоторых Android).
  GpsPoint? _prevPosition;
  double _estimateSpeed(GpsPoint current) {
    if (_prevPosition == null) {
      _prevPosition = current;
      return 0.0;
    }

    final distanceM = Geolocator.distanceBetween(
      _prevPosition!.latitude,
      _prevPosition!.longitude,
      current.latitude,
      current.longitude,
    );

    final timeDeltaS = current.timestamp
        .difference(_prevPosition!.timestamp)
        .inMilliseconds /
        1000.0;

    _prevPosition = current;

    if (timeDeltaS <= 0) return 0.0;
    return distanceM / timeDeltaS; // м/с
  }

  GpsPoint _positionToGpsPoint(Position p) => GpsPoint(
        latitude: p.latitude,
        longitude: p.longitude,
        accuracy: p.accuracy,
        timestamp: p.timestamp,
      );
}