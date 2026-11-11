import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/offline_map/domain/offline_map_models.dart';
import 'package:mobile/features/route_recovery/domain/recovery_state.dart';
import 'recovery_fixtures.dart';

void main() {
  test(
    'all authoritative negative states suppress guidance even with good GPS',
    () {
      final states = {
        RecoveryEvidence.checking: RecoveryDisplay.loading,
        RecoveryEvidence.stale: RecoveryDisplay.staleRoute,
        RecoveryEvidence.mismatch: RecoveryDisplay.mismatch,
        RecoveryEvidence.unavailable: RecoveryDisplay.unavailable,
        RecoveryEvidence.restricted: RecoveryDisplay.restricted,
        RecoveryEvidence.error: RecoveryDisplay.serverError,
        RecoveryEvidence.unverified: RecoveryDisplay.unverified,
      };
      for (final entry in states.entries) {
        expect(
          decideRecovery(recoveryInput(), entry.key, recoveryNow),
          entry.value,
        );
      }
    },
  );
  test('verified online/offline decisions remain visibly different', () {
    expect(
      decideRecovery(recoveryInput(), RecoveryEvidence.available, recoveryNow),
      RecoveryDisplay.ready,
    );
    expect(
      decideRecovery(recoveryInput(), RecoveryEvidence.offline, recoveryNow),
      RecoveryDisplay.offlineReady,
    );
  });
  test(
    'GPS accuracy and age use shared thresholds including boundary values',
    () {
      expect(
        decideRecovery(
          recoveryInput(accuracy: 20),
          RecoveryEvidence.available,
          recoveryNow,
        ),
        RecoveryDisplay.ready,
      );
      expect(
        decideRecovery(
          recoveryInput(accuracy: 20.1),
          RecoveryEvidence.available,
          recoveryNow,
        ),
        RecoveryDisplay.gpsPoor,
      );
      expect(
        decideRecovery(
          recoveryInput(at: recoveryNow.subtract(const Duration(seconds: 30))),
          RecoveryEvidence.available,
          recoveryNow,
        ),
        RecoveryDisplay.ready,
      );
      expect(
        decideRecovery(
          recoveryInput(at: recoveryNow.subtract(const Duration(seconds: 31))),
          RecoveryEvidence.available,
          recoveryNow,
        ),
        RecoveryDisplay.gpsStale,
      );
      expect(
        decideRecovery(
          recoveryInput(at: recoveryNow.add(const Duration(seconds: 6))),
          RecoveryEvidence.available,
          recoveryNow,
        ),
        RecoveryDisplay.gpsStale,
      );
      expect(
        decideRecovery(
          recoveryInput(accuracy: double.nan),
          RecoveryEvidence.available,
          recoveryNow,
        ),
        RecoveryDisplay.gpsMissing,
      );
    },
  );
  test(
    'no guidance from missing package, missing GPS, unrelated detector or on-route state',
    () {
      expect(
        decideRecovery(
          const RecoveryInput(
            OfflineMapState(
              tripId: 'trip',
              packageStatus: OfflineMapPackageStatus.packageMissing,
            ),
          ),
          RecoveryEvidence.available,
          recoveryNow,
        ),
        RecoveryDisplay.packageMissing,
      );
      expect(
        decideRecovery(
          RecoveryInput(
            OfflineMapState(
              tripId: 'trip',
              packageStatus: OfflineMapPackageStatus.ready,
              context: recoveryContext(),
            ),
          ),
          RecoveryEvidence.available,
          recoveryNow,
        ),
        RecoveryDisplay.gpsMissing,
      );
      expect(
        decideRecovery(
          recoveryInput(matches: false),
          RecoveryEvidence.available,
          recoveryNow,
        ),
        RecoveryDisplay.contextMismatch,
      );
      expect(
        decideRecovery(
          recoveryInput(offRoute: false),
          RecoveryEvidence.available,
          recoveryNow,
        ),
        RecoveryDisplay.notOffRoute,
      );
    },
  );
}
