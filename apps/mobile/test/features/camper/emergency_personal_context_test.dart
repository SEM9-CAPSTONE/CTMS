import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/camper/data/emergency_personal_context.dart';
import 'package:mobile/features/camper/data/emergency_safety_engine.dart';

const account = 'fixture-owner';
const question = 'Tôi chóng mặt';
final stamp = DateTime.utc(2026, 1, 1);

const PersonalRiskRule rule = (
  signalId: 'possible_symptom',
  factCode: 'fixture-match',
  maxAgeSeconds: 60,
  protocolId: 'fixture-protocol',
  reviewStatus: 'APPROVED',
  sourceReferences: ['engineering-fixture-only'],
  reviewer: 'fixture',
  approvedAt: '2026-01-01',
);

class _Source implements EmergencyHealthSource {
  _Source({this.grants = const [true, true], this.facts, this.fail = false});
  final List<bool> grants;
  final EmergencyHealthFacts? facts;
  final bool fail;
  var authorizationChecks = 0;
  var reads = 0;
  Set<String>? requested;

  @override
  Future<bool> authorizedForEmergencyAssessment(String accountId) async =>
      grants[authorizationChecks++];

  @override
  Future<EmergencyHealthFacts?> readAuthorizedFacts(
    String accountId,
    Set<String> requestedCodes,
  ) async {
    reads++;
    requested = requestedCodes;
    if (fail) throw StateError('Private fixture details');
    return facts;
  }
}

EmergencyHealthFacts facts({
  String owner = account,
  DateTime? observedAt,
  Set<String> codes = const {'fixture-match'},
}) => (accountId: owner, observedAt: observedAt ?? stamp, factCodes: codes);

Future<EmergencyAssessment> _evaluate(
  _Source source, [
  String input = question,
]) => personalizeEmergencyAssessment(
  assessEmergency(input),
  input,
  account,
  source,
  rules: [rule],
  now: () => stamp,
  protocolEligible: (id) => id == rule.protocolId,
);

void main() {
  test(
    'offline pure assessment accepts only fresh authorized local matches',
    () async {
      final source = _Source(facts: facts());
      final result = await _evaluate(source);
      expect(result.severity, EmergencySeverity.emergency);
      expect(result.protocolId, rule.protocolId);
      expect(source.requested, {rule.factCode});
      expect(source.authorizationChecks, 2);
      expect(
        (await _evaluate(_Source(facts: facts(codes: {})))).severity,
        EmergencySeverity.warning,
      );
    },
  );

  test(
    'missing, invalid, revoked or failed context preserves general guidance',
    () async {
      for (final source in [
        _Source(),
        _Source(facts: facts(owner: 'other-account')),
        _Source(
          facts: facts(observedAt: stamp.subtract(const Duration(seconds: 61))),
        ),
        _Source(
          facts: facts(observedAt: stamp.add(const Duration(seconds: 1))),
        ),
        _Source(fail: true),
        _Source(grants: [true, false], facts: facts()),
        _Source(grants: [false], facts: facts()),
      ]) {
        expect((await _evaluate(source)).severity, EmergencySeverity.warning);
        if (source.grants.first == false) expect(source.reads, 0);
      }
    },
  );

  test(
    'an immediate emergency or third-party turn never waits for local profile',
    () async {
      for (final message in [
        'Tôi không thở được',
        'Bạn tôi chóng mặt',
        'Tôi chóng mặt, bạn tôi chóng mặt',
      ]) {
        final source = _Source(facts: facts());
        expect(
          (await _evaluate(source, message)).severity,
          assessEmergency(message).severity,
        );
        expect(source.authorizationChecks, 0);
      }
    },
  );

  test('deployed rule bundle leaves optional local access off', () async {
    final source = _Source(facts: facts());
    final result = await personalizeEmergencyAssessment(
      assessEmergency(question),
      question,
      account,
      source,
    );
    expect(result.severity, EmergencySeverity.warning);
    expect(source.authorizationChecks, 0);
  });
}
