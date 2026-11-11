import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mobile/features/route_recovery/data/recovery_api.dart';
import 'package:mobile/features/route_recovery/data/recovery_cache.dart';
import 'package:mobile/features/route_recovery/domain/recovery_state.dart';
import 'recovery_fixtures.dart';

void main() {
  final binding = RecoveryBinding(recoveryContext());
  Map<String, Object?> body() => {
    'tripId': 'trip',
    'requested': {'packageId': 'package-1', 'packageVersion': 1},
    'status': 'AVAILABLE',
    'observedAt': recoveryNow.toIso8601String(),
    'package': {
      'id': 'package-1',
      'version': 1,
      'sha256': 'a' * 64,
      'routeId': 'route',
      'routeFingerprint': 'b' * 64,
    },
    'geometry': {
      'type': 'LineString',
      'coordinates': [
        [0, 0],
        [.01, 0],
      ],
    },
    'conventions': {
      'coordinateSystem': 'EPSG:4326',
      'coordinateOrder': 'longitude,latitude',
      'distanceUnit': 'metre',
      'bearingReference': 'true-north-clockwise',
      'bearingRange': '[0,360)',
    },
  };
  test('valid exact contract is accepted', () {
    expect(
      parseRecoveryConfirmation(binding, body()).evidence,
      RecoveryEvidence.available,
    );
  });
  test(
    'artifact failure is distinct from identity mismatch and generic unavailable',
    () {
      final value = body()
        ..['status'] = 'UNAVAILABLE'
        ..['reason'] = 'ARTIFACT_UNAVAILABLE';
      expect(
        parseRecoveryConfirmation(binding, value).evidence,
        RecoveryEvidence.artifactInvalid,
      );
      value['reason'] = 'ROUTE_UNAVAILABLE';
      expect(
        parseRecoveryConfirmation(binding, value).evidence,
        RecoveryEvidence.unavailable,
      );
      value['status'] = 'MISMATCH';
      value['reason'] = 'PACKAGE_ID_VERSION_MISMATCH';
      expect(
        parseRecoveryConfirmation(binding, value).evidence,
        RecoveryEvidence.mismatch,
      );
    },
  );
  for (final key in [
    'tripId',
    'requested',
    'package',
    'geometry',
    'conventions',
  ]) {
    test('conflicting $key is not treated as navigation approval', () {
      final value = body();
      value[key] = null;
      expect(
        () => parseRecoveryConfirmation(binding, value),
        throwsFormatException,
      );
    });
  }
  test(
    'server geometry cannot replace local package route even with matching metadata',
    () {
      final value = body();
      value['geometry'] = {
        'type': 'LineString',
        'coordinates': [
          [1, 1],
          [2, 2],
        ],
      };
      expect(
        () => parseRecoveryConfirmation(binding, value),
        throwsFormatException,
      );
    },
  );
  test(
    'negative contract statuses do not require geometry or fabricate approval',
    () {
      for (final status in ['STALE', 'MISMATCH', 'UNAVAILABLE']) {
        final value = body();
        value['status'] = status;
        if (status != 'STALE') {
          value['package'] = null;
          value['geometry'] = null;
        }
        expect(
          parseRecoveryConfirmation(binding, value).evidence,
          isNot(RecoveryEvidence.available),
        );
      }
    },
  );
  test('secure cache isolates accounts and exact package versions', () async {
    FlutterSecureStorage.setMockInitialValues({});
    final first = SecureRecoveryCache('one'),
        second = SecureRecoveryCache('two');
    await first.write(binding.key, 'approved');
    expect(await second.read(binding.key), isNull);
    expect(
      await first.read(RecoveryBinding(recoveryContext(version: 2)).key),
      isNull,
    );
    expect(await first.read(binding.key), 'approved');
  });
}
