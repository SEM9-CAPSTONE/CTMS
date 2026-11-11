import 'dart:convert';
import 'dart:typed_data';

import '../domain/offline_trip.dart';

/// Decodes schema 1 entries inside the integrity verifier's worker isolate.
OfflineTrip decodeOfflineTrip(Map<String, Uint8List> files) {
  Object? decode(String path) => jsonDecode(utf8.decode(files[path]!));

  final manifest = _object(decode('manifest.json'));
  final route = _object(decode('route.geojson'));
  final geometry = _object(route['geometry']);
  final properties = _object(route['properties']);
  final manifestRoute = _object(manifest['route']);
  final routeId = _string(manifestRoute['routeId']);
  if (route['type'] != 'Feature' ||
      geometry['type'] != 'LineString' ||
      properties['routeId'] != routeId ||
      properties['fingerprint'] != _string(manifestRoute['fingerprint'])) {
    throw _invalid;
  }
  final positions = _list(geometry['coordinates']).map(_position).toList();
  if (positions.length < 2 || !positions.any((p) => p != positions.first)) {
    throw _invalid;
  }

  final checkpoints = _list(decode('checkpoints.json')).map((entry) {
    final checkpoint = _object(entry);
    final point = _object(checkpoint['location']);
    if (point['type'] != 'Point' || checkpoint['routeId'] != routeId) {
      throw _invalid;
    }
    return OfflineCheckpoint(
      name: _string(checkpoint['name'], allowEmpty: true),
      type: _string(checkpoint['type']),
      position: _position(point['coordinates']),
      instructions: _string(checkpoint['instructions'], allowEmpty: true),
    );
  });

  final guides = _list(decode('guidance.json')).map(_guide);
  return OfflineTrip(
    route: List.unmodifiable(positions),
    checkpoints: List.unmodifiable(checkpoints),
    guides: List.unmodifiable(guides),
    hazardSources: List.unmodifiable(
      _list(manifest['hazardSourceSummary']).map(_hazardSource),
    ),
  );
}

OfflineGuide _guide(Object? entry) {
  final guide = _object(entry);
  final refs = _list(guide['pageRefs']).map((entry) {
    final ref = _object(entry);
    final page = ref['page'];
    if (page is! int || page < 1) throw _invalid;
    return (page: page, itemRef: _string(ref['itemRef']));
  });
  return OfflineGuide(
    topic: _string(guide['topic']),
    content: _string(guide['content']),
    sourceTitle: _string(guide['sourceTitle']),
    documentVersionId: _string(guide['documentVersionId']),
    attribution: _optionalString(guide['attribution']),
    sourceUrl: _optionalString(guide['sourceUrl']),
    pageRefs: List.unmodifiable(refs),
  );
}

OfflineHazardSource _hazardSource(Object? entry) {
  final source = _object(entry);
  return OfflineHazardSource(
    id: _string(source['sourceId'], allowEmpty: true),
    checkedAt: _date(source['checkedAt']),
    validUntil: _date(source['validUntil']),
    outcome: switch (source['outcome']) {
      'ACTIVE_ALERTS' => OfflineHazardOutcome.activeAlerts,
      'NO_ACTIVE_ALERT' => OfflineHazardOutcome.noActiveAlert,
      'UNKNOWN' => OfflineHazardOutcome.unknown,
      _ => throw _invalid,
    },
  );
}

OfflinePosition _position(Object? value) {
  final pair = _list(value);
  if (pair.length != 2) throw _invalid;
  final [longitude, latitude] = pair;
  if (longitude is! num ||
      !longitude.isFinite ||
      longitude.abs() > 180 ||
      latitude is! num ||
      !latitude.isFinite ||
      latitude.abs() > 90) {
    throw _invalid;
  }
  return (longitude: longitude.toDouble(), latitude: latitude.toDouble());
}

const _invalid = FormatException('Invalid schema 1 offline trip content');

Map<String, Object?> _object(Object? value) =>
    value is Map<String, Object?> ? value : throw _invalid;

List<Object?> _list(Object? value) => value is List ? value : throw _invalid;

String _string(Object? value, {bool allowEmpty = false}) =>
    value is String && (allowEmpty || value.trim().isNotEmpty)
    ? value
    : throw _invalid;

String? _optionalString(Object? value) =>
    value == null ? null : _string(value, allowEmpty: true);

// Optional source feeds can carry missing or invalid timestamps with UNKNOWN.
DateTime? _date(Object? value) =>
    value is String ? DateTime.tryParse(value) : null;
