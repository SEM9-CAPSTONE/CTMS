import 'dart:async';
import 'dart:js_interop';
import 'package:flutter/foundation.dart';
import 'package:web/web.dart' as web;

import '../domain/gps_tracking_models.dart';

/// Lưu lại mẫu GPS gần nhất đã nhận thành công từ Chrome Sensors
GpsSample? _lastKnownBrowserSample;
bool _watchStarted = false;

GpsSample _withCurrentTime(GpsSample s) => GpsSample(
      capturedAt: DateTime.now().toUtc(),
      latitude: s.latitude,
      longitude: s.longitude,
      accuracyMeters: s.accuracyMeters,
      altitudeMeters: s.altitudeMeters,
    );

void _ensureWatchStarted() {
  if (_watchStarted) return;
  _watchStarted = true;
  try {
    web.window.navigator.geolocation.watchPosition(
      ((web.GeolocationPosition pos) {
        final lat = pos.coords.latitude.toDouble();
        final lon = pos.coords.longitude.toDouble();
        final acc = pos.coords.accuracy.toDouble();
        debugPrint('[GPS Web Watch] Success: lat=$lat, lon=$lon, acc=$acc');
        _lastKnownBrowserSample = GpsSample(
          capturedAt: DateTime.now().toUtc(),
          latitude: lat,
          longitude: lon,
          accuracyMeters: acc,
        );
      }).toJS,
      ((web.GeolocationPositionError err) {
        // Bỏ qua lỗi watch
      }).toJS,
      web.PositionOptions(enableHighAccuracy: true),
    );
  } catch (e) {
    debugPrint('[GPS Web Watch] Exception: $e');
  }
}

Future<GpsSample?> readBrowserGeolocation() async {
  _ensureWatchStarted();

  // 1. Kiểm tra toạ độ override từ localStorage nếu có
  try {
    final customGps = web.window.localStorage.getItem('ctms_gps');
    if (customGps != null && customGps.isNotEmpty) {
      final parts = customGps.split(',');
      if (parts.length >= 2) {
        final lat = double.tryParse(parts[0].trim());
        final lon = double.tryParse(parts[1].trim());
        if (lat != null && lon != null) {
          final sample = GpsSample(
            capturedAt: DateTime.now().toUtc(),
            latitude: lat,
            longitude: lon,
            accuracyMeters: 5.0,
          );
          _lastKnownBrowserSample = sample;
          return sample;
        }
      }
    }
  } catch (_) {}

  // 2. Nếu đã có mẫu nhận được từ Sensors qua watchPosition trước đó, cập nhật timestamp hiện tại và trả về ngay
  if (_lastKnownBrowserSample != null) {
    return _withCurrentTime(_lastKnownBrowserSample!);
  }

  // 3. Gọi getCurrentPosition và chờ với fallback
  final completer = Completer<GpsSample?>();
  try {
    debugPrint('[GPS Web] Calling navigator.geolocation.getCurrentPosition...');
    web.window.navigator.geolocation.getCurrentPosition(
      ((web.GeolocationPosition pos) {
        final lat = pos.coords.latitude.toDouble();
        final lon = pos.coords.longitude.toDouble();
        final acc = pos.coords.accuracy.toDouble();
        debugPrint('[GPS Web] Success: lat=$lat, lon=$lon, acc=$acc');
        final sample = GpsSample(
          capturedAt: DateTime.now().toUtc(),
          latitude: lat,
          longitude: lon,
          accuracyMeters: acc,
        );
        _lastKnownBrowserSample = sample;
        if (!completer.isCompleted) {
          completer.complete(sample);
        }
      }).toJS,
      ((web.GeolocationPositionError err) {
        debugPrint(
            '[GPS Web] PositionError: code=${err.code}, message=${err.message}');
        // Chờ 500ms vì Chrome Sensors thường gửi Error trước rồi mới kích hoạt callback Success
        Future.delayed(const Duration(milliseconds: 500), () {
          if (!completer.isCompleted) {
            completer.complete(_lastKnownBrowserSample != null
                ? _withCurrentTime(_lastKnownBrowserSample!)
                : null);
          }
        });
      }).toJS,
      web.PositionOptions(
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      ),
    );
  } catch (e, st) {
    debugPrint('[GPS Web] Caught exception: $e\n$st');
    if (!completer.isCompleted) {
      completer.complete(_lastKnownBrowserSample != null
          ? _withCurrentTime(_lastKnownBrowserSample!)
          : null);
    }
  }

  final result = await completer.future.timeout(
    const Duration(milliseconds: 1500),
    onTimeout: () => _lastKnownBrowserSample != null
        ? _withCurrentTime(_lastKnownBrowserSample!)
        : null,
  );

  return result != null
      ? _withCurrentTime(result)
      : (_lastKnownBrowserSample != null
          ? _withCurrentTime(_lastKnownBrowserSample!)
          : null);
}
