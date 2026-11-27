import 'dart:convert';

import 'emergency_safety_policy_data.dart';

enum EmergencyIntent {
  knowledgeQuery('KNOWLEDGE_QUERY'),
  preventionQuery('PREVENTION_QUERY'),
  activeIncident('ACTIVE_INCIDENT'),
  thirdPartyIncident('THIRD_PARTY_INCIDENT'),
  emergencyRequest('EMERGENCY_REQUEST'),
  uncertainIntent('UNCERTAIN_INTENT');

  const EmergencyIntent(this.code);
  final String code;
}

enum EmergencySeverity {
  normal('NORMAL'),
  warning('WARNING'),
  emergency('EMERGENCY');

  const EmergencySeverity(this.code);
  final String code;
}

enum AssessmentCompleteness {
  sufficient('SUFFICIENT'),
  incomplete('INCOMPLETE'),
  ambiguous('AMBIGUOUS');

  const AssessmentCompleteness(this.code);
  final String code;
}

enum AffectedPerson {
  self('SELF'),
  otherPerson('OTHER_PERSON'),
  unknown('UNKNOWN');

  const AffectedPerson(this.code);
  final String code;
}

enum TemporalContext {
  current('CURRENT'),
  past('PAST'),
  hypothetical('HYPOTHETICAL'),
  unknown('UNKNOWN');

  const TemporalContext(this.code);
  final String code;
}

class EmergencyAssessment {
  const EmergencyAssessment({
    required this.intent,
    required this.severity,
    required this.completeness,
    required this.affectedPerson,
    required this.temporalContext,
    required this.matchedSignalIds,
    required this.reasonCodes,
    required this.protocolId,
    required this.clarificationId,
    required this.policyVersion,
  });

  final EmergencyIntent intent;
  final EmergencySeverity severity;
  final AssessmentCompleteness completeness;
  final AffectedPerson affectedPerson;
  final TemporalContext temporalContext;
  final List<String> matchedSignalIds;
  final List<String> reasonCodes;
  final String? protocolId;
  final String? clarificationId;
  final String policyVersion;

  bool get requiresSafetyResponse => severity != EmergencySeverity.normal;
}

class EmergencyProtocol {
  const EmergencyProtocol({
    required this.id,
    required this.version,
    required this.title,
    required this.guidance,
    required this.warnings,
  });

  final String id;
  final int version;
  final String title;
  final List<String> guidance;
  final List<String> warnings;
}

const emergencySafetyEnabled =
    !bool.fromEnvironment('dart.vm.product') || emergencySafetyReleaseApproved;
final _policy = jsonDecode(emergencySafetyPolicyJson) as Map<String, dynamic>;
final _unicode = (jsonDecode(emergencySafetyUnicodeJson) as Map)
    .cast<String, String>();
final _routes = (_policy['routes'] as Map).cast<String, String>();
final _word = RegExp(r'[a-z0-9đ\u0300-\u036f]+', unicode: true);
final _markedWord = RegExp(r'([a-zđ])([\u0300-\u036f]+)', unicode: true);
final _marks = RegExp(r'[\u0300-\u036f]', unicode: true);
final _punctuation = RegExp(r'[.!?;,\n。！？；，]+', unicode: true);

typedef _Match = ({int start, int end});
typedef _Phrase = ({List<String> exact, List<String> plain});
typedef _Signal = ({
  String id,
  String level,
  bool implicit,
  List<_Phrase> phrases,
});
typedef _Finding = ({
  EmergencySeverity severity,
  EmergencyIntent intent,
  AffectedPerson person,
  TemporalContext time,
  List<String> signalIds,
  String reason,
});

List<String> _tokens(String text) {
  final normalized = text.runes
      .map((rune) {
        final char = String.fromCharCode(rune);
        return _unicode[char] ?? char;
      })
      .join()
      .toLowerCase();
  return _word.allMatches(normalized).map((match) {
    return match[0]!.replaceAllMapped(_markedWord, (part) {
      final marks = part[2]!.split('')..sort();
      return part[1]! + marks.join();
    });
  }).toList();
}

List<_Phrase> _compile(List<dynamic> expressions) =>
    expressions.cast<String>().map((expression) {
      final exact = _tokens(expression);
      return (
        exact: exact,
        plain: exact
            .map((word) => word.replaceAll(_marks, '').replaceAll('đ', 'd'))
            .toList(),
      );
    }).toList();

final _patterns = (_policy['patterns'] as Map<String, dynamic>).map(
  (name, expressions) => MapEntry(name, _compile(expressions as List)),
);
final List<_Signal> _signals = (_policy['signals'] as List).map((value) {
  final signal = value as Map<String, dynamic>;
  return (
    id: signal['id'] as String,
    level: signal['level'] as String,
    implicit: signal['implicit'] as bool,
    phrases: _compile(signal['expressions'] as List),
  );
}).toList();

bool _matchesAt(List<String> words, _Phrase phrase, int at) {
  if (at < 0 || at + phrase.exact.length > words.length) return false;
  for (var index = 0; index < phrase.exact.length; index++) {
    final word = words[at + index];
    if (word != phrase.exact[index] && word != phrase.plain[index]) {
      return false;
    }
  }
  return true;
}

Iterable<_Match> _find(List<String> words, List<_Phrase> phrases) sync* {
  for (var at = 0; at < words.length; at++) {
    for (final phrase in phrases) {
      if (_matchesAt(words, phrase, at)) {
        yield (start: at, end: at + phrase.exact.length);
      }
    }
  }
}

bool _has(List<String> words, String pattern) =>
    _find(words, _patterns[pattern]!).isNotEmpty;

Iterable<List<String>> _clauses(String question) sync* {
  for (final part in question.split(_punctuation)) {
    final words = _tokens(part);
    var from = 0;
    for (var at = 0; at < words.length; at++) {
      final boundary = _patterns['clauseBreak']!
          .where((phrase) => _matchesAt(words, phrase, at))
          .firstOrNull;
      if (boundary == null) continue;
      if (at > from) yield words.sublist(from, at);
      from = at + 1;
      at += boundary.exact.length - 1;
    }
    if (words.length > from) yield words.sublist(from);
  }
}

bool _positive(List<String> words, _Match match) {
  final before = words.take(match.start).toList();
  final after = words.skip(match.end).toList();
  return !_patterns['negation']!.any(
        (phrase) =>
            _matchesAt(before, phrase, before.length - phrase.exact.length),
      ) &&
      !_patterns['postNegation']!.any((phrase) => _matchesAt(after, phrase, 0));
}

_Finding _evaluate(List<String> words) {
  final person = _has(words, 'other')
      ? AffectedPerson.otherPerson
      : _has(words, 'self')
      ? AffectedPerson.self
      : AffectedPerson.unknown;
  final prevention = _has(words, 'prevention');
  final knowledge = _has(words, 'knowledge');
  final hypothetical = _has(words, 'hypothetical');
  final past = _has(words, 'past');
  final current = _has(words, 'current');
  final time = hypothetical
      ? TemporalContext.hypothetical
      : past && !current
      ? TemporalContext.past
      : current
      ? TemporalContext.current
      : TemporalContext.unknown;
  final rescue = _find(
    words,
    _patterns['rescue']!,
  ).any((match) => _positive(words, match));
  final possible = _find(
    words,
    _patterns['possibleIncident']!,
  ).where((match) => _positive(words, match)).toList();
  final reported = [
    for (final signal in _signals)
      (
        signal: signal,
        matches: _find(
          words,
          signal.phrases,
        ).where((match) => _positive(words, match)).toList(),
      ),
  ].where((entry) => entry.matches.isNotEmpty).toList();
  final present = reported.map((entry) => entry.signal).toList();
  final groundedIncident =
      (person != AffectedPerson.unknown || current) &&
      !hypothetical &&
      !(past && !current);
  final eligibleKnowledge = prevention || knowledge || hypothetical;
  final incidents = [...possible, ...reported.expand((entry) => entry.matches)];
  final learning = _find(words, [
    ..._patterns['knowledge']!,
    ..._patterns['prevention']!,
  ]);
  final hasPersonalReport =
      groundedIncident &&
      incidents.isNotEmpty &&
      (!eligibleKnowledge ||
          current &&
              (!prevention ||
                  incidents.any(
                    (match) => learning.every((cue) => match.start < cue.start),
                  )));
  final live =
      !hypothetical &&
      !(past && !current) &&
      (!eligibleKnowledge || hasPersonalReport);
  final serious =
      live &&
      present.any(
        (signal) =>
            signal.level == EmergencySeverity.emergency.code &&
            (hasPersonalReport || signal.implicit),
      );
  final severity = live && (rescue || serious)
      ? EmergencySeverity.emergency
      : live && (present.isNotEmpty || possible.isNotEmpty)
      ? EmergencySeverity.warning
      : EmergencySeverity.normal;
  final intent = severity == EmergencySeverity.emergency && rescue
      ? EmergencyIntent.emergencyRequest
      : severity != EmergencySeverity.normal &&
            person == AffectedPerson.otherPerson
      ? EmergencyIntent.thirdPartyIncident
      : severity != EmergencySeverity.normal && (groundedIncident || serious)
      ? EmergencyIntent.activeIncident
      : prevention
      ? EmergencyIntent.preventionQuery
      : knowledge || hypothetical
      ? EmergencyIntent.knowledgeQuery
      : EmergencyIntent.uncertainIntent;
  return (
    severity: severity,
    intent: intent,
    person: person,
    time:
        severity == EmergencySeverity.emergency ||
            (severity == EmergencySeverity.warning && groundedIncident)
        ? TemporalContext.current
        : time,
    signalIds: severity == EmergencySeverity.normal
        ? []
        : present.map((signal) => signal.id).toList(),
    reason: severity == EmergencySeverity.emergency
        ? rescue
              ? 'RESCUE_REQUEST'
              : 'SERIOUS_SIGNAL'
        : severity == EmergencySeverity.warning
        ? 'POSSIBLE_INCIDENT'
        : 'STANDARD_FLOW',
  );
}

EmergencyAssessment assessEmergency(
  String question, {
  EmergencyAssessment? previous,
}) {
  final findings = _clauses(question).map(_evaluate).toList();
  _Finding base = (
    severity: EmergencySeverity.normal,
    intent: EmergencyIntent.uncertainIntent,
    person: AffectedPerson.unknown,
    time: TemporalContext.unknown,
    signalIds: [],
    reason: 'STANDARD_FLOW',
  );
  for (final finding in findings) {
    if (finding.severity.index > base.severity.index ||
        (finding.severity == base.severity &&
            ((finding.intent == EmergencyIntent.emergencyRequest &&
                    base.intent != EmergencyIntent.emergencyRequest) ||
                (base.intent == EmergencyIntent.uncertainIntent &&
                    finding.intent != EmergencyIntent.uncertainIntent) ||
                (base.time == TemporalContext.unknown &&
                    finding.time != TemporalContext.unknown &&
                    base.intent == finding.intent) ||
                (base.person == AffectedPerson.unknown &&
                    finding.person != AffectedPerson.unknown &&
                    base.intent == finding.intent &&
                    base.time == finding.time)))) {
      base = finding;
    }
  }
  final words = _tokens(question);
  final resolved =
      base.severity != EmergencySeverity.emergency &&
      words.isNotEmpty &&
      _patterns['resolution']!.any(
        (phrase) =>
            phrase.exact.length == words.length && _matchesAt(words, phrase, 0),
      );
  final active =
      previous != null && previous.requiresSafetyResponse && !resolved
      ? previous
      : null;
  final retained = active != null && active.severity.index > base.severity.index
      ? active
      : null;
  final severity =
      retained?.severity ??
      (resolved ? EmergencySeverity.normal : base.severity);
  final person =
      retained?.affectedPerson ??
      (base.person == AffectedPerson.unknown ? active?.affectedPerson : null) ??
      base.person;
  final time = retained?.temporalContext ?? base.time;
  return EmergencyAssessment(
    intent: retained?.intent ?? base.intent,
    severity: severity,
    completeness: switch (severity) {
      EmergencySeverity.normal => AssessmentCompleteness.sufficient,
      EmergencySeverity.warning =>
        time == TemporalContext.unknown
            ? AssessmentCompleteness.ambiguous
            : AssessmentCompleteness.incomplete,
      EmergencySeverity.emergency =>
        person == AffectedPerson.unknown
            ? AssessmentCompleteness.incomplete
            : AssessmentCompleteness.sufficient,
    },
    affectedPerson: person,
    temporalContext: time,
    matchedSignalIds: resolved
        ? const []
        : [
            ...{
              ...?active?.matchedSignalIds,
              ...findings.expand((finding) => finding.signalIds),
            },
          ],
    reasonCodes: resolved
        ? const ['INCIDENT_CONTEXT_UPDATED']
        : [
            if (retained == null) base.reason,
            if (active != null) 'UNRESOLVED_INCIDENT',
          ],
    protocolId: severity == EmergencySeverity.normal
        ? null
        : _routes[severity.code],
    clarificationId: severity != EmergencySeverity.warning
        ? null
        : time == TemporalContext.unknown
        ? 'incident_timing'
        : 'incident_details',
    policyVersion: _policy['version'] as String,
  );
}

EmergencyProtocol? approvedEmergencyProtocol(
  String? id, {
  String locale = 'vi',
}) {
  final protocols = (_policy['protocols'] as List).cast<Map<String, dynamic>>();
  for (final item in protocols) {
    if (item['id'] != id ||
        item['reviewStatus'] != 'APPROVED' ||
        (item['sourceReferences'] as List).isEmpty) {
      continue;
    }
    final locales = item['locales'] as Map<String, dynamic>;
    final copy = (locales[locale] ?? locales['vi']) as Map<String, dynamic>?;
    if (copy == null) return null;
    return EmergencyProtocol(
      id: item['id'] as String,
      version: item['version'] as int,
      title: copy['title'] as String,
      guidance: (copy['guidance'] as List).cast<String>(),
      warnings: (copy['warnings'] as List).cast<String>(),
    );
  }
  return null;
}

String? emergencyClarification(String? id) {
  final entry =
      (_policy['clarifications'] as Map<String, dynamic>)[id]
          as Map<String, dynamic>?;
  return entry?['vi'] as String?;
}

EmergencyProtocol? emergencySafetyFallback() =>
    approvedEmergencyProtocol(_routes['fallback']);

Set<String> personalWarningSignals(String question) {
  final parts = _clauses(question).toList();
  if (parts.any((words) => _has(words, 'other'))) return {};
  return parts
      .map(_evaluate)
      .where(
        (finding) =>
            finding.person == AffectedPerson.self &&
            finding.time == TemporalContext.current &&
            finding.severity == EmergencySeverity.warning,
      )
      .expand((finding) => finding.signalIds)
      .toSet();
}

EmergencyAssessment reportedEmergencyAssessment({
  required EmergencySeverity severity,
  required AssessmentCompleteness completeness,
  required String policyVersion,
  String? clarificationId,
  String? protocolId,
  int? protocolVersion,
}) => EmergencyAssessment(
  intent: EmergencyIntent.uncertainIntent,
  severity: severity,
  completeness: completeness,
  affectedPerson: AffectedPerson.unknown,
  temporalContext: TemporalContext.unknown,
  matchedSignalIds: const [],
  reasonCodes: const ['API_SAFETY_ASSESSMENT'],
  protocolId:
      protocolId != null &&
          protocolVersion != null &&
          policyVersion == _policy['version'] &&
          approvedEmergencyProtocol(protocolId)?.version == protocolVersion
      ? protocolId
      : _routes[severity.code],
  clarificationId: severity == EmergencySeverity.warning
      ? clarificationId
      : null,
  policyVersion: policyVersion,
);

bool blocksEmergencyConflictingOutput(String answer) =>
    _clauses(answer).any((words) => _has(words, 'unsupportedOutput'));
