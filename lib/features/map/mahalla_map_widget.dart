// lib/features/map/mahalla_map_widget.dart
// Эффективный рендеринг 50+ полигонов GeoJSON через TileOverlay.
//
// Ключевые приёмы без лагов:
//   1. TileOverlay вместо Polygon-объектов Flutter
//   2. Позиция пользователя — отдельный Marker (не перестраивает тайлы)
//   3. LRU-кэш тайлов (не перерисовываем уже отрисованное)
//   4. animateCamera вместо перестройки всей карты

import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../models/mahalla_polygon.dart';

// ─── Tile Provider ─────────────────────────────────────────────────────────────

/// Растеризует GeoJSON-полигоны в 256×256 PNG тайлы.
/// Google Maps кэширует тайлы — не вызывает getTile() для уже отрисованных.
class MahallaTileProvider extends TileProvider {
  final List<MahallaPolygon> polygons;
  final Color fillColor;
  final Color strokeColor;
  final double strokeWidth;

  /// Внутренний LRU-кэш: ключ = "zoom_x_y"
  final Map<String, Tile> _cache = {};
  static const int _maxCacheSize = 200;

  MahallaTileProvider({
    required this.polygons,
    this.fillColor = const Color(0x3300AA44),
    this.strokeColor = const Color(0xFF00AA44),
    this.strokeWidth = 1.5,
  });

  @override
  Future<Tile> getTile(int x, int y, int? zoom) async {
    final key = '${zoom}_${x}_$y';

    if (_cache.containsKey(key)) return _cache[key]!;

    // Очищаем кэш если он переполнен (LRU-like: удаляем первый)
    if (_cache.length >= _maxCacheSize) {
      _cache.remove(_cache.keys.first);
    }

    final tile = await _renderTile(x, y, zoom ?? 15);
    _cache[key] = tile;
    return tile;
  }

  Future<Tile> _renderTile(int tileX, int tileY, int zoom) async {
    const int size = 256;
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);

    final fillPaint = Paint()
      ..color = fillColor
      ..style = PaintingStyle.fill
      ..isAntiAlias = true;

    final strokePaint = Paint()
      ..color = strokeColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..isAntiAlias = true;

    for (final poly in polygons) {
      final path = _buildTilePath(poly.coordinates, tileX, tileY, zoom, size);
      if (path == null) continue; // полигон вне этого тайла — пропускаем

      canvas.drawPath(path, fillPaint);
      canvas.drawPath(path, strokePaint);
    }

    final picture = recorder.endRecording();
    final img = await picture.toImage(size, size);
    final bytes = await img.toByteData(format: ui.ImageByteFormat.png);

    return Tile(size, size, bytes!.buffer.asUint8List());
  }

  /// Конвертирует гео-координаты полигона в пиксели тайла (проекция Меркатора).
  Path? _buildTilePath(
    List<LatLng> coords,
    int tileX,
    int tileY,
    int zoom,
    int tileSize,
  ) {
    final path = Path();
    bool anyVisible = false;
    bool first = true;

    for (final ll in coords) {
      final px = _mercatorToTilePixel(ll, tileX, tileY, zoom, tileSize);

      // Проверяем видимость с небольшим запасом (для краевых полигонов)
      if (px.dx >= -20 &&
          px.dx <= tileSize + 20 &&
          px.dy >= -20 &&
          px.dy <= tileSize + 20) {
        anyVisible = true;
      }

      if (first) {
        path.moveTo(px.dx, px.dy);
        first = false;
      } else {
        path.lineTo(px.dx, px.dy);
      }
    }

    if (!anyVisible) return null; // полигон полностью вне тайла
    path.close();
    return path;
  }

  /// Стандартная проекция Меркатора: LatLng → пиксель внутри тайла.
  Offset _mercatorToTilePixel(
      LatLng ll, int tX, int tY, int zoom, int size) {
    final scale = (1 << zoom).toDouble();
    final worldX = (ll.longitude + 180) / 360 * scale;
    final sinLat = math.sin(ll.latitude * math.pi / 180);
    final worldY =
        (0.5 - math.log((1 + sinLat) / (1 - sinLat)) / (4 * math.pi)) * scale;

    return Offset(
      (worldX - tX) * size,
      (worldY - tY) * size,
    );
  }

  /// Сбросить кэш при смене данных (новые полигоны или смена темы).
  void clearCache() => _cache.clear();
}

// ─── Widget ────────────────────────────────────────────────────────────────────

class MahallaMapWidget extends StatefulWidget {
  final List<MahallaPolygon> polygons;
  final LatLng userPosition;
  final double initialZoom;

  const MahallaMapWidget({
    super.key,
    required this.polygons,
    required this.userPosition,
    this.initialZoom = 15.0,
  });

  @override
  State<MahallaMapWidget> createState() => _MahallaMapWidgetState();
}

class _MahallaMapWidgetState extends State<MahallaMapWidget> {
  GoogleMapController? _controller;
  late MahallaTileProvider _tileProvider;
  Set<TileOverlay> _tileOverlays = {};
  Set<Marker> _markers = {};

  @override
  void initState() {
    super.initState();
    _initTileOverlay();
    _updateUserMarker(widget.userPosition);
  }

  void _initTileOverlay() {
    _tileProvider = MahallaTileProvider(polygons: widget.polygons);
    _tileOverlays = {
      TileOverlay(
        tileOverlayId: const TileOverlayId('mahallas'),
        tileProvider: _tileProvider,
        zIndex: 1,
        transparency: 0.0,
      ),
    };
  }

  void _updateUserMarker(LatLng position) {
    _markers = {
      Marker(
        markerId: const MarkerId('user_position'),
        position: position,
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
        infoWindow: const InfoWindow(title: 'Вы здесь'),
      ),
    };
  }

  @override
  void didUpdateWidget(MahallaMapWidget old) {
    super.didUpdateWidget(old);

    // ── Позиция изменилась: только маркер + камера, без перестройки тайлов ──
    if (old.userPosition != widget.userPosition) {
      setState(() => _updateUserMarker(widget.userPosition));
      _controller?.animateCamera(
        CameraUpdate.newLatLng(widget.userPosition),
      );
    }

    // ── Полигоны изменились: сбрасываем кэш и пересоздаём overlay ───────────
    if (old.polygons != widget.polygons) {
      _tileProvider.clearCache();
      setState(_initTileOverlay);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GoogleMap(
      initialCameraPosition: CameraPosition(
        target: widget.userPosition,
        zoom: widget.initialZoom,
      ),
      tileOverlays: _tileOverlays,  // полигоны — нативный тайловый слой
      markers: _markers,             // позиция — отдельный Marker
      myLocationEnabled: false,      // отключаем нативный синий кружок
      myLocationButtonEnabled: false,
      compassEnabled: true,
      mapType: MapType.normal,
      onMapCreated: (controller) {
        _controller = controller;
        // Минималистичный стиль — убираем лишние POI
        controller.setMapStyle(_minimalMapStyle);
      },
    );
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }
}

// ─── Минималистичный стиль карты ───────────────────────────────────────────────

const String _minimalMapStyle = '''
[
  {"featureType":"poi","stylers":[{"visibility":"off"}]},
  {"featureType":"transit","stylers":[{"visibility":"off"}]},
  {"featureType":"road","elementType":"labels.icon","stylers":[{"visibility":"off"}]},
  {"featureType":"administrative.neighborhood","elementType":"labels","stylers":[{"visibility":"simplified"}]}
]
''';