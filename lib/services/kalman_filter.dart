// lib/services/kalman_filter.dart
// Одномерный фильтр Калмана для сглаживания GPS-координат.
// Устраняет «прыжки» сигнала в плотной застройке Ташкента.
//
// Математика:
//   1. Predict: P' = P + Q
//   2. Gain:    K  = P' / (P' + R)
//   3. Update:  x  = x + K*(z - x)
//   4. Update:  P  = (1-K)*P'

import '../models/gps_point.dart';

/// Одномерный фильтр Калмана (применяется отдельно для lat и lng).
class KalmanFilter {
  /// Q — дисперсия шума процесса.
  /// Низкое значение → больше доверяем модели (позиция меняется медленно).
  final double processNoise;

  /// R — дисперсия шума измерения.
  /// Высокое значение → меньше доверяем GPS-чипу.
  final double measurementNoise;

  double _estimate;        // текущая сглаженная оценка
  double _errorCovariance; // текущая ковариация ошибки

  KalmanFilter({
    required double initialEstimate,
    this.processNoise = 1e-5,
    this.measurementNoise = 1e-2,
  })  : _estimate = initialEstimate,
        _errorCovariance = 1.0;

  /// Принимает сырое измерение, возвращает сглаженное значение.
  double update(double measurement) {
    // Шаг 1: Предсказание — неопределённость растёт
    final predictedCovariance = _errorCovariance + processNoise;

    // Шаг 2: Коэффициент Калмана (0..1): доверяем измерению или модели?
    final kalmanGain = predictedCovariance / (predictedCovariance + measurementNoise);

    // Шаг 3: Обновление оценки
    _estimate = _estimate + kalmanGain * (measurement - _estimate);

    // Шаг 4: Обновление ковариации
    _errorCovariance = (1.0 - kalmanGain) * predictedCovariance;

    return _estimate;
  }

  /// Сброс при восстановлении сигнала после длительного перерыва (>30 сек).
  void reset(double initialEstimate) {
    _estimate = initialEstimate;
    _errorCovariance = 1.0;
  }

  double get currentEstimate => _estimate;
}

/// Пара фильтров Калмана для 2D GPS-координат.
/// Latitude и longitude независимы — обрабатываем раздельно.
class GpsKalmanFilter {
  KalmanFilter? _latFilter;
  KalmanFilter? _lngFilter;
  DateTime? _lastUpdate;

  /// Максимальный перерыв (сек) после которого сбрасываем фильтр.
  static const int _resetThresholdSeconds = 30;

  /// Принимает сырую GPS-точку, возвращает сглаженную.
  GpsPoint update(GpsPoint raw) {
    final now = DateTime.now();

    // Сброс при долгом перерыве (фоновый режим, пауза сессии)
    if (_lastUpdate != null) {
      final gap = now.difference(_lastUpdate!).inSeconds;
      if (gap > _resetThresholdSeconds) {
        _latFilter = null;
        _lngFilter = null;
      }
    }

    // Первая точка — инициализируем фильтры
    if (_latFilter == null) {
      _latFilter = KalmanFilter(
        initialEstimate: raw.latitude,
        // Для координат с высокой точностью — меньше шум измерения
        measurementNoise: raw.accuracy > 20 ? 5e-2 : 1e-2,
      );
      _lngFilter = KalmanFilter(
        initialEstimate: raw.longitude,
        measurementNoise: raw.accuracy > 20 ? 5e-2 : 1e-2,
      );
      _lastUpdate = now;
      return raw; // первую точку возвращаем без изменений
    }

    _lastUpdate = now;

    return raw.copyWith(
      latitude: _latFilter!.update(raw.latitude),
      longitude: _lngFilter!.update(raw.longitude),
    );
  }

  void reset() {
    _latFilter = null;
    _lngFilter = null;
    _lastUpdate = null;
  }
}