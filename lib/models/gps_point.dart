// lib/models/gps_point.dart
// Модель GPS-точки. Используется во всём приложении.

class GpsPoint {
  final double latitude;
  final double longitude;
  final double accuracy; // точность GPS в метрах
  final DateTime timestamp;

  const GpsPoint({
    required this.latitude,
    required this.longitude,
    required this.accuracy,
    required this.timestamp,
  });

  /// Создаём копию с изменёнными полями (для фильтра Калмана)
  GpsPoint copyWith({
    double? latitude,
    double? longitude,
    double? accuracy,
    DateTime? timestamp,
  }) {
    return GpsPoint(
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      accuracy: accuracy ?? this.accuracy,
      timestamp: timestamp ?? this.timestamp,
    );
  }

  @override
  String toString() =>
      'GpsPoint(lat: $latitude, lng: $longitude, acc: ${accuracy}m)';
}