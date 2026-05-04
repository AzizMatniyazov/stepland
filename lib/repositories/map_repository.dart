// lib/repositories/map_repository.dart
// Загружает и кэширует GeoJSON-полигоны махаллей.
// Поддерживает загрузку из assets и из сети.

import 'dart:convert';
import 'package:flutter/services.dart';
import '../models/mahalla_polygon.dart';

class MapRepository {
  // Кэш загруженных полигонов
  List<MahallaPolygon>? _cachedPolygons;

  /// Загружает полигоны из assets (assets/geojson/mahallas.geojson).
  /// При повторном вызове возвращает кэш.
  Future<List<MahallaPolygon>> loadPolygons() async {
    if (_cachedPolygons != null) return _cachedPolygons!;

    try {
      final jsonStr = await rootBundle.loadString('assets/geojson/mahallas.geojson');
      final json = jsonDecode(jsonStr) as Map<String, dynamic>;
      final features = (json['features'] as List).cast<Map<String, dynamic>>();

      _cachedPolygons = features
          .where((f) => f['geometry']?['type'] == 'Polygon')
          .map((f) => MahallaPolygon.fromGeoJson(f))
          .toList();

      return _cachedPolygons!;
    } catch (e) {
      // Возвращаем демо-данные если файл не найден
      return _demoPolygons();
    }
  }

  void clearCache() => _cachedPolygons = null;

  /// Демо-полигоны для разработки (махалли Ташкента, упрощённые)
  List<MahallaPolygon> _demoPolygons() {
    return [
      MahallaPolygon(
        id: 'yunusabad_1',
        name: 'Юнусабад МФЙ 1',
        district: 'Yunusabad',
        coordinates: const [
          LatLngLite(41.3600, 69.2800),
          LatLngLite(41.3650, 69.2800),
          LatLngLite(41.3650, 69.2870),
          LatLngLite(41.3600, 69.2870),
          LatLngLite(41.3600, 69.2800),
        ],
        rewardMultiplier: 1.2,
      ),
      MahallaPolygon(
        id: 'chilanzar_5',
        name: 'Чиланзар МФЙ 5',
        district: 'Chilanzar',
        coordinates: const [
          LatLngLite(41.2950, 69.2350),
          LatLngLite(41.3000, 69.2350),
          LatLngLite(41.3000, 69.2430),
          LatLngLite(41.2950, 69.2430),
          LatLngLite(41.2950, 69.2350),
        ],
        rewardMultiplier: 1.0,
      ),
    ];
  }
}

/// Лёгкая замена LatLng для репозитория (без зависимости от google_maps)
class LatLngLite {
  final double latitude;
  final double longitude;
  const LatLngLite(this.latitude, this.longitude);
}