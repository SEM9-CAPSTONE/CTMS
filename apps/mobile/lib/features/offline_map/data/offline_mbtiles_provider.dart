import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:sqflite/sqflite.dart';

/// Pure Dart TileProvider reading raster tiles directly from an offline MBTiles SQLite file.
/// Conforms strictly to MBTiles 1.3 spec with TMS Y-axis inversion.
class MbTilesTileProvider extends TileProvider {
  MbTilesTileProvider({required this.database});

  final Database database;

  // 1x1 transparent PNG fallback if tile is out-of-bounds
  static final Uint8List _transparent1x1 = Uint8List.fromList([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
    0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
  ]);

  @override
  ImageProvider getImage(TileCoordinates coordinates, TileLayer options) {
    // MBTiles TMS row inversion: tile_row = 2^zoom - 1 - y
    final zoom = coordinates.z;
    final x = coordinates.x;
    final tmsY = (1 << zoom) - 1 - coordinates.y;

    return _MbTilesImageProvider(
      database: database,
      zoom: zoom,
      x: x,
      tmsY: tmsY,
      fallbackBytes: _transparent1x1,
    );
  }
}

class _MbTilesImageProvider extends ImageProvider<_MbTilesImageProvider> {
  const _MbTilesImageProvider({
    required this.database,
    required this.zoom,
    required this.x,
    required this.tmsY,
    required this.fallbackBytes,
  });

  final Database database;
  final int zoom;
  final int x;
  final int tmsY;
  final Uint8List fallbackBytes;

  @override
  Future<_MbTilesImageProvider> obtainKey(ImageConfiguration configuration) {
    return SynchronousFuture<_MbTilesImageProvider>(this);
  }

  @override
  ImageStreamCompleter loadImage(
    _MbTilesImageProvider key,
    ImageDecoderCallback decode,
  ) {
    return MultiFrameImageStreamCompleter(
      codec: _loadAsync(key, decode),
      scale: 1.0,
      debugLabel: 'mbtiles-$zoom-$x-$tmsY',
    );
  }

  Future<ui.Codec> _loadAsync(_MbTilesImageProvider key, ImageDecoderCallback decode) async {
    try {
      final rows = await database.rawQuery(
        'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ? LIMIT 1',
        [zoom, x, tmsY],
      );
      if (rows.isNotEmpty && rows.first['tile_data'] != null) {
        final bytes = rows.first['tile_data'] as Uint8List;
        final buffer = await ui.ImmutableBuffer.fromUint8List(bytes);
        return decode(buffer);
      }
    } catch (_) {}
    final buffer = await ui.ImmutableBuffer.fromUint8List(fallbackBytes);
    return decode(buffer);
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is _MbTilesImageProvider &&
          identical(other.database, database) &&
          other.zoom == zoom &&
          other.x == x &&
          other.tmsY == tmsY;

  @override
  int get hashCode => Object.hash(identityHashCode(database), zoom, x, tmsY);
}
