import 'dart:async';
import 'dart:convert';

import 'emergency_safety_engine.dart';
import 'emergency_safety_policy_data.dart';

/// Reserved for an existing source that can verify the emergency-assessment
/// purpose grant. The current Trip sharing flag does not grant that purpose.
abstract interface class EmergencyHealthSource {
  Future<bool> authorizedForEmergencyAssessment(String accountId);
  // Enforce ownership and the current purpose grant at read time. Offline reads
  // use only an existing secure local source. observedAt dates the oldest fact.
  Future<EmergencyHealthFacts?> readAuthorizedFacts(
    String accountId,
    Set<String> requestedCodes,
  );
}

typedef EmergencyHealthFacts = ({
  String accountId,
  DateTime observedAt,
  Set<String> factCodes,
});

typedef PersonalRiskRule = ({
  String signalId,
  String factCode,
  int maxAgeSeconds,
  String protocolId,
  String reviewStatus,
  List<String> sourceReferences,
  String reviewer,
  String approvedAt,
});

final emergencyPersonalRiskRules = List<PersonalRiskRule>.unmodifiable(
  ((jsonDecode(emergencySafetyPolicyJson) as Map)['personalRiskRules'] as List)
      .map(
        (rule) => (
          signalId: rule['signalId'] as String,
          factCode: rule['factCode'] as String,
          maxAgeSeconds: rule['maxAgeSeconds'] as int,
          protocolId: rule['protocolId'] as String,
          reviewStatus: rule['reviewStatus'] as String,
          sourceReferences: (rule['sourceReferences'] as List).cast<String>(),
          reviewer: rule['reviewer'] as String,
          approvedAt: rule['approvedAt'] as String,
        ),
      ),
);

const _healthContextBudget = Duration(milliseconds: 150);

Future<EmergencyAssessment> personalizeEmergencyAssessment(
  EmergencyAssessment base,
  String question,
  String accountId,
  EmergencyHealthSource source, {
  List<PersonalRiskRule>? rules,
  DateTime Function() now = DateTime.now,
  bool Function(String) protocolEligible = _approvedProtocol,
}) async {
  final activeRules = rules ?? emergencyPersonalRiskRules;
  if (base.severity != EmergencySeverity.warning ||
      base.affectedPerson != AffectedPerson.self ||
      activeRules.isEmpty) {
    return base;
  }
  final signals = personalWarningSignals(question);
  final candidates = activeRules
      .where(
        (rule) =>
            rule.reviewStatus == 'APPROVED' &&
            rule.sourceReferences.isNotEmpty &&
            rule.reviewer.trim().isNotEmpty &&
            DateTime.tryParse(rule.approvedAt) != null &&
            rule.maxAgeSeconds > 0 &&
            signals.contains(rule.signalId) &&
            protocolEligible(rule.protocolId),
      )
      .toList();
  if (candidates.isEmpty) return base;

  var expired = false;
  Future<EmergencyAssessment> read() async {
    if (expired ||
        !await source.authorizedForEmergencyAssessment(accountId) ||
        expired) {
      return base;
    }
    final facts = await source.readAuthorizedFacts(
      accountId,
      candidates.map((rule) => rule.factCode).toSet(),
    );
    if (expired ||
        facts == null ||
        facts.accountId != accountId ||
        !await source.authorizedForEmergencyAssessment(accountId) ||
        expired) {
      return base;
    }
    final age = now().difference(facts.observedAt);
    final match = candidates
        .where(
          (rule) =>
              !age.isNegative &&
              age <= Duration(seconds: rule.maxAgeSeconds) &&
              facts.factCodes.contains(rule.factCode),
        )
        .firstOrNull;
    return match == null
        ? base
        : EmergencyAssessment(
            intent: base.intent,
            severity: EmergencySeverity.emergency,
            completeness: base.completeness,
            affectedPerson: base.affectedPerson,
            temporalContext: base.temporalContext,
            matchedSignalIds: base.matchedSignalIds,
            reasonCodes: base.reasonCodes,
            protocolId: match.protocolId,
            clarificationId: null,
            policyVersion: base.policyVersion,
          );
  }

  try {
    return await read().timeout(
      _healthContextBudget,
      onTimeout: () {
        expired = true;
        return base;
      },
    );
  } catch (_) {
    // A missing provider or failed lookup is never evidence of lower risk.
    return base;
  }
}

bool _approvedProtocol(String id) => approvedEmergencyProtocol(id) != null;
