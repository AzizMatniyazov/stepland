// lib/services/anti_cheat_validator.dart
// Логика античита: анализирует паттерн движения,
// выявляет механические качалки, транспорт, GPS-спуфинг.

import 'dart:math' as math;
import '../models/step_data_packet.dart';

class ValidationResult {
  final bool isHuman;
  final SuspicionReason reason;
  final double confidenceScore; // 0.0 (читер) .. 1.0 (явно человек)

  const ValidationResult({
    required this.isHuman,
    required this.reason,
    required this.confidenceScore,
  });
}

class AntiCheatValidator {
  // ─── Пороги (откалиброваны по реальным данным ходьбы) ──────────────────────

  /// Минимальная дисперсия ускорения для «живого» движения.
  /// Пешеход: 0.5–4.0 | Стоит: 0.05–0.3 | Качалка: <0.05 (слишком ровно).
  static const double _minVarianceThreshold = 0.08;

  /// Максимальная скорость пешехода в м/с.
  /// Быстрая ходьба: ~2.0 | Бег: ~3.0 | Велосипед: ~4.0.
  static const double _maxSpeedMs = 2.5;

  /// Порог точности GPS. Если accuracy > 50 м — сигнал ненадёжен.
  static const double _minGpsAccuracyMeters = 50.0;

  /// Сколько подряд идущих «подозрительных» тиков = блокировка сессии.
  /// Защита от ложных срабатываний (поездка в лифте, быстрый спуск).
  static const int _suspicionStreakForBlock = 5;

  // ─── Состояние ─────────────────────────────────────────────────────────────

  int _suspicionStreak = 0;
  final List<ValidationResult> _history = [];

  // ─── Основной метод ────────────────────────────────────────────────────────

  /// Анализирует один тик движения. Возвращает [ValidationResult].
  ValidationResult validate({
    required double accelVariance,
    required double speedMs,
    required double gpsAccuracy,
  }) {
    // Проверка 1: надёжность GPS-сигнала
    if (gpsAccuracy > _minGpsAccuracyMeters) {
      return _result(
        isHuman: false,
        reason: SuspicionReason.poorGpsSignal,
        score: 0.2,
      );
    }

    final varianceOk = accelVariance > _minVarianceThreshold;
    final speedOk = speedMs < _maxSpeedMs;

    // Проверка 2: дисперсия + скорость
    if (varianceOk && speedOk) {
      return _result(
        isHuman: true,
        reason: SuspicionReason.none,
        score: _computeScore(accelVariance, speedMs),
      );
    }

    if (!varianceOk && !speedOk) {
      return _result(
        isHuman: false,
        reason: SuspicionReason.combined,
        score: 0.0,
      );
    }

    if (!varianceOk) {
      return _result(
        isHuman: false,
        reason: SuspicionReason.lowVariance,
        score: 0.1,
      );
    }

    return _result(
      isHuman: false,
      reason: SuspicionReason.highSpeed,
      score: 0.15,
    );
  }

  /// Shortcut для использования в MovementService.
  bool isHumanMovement({
    required double accelVariance,
    required double speedMs,
    double gpsAccuracy = 10.0,
  }) =>
      validate(
        accelVariance: accelVariance,
        speedMs: speedMs,
        gpsAccuracy: gpsAccuracy,
      ).isHuman;

  /// Нужно ли заблокировать сессию (N подряд подозрительных тиков).
  bool get shouldBlockSession => _suspicionStreak >= _suspicionStreakForBlock;

  /// Текущее количество подозрительных тиков подряд.
  int get suspicionStreak => _suspicionStreak;

  /// Сброс счётчика (новая сессия).
  void reset() {
    _suspicionStreak = 0;
    _history.clear();
  }

  // ─── Вспомогательные методы ────────────────────────────────────────────────

  ValidationResult _result({
    required bool isHuman,
    required SuspicionReason reason,
    required double score,
  }) {
    final result = ValidationResult(
      isHuman: isHuman,
      reason: reason,
      confidenceScore: score.clamp(0.0, 1.0),
    );

    // Обновляем счётчик серии
    if (!isHuman) {
      _suspicionStreak++;
    } else {
      // Постепенный сброс: -1 за каждый «честный» тик
      _suspicionStreak = math.max(0, _suspicionStreak - 1);
    }

    _history.add(result);
    if (_history.length > 60) _history.removeAt(0); // скользящее окно 1 мин

    return result;
  }

  /// Нормированный «human score».
  /// Дисперсия важнее скорости (вес 65%/35%).
  double _computeScore(double variance, double speed) {
    // Дисперсия: оптимум ~1.0–3.0, клипуем сверху
    final varianceScore = (math.min(variance, 3.0) / 3.0).clamp(0.0, 1.0);

    // Скорость: чем ближе к 0 — тем лучше (спокойная ходьба)
    final speedScore = (1.0 - speed / _maxSpeedMs).clamp(0.0, 1.0);

    return varianceScore * 0.65 + speedScore * 0.35;
  }

  /// История последних результатов (для дебага / логирования).
  List<ValidationResult> get history => List.unmodifiable(_history);
}