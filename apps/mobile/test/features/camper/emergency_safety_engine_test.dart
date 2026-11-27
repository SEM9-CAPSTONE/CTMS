import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/camper/data/emergency_safety_engine.dart';
import 'package:mobile/features/camper/data/emergency_safety_policy_data.dart';
import 'package:mobile/features/camper/data/emergency_sos_status.dart';
import 'package:mobile/features/sos/domain/sos_alert.dart';

void main() {
  final fixtures =
      jsonDecode(
            File(
              '../../services/api/src/modules/ai-answers/emergency-safety.engine-fixtures.json',
            ).readAsStringSync(),
          )
          as Map<String, dynamic>;

  for (final value in fixtures['scenarios'] as List) {
    final scenario = value as Map<String, dynamic>;
    test('engineering-only parity: ${scenario['name']}', () {
      EmergencyAssessment? previous;
      for (final value in scenario['turns'] as List) {
        final turn = value as Map<String, dynamic>;
        final assessment = assessEmergency(
          turn['question'] as String,
          previous: previous,
        );
        expect({
          'intent': assessment.intent.code,
          'severity': assessment.severity.code,
          'completeness': assessment.completeness.code,
          'affectedPerson': assessment.affectedPerson.code,
          'temporalContext': assessment.temporalContext.code,
          'matchedSignalIds': assessment.matchedSignalIds,
          'reasonCodes': assessment.reasonCodes,
          'protocolId': assessment.protocolId,
          'clarificationId': assessment.clarificationId,
          'policyVersion': assessment.policyVersion,
        }, turn['expected']);
        previous = assessment;
      }
    });
  }

  test('pending protocols never supply instructions or release approval', () {
    expect(emergencySafetyReleaseApproved, isFalse);
    expect(approvedEmergencyProtocol('emergency-essential'), isNull);
    expect(emergencySafetyFallback(), isNull);
  });

  test('withholds unsupported SOS, safety and live-condition claims', () {
    for (final text in [
      'Cứu hộ đang đến.',
      'Your coordinates are 12, 30.',
      'Bạn hoàn toàn an toàn.',
      'The trail is currently open.',
    ]) {
      expect(blocksEmergencyConflictingOutput(text), isTrue);
    }
  });

  test('does not conflate queued, accepted and acknowledged SOS states', () {
    final time = DateTime.utc(2026, 10, 1);
    final pending = LocalSosAlert(
      id: 'same-sos',
      tripId: 'trip',
      senderId: 'camper',
      emergencyType: 'medical',
      eventTime: time,
    );
    SosAlert server(String state) => SosAlert(
      id: 'same-sos',
      tripId: 'trip',
      senderId: 'camper',
      emergencyType: 'medical',
      status: state,
      eventTime: time,
    );
    expect(emergencySosStatus([pending], []), contains('chờ gửi'));
    expect(
      emergencySosStatus([pending], [server('active')]),
      contains('chưa xác nhận'),
    );
    expect(
      emergencySosStatus([pending], [server('acknowledged')]),
      'Chủ chuyến đã xác nhận SOS.',
    );
    expect(
      emergencySosStatus([pending], [server('cancelled')]),
      'SOS đã được hủy.',
    );
    expect(
      emergencySosStatus([pending], [server('closed')]),
      'SOS đã được đóng.',
    );
    expect(
      emergencySosStatus([
        pending.delivery(syncState: SosSyncState.failed),
      ], []),
      'Chưa gửi được SOS.',
    );
  });
}
