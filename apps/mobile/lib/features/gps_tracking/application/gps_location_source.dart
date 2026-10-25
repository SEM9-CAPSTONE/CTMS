import 'package:geolocator/geolocator.dart';

import '../domain/gps_tracking_models.dart';

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

  Future<GpsPermissionState> _state(LocationPermission permission) async {
    if (!await Geolocator.isLocationServiceEnabled()) return GpsPermissionState.serviceDisabled;
    return switch (permission) {
      LocationPermission.always || LocationPermission.whileInUse => GpsPermissionState.granted,
      LocationPermission.deniedForever => GpsPermissionState.deniedForever,
      _ => GpsPermissionState.denied,
    };
  }

  @override
  Future<GpsPermissionState> checkPermission() async =>
      _state(await Geolocator.checkPermission());

  @override
  Future<GpsPermissionState> requestPermission() async =>
      _state(await Geolocator.requestPermission());

  @override
  Future<GpsSample> currentSample({required Duration timeLimit}) async {
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
