import 'dart:io';
import 'dart:convert';
import 'metrics.dart';
import 'replay.dart' as replay;

void check(bool condition, String message) {
  if (!condition) throw StateError(message);
}

Map<String, Object?> primary(Map<String, Object?> report) =>
    report['primaryEpisodes']! as Map<String, Object?>;

void main() {
  var checks = 0;
  void verify(bool condition, String name) {
    check(condition, name);
    checks++;
  }

  verify(rate(0, 0) == null, 'Empty denominators are unavailable');
  verify(nearestRankP95([]) == null, 'Empty P95 is unavailable');
  verify(nearestRankP95([30, 10, 20]) == 30, 'Nearest-rank P95');
  final negative = Episode('negative', 0, 40, false);
  final positive = Episode('positive', 40, 80, true);
  final samples = [
    for (var second = 0; second < 80; second += 10)
      Observation(second, 5, second >= 60),
  ];
  final good = evaluate([negative, positive], samples, [const Alert(60, true)]);
  verify(primary(good)['falsePositiveRate'] == 0.0, 'No false alert');
  verify(primary(good)['falseNegativeRate'] == 0.0, 'Matched episode');
  verify(
    primary(good)['p95LatencySeconds'] == 20.0,
    'Latency starts at truth onset',
  );
  verify(
    good['releaseConclusion'] == 'incomplete',
    'Simulation cannot pass release',
  );
  verify(
    good['simulationConclusion'] == 'meets_thresholds',
    'Simulation threshold comparison',
  );
  final missed = evaluate([negative, positive], samples, []);
  verify(primary(missed)['falseNegativeRate'] == 1.0, 'Missing alert is FN');
  verify(
    primary(missed)['p95LatencySeconds'] == null,
    'FN is not zero latency',
  );
  final repeated = evaluate(
    [negative, positive],
    samples,
    [const Alert(60, true), const Alert(70, true)],
  );
  verify(primary(repeated)['repeatedAlerts'] == 1, 'One match per episode');
  final falseAlert = evaluate(
    [negative, positive],
    samples,
    [const Alert(10, true), const Alert(60, true)],
  );
  verify(
    primary(falseAlert)['falsePositiveRate'] == 1.0,
    'Negative situations form FP denominator',
  );
  final badQuality = evaluate(
    [negative, positive],
    samples,
    [const Alert(60, false)],
  );
  verify(
    primary(badQuality)['excludedSituations'] == 1,
    'Excluded alert does not silently vanish',
  );
  verify(
    badQuality['simulationConclusion'] == 'incomplete',
    'Incomplete quality cannot pass',
  );
  final lowQuality = evaluate(
    [negative],
    [
      const Observation(0, 15, false),
      const Observation(10, 15, false),
      const Observation(20, 15, false),
    ],
    [],
  );
  verify(
    primary(lowQuality)['negativeSituations'] == 0,
    '10-20 m excluded from metrics',
  );
  var rejected = false;
  try {
    evaluate([negative, const Episode('overlap', 20, 50, true)], samples, []);
  } on ArgumentError {
    rejected = true;
  }
  verify(rejected, 'Overlapping truth is rejected');
  final first = replay.simulate();
  verify(
    jsonEncode(first) == jsonEncode(replay.simulate()),
    'Fixed seed reproducibility',
  );
  final scenarios = first['scenarios']! as List<Map<String, Object?>>;
  final recovery = scenarios.singleWhere(
    (s) => s['scenario'] == 'off-route-recovery',
  );
  final events = recovery['events']! as List<Map<String, Object?>>;
  verify(
    events.any((e) => e['type'] == 'OFF_ROUTE'),
    'Production detector confirms off-route',
  );
  verify(
    events.any((e) => e['type'] == 'ON_ROUTE_RECOVERED'),
    'Production detector recovers',
  );
  final loss = scenarios.singleWhere((s) => s['scenario'] == 'signal-loss');
  verify(
    (loss['events']! as List<Map<String, Object?>>).any(
      (e) => e['type'] == 'GPS_DEGRADED' && e['second'] == 120,
    ),
    'Tick replay detects degradation at 120 s',
  );
  Map<String, Object?> boundary(int falseCount, int missCount, int latency) {
    final situations = <Episode>[];
    final readings = <Observation>[];
    final predictions = <Alert>[];
    for (var i = 0; i < 100; i++) {
      final base = i * 60;
      final off = i >= 50;
      situations.add(Episode('case-$i', base, base + 60, off));
      for (var offset = 0; offset < 60; offset += 10) {
        readings.add(Observation(base + offset, 10, off));
      }
      if ((!off && i < falseCount) || (off && i >= 50 + missCount)) {
        predictions.add(Alert(base + latency, true));
      }
    }
    return evaluate(situations, readings, predictions);
  }

  // 2/50=4% FPR and 1/50=2% FNR; then cross each gate independently.
  verify(
    boundary(2, 1, 30)['simulationConclusion'] == 'meets_thresholds',
    'Inclusive FN and latency gates',
  );
  verify(
    boundary(3, 1, 30)['simulationConclusion'] == 'exceeds_thresholds',
    'FP above 5%',
  );
  verify(
    boundary(2, 2, 30)['simulationConclusion'] == 'exceeds_thresholds',
    'FN above 2%',
  );
  verify(
    boundary(2, 1, 31)['simulationConclusion'] == 'exceeds_thresholds',
    'P95 above 30 seconds',
  );
  verify(rate(5, 100) == 0.05, 'Exact 5% representation');
  for (final invalid in [double.nan, double.infinity, -1.0]) {
    var rejectedQuality = false;
    try {
      evaluate([negative], [Observation(0, invalid, false)], []);
    } on ArgumentError {
      rejectedQuality = true;
    }
    verify(rejectedQuality, 'Reject invalid accuracy $invalid');
  }
  var unlabelled = false;
  try {
    evaluate([negative], samples, [const Alert(90, true)]);
  } on ArgumentError {
    unlabelled = true;
  }
  verify(unlabelled, 'Unlabelled alerts cannot vanish');
  stdout.writeln('$checks checks passed (synthetic; not field evidence).');
}
