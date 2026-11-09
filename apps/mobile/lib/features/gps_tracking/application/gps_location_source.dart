import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

import '../domain/gps_tracking_models.dart';
import 'gps_location_web_reader_stub.dart'
    if (dart.library.js_interop) 'gps_location_web_reader.dart'
    if (dart.library.js) 'gps_location_web_reader.dart'
    if (dart.library.html) 'gps_location_web_reader.dart';

enum GpsPermissionState { granted, denied, deniedForever, serviceDisabled }

/// Thin seam over the device location APIs so tracking rules can be tested
/// without a real GPS.
abstract interface class GpsLocationSource {
  Future<GpsPermissionState> checkPermission();
  Future<GpsPermissionState> requestPermission();

  /// Measures the current position; throws when no fix is available in time.
  Future<GpsSample> currentSample({required Duration timeLimit});
}

class GeolocatorLocationSource implements GpsLocationSource {
  const GeolocatorLocationSource();

  /// Toạ độ GPS giả lập dùng cho kiểm thử / demo trên Web hoặc Debug mode
  static double? simulatedLat;
  static double? simulatedLon;

  Future<GpsPermissionState> _state(LocationPermission permission) async {
    if (kIsWeb) return GpsPermissionState.granted;
    if (!await Geolocator.isLocationServiceEnabled()) return GpsPermissionState.serviceDisabled;
    return switch (permission) {
      LocationPermission.always || LocationPermission.whileInUse => GpsPermissionState.granted,
      LocationPermission.deniedForever => GpsPermissionState.deniedForever,
      _ => GpsPermissionState.denied,
    };
  }

  @override
  Future<GpsPermissionState> checkPermission() async {
    if (kIsWeb) return GpsPermissionState.granted;
    return _state(await Geolocator.checkPermission());
  }

  @override
  Future<GpsPermissionState> requestPermission() async {
    if (kIsWeb) return GpsPermissionState.granted;
    return _state(await Geolocator.requestPermission());
  }

  @override
  Future<GpsSample> currentSample({required Duration timeLimit}) async {
    if (kIsWeb) {
      debugPrint('[GPS Source] Web currentSample requested...');
      if (simulatedLat != null && simulatedLon != null) {
        return GpsSample(
          capturedAt: DateTime.now().toUtc(),
          latitude: simulatedLat!,
          longitude: simulatedLon!,
          accuracyMeters: 5.0,
        );
      }
      final browserSample = await readBrowserGeolocation();
      debugPrint('[GPS Source] browserSample returned: $browserSample');
      if (browserSample != null) {
        return browserSample;
      }
      throw TimeoutException('Đang đợi tín hiệu toạ độ từ trình duyệt.');
    }

    final position = await Geolocator.getCurrentPosition(
      locationSettings: LocationSettings(accuracy: LocationAccuracy.high, timeLimit: timeLimit),
    );
    return GpsSample(
      // The platform's own fix time, so a cached position keeps its real age.
      capturedAt: position.timestamp,
      latitude: position.latitude,
      longitude: position.longitude,
      accuracyMeters: position.accuracy,
      altitudeMeters: position.altitude == 0 ? null : position.altitude,
    );
  }
}
