// lib/models/mahalla_polygon.dart
// Модель полигона махалли. Загружается из GeoJSON.

import 'package:google_maps_flutter/google_maps_flutter.dart';

class MahallaPolygon {
  final String id;
  final String name;
  final String district;      // район города
  final List<LatLng> coordinates;
  final double rewardMultiplier; // множитель награды (1.0 = стандарт)

  const MahallaPolygon({
    required this.id,
    required this.name,
    required this.district,
    required this.coordinates,
    this.rewardMultiplier = 1.0,
  });

  /// Парсинг из GeoJSON Feature
  factory MahallaPolygon.fromGeoJson(Map<String, dynamic> json) {
    final props = json['properties'] as Map<String, dynamic>;
    final geometry = json['geometry'] as Map<String, dynamic>;
    final coords = (geometry['coordinates'][0] as List)
        .map((c) => LatLng(
              (c[1] as num).toDouble(),
              (c[0] as num).toDouble(),
            ))
        .toList();

    return MahallaPolygon(
      id: props['id']?.toString() ?? '',
      name: props['name']?.toString() ?? 'Unnamed',
      district: props['district']?.toString() ?? '',
      coordinates: coords,
      rewardMultiplier: (props['reward_multiplier'] as num?)?.toDouble() ?? 1.0,
    );
  }
}