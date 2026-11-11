import 'dart:math';

/// Versioned simulation policy. Rates use fractions, never percentages internally.
const evaluationPolicyVersion = 'ctms395-simulation-v1';
const evidenceAccuracyMeters = 10.0;

class Episode {
  const Episode(this.id, this.start, this.end, this.offRoute);
  final String id;
  final int start;
  final int end;
  final bool offRoute;
}

class Observation {
  const Observation(this.second, this.accuracy, this.offRoute);
  final int second;
  final double accuracy;
  final bool offRoute;
}

class Alert {
  const Alert(this.second, this.evidenceEligible);
  final int second;
  final bool evidenceEligible;
}

double? rate(int numerator, int denominator) =>
    denominator == 0 ? null : numerator / denominator;

double? nearestRankP95(List<double> values) {
  if (values.isEmpty) return null;
  final ordered = [...values]..sort();
  return ordered[(0.95 * ordered.length).ceil() - 1];
}

/// Episodes are half-open and predefined before replay. One first alert matches
/// one positive episode; repeated alerts are counted separately. Negative
/// episodes are fixed-duration test situations, not inferred from predictions.
Map<String, Object?> evaluate(
  List<Episode> episodes,
  List<Observation> observations,
  List<Alert> alerts,
) {
  final ids = <String>{};
  var previousEnd = -1;
  for (final episode in episodes) {
    if (!ids.add(episode.id) ||
        episode.start < previousEnd ||
        episode.start < 0 ||
        episode.end <= episode.start) {
      throw ArgumentError(
        'Episodes must have unique IDs and non-overlapping ordered intervals',
      );
    }
    previousEnd = episode.end;
  }
  var previousSample = -1;
  for (final sample in observations) {
    if (sample.second <= previousSample ||
        !sample.accuracy.isFinite ||
        sample.accuracy < 0) {
      throw ArgumentError(
        'Samples must be ordered with finite nonnegative accuracy',
      );
    }
    previousSample = sample.second;
  }
  for (final alert in alerts) {
    if (!episodes.any((e) => alert.second >= e.start && alert.second < e.end)) {
      throw ArgumentError('Every alert must have a truth interval');
    }
  }
  var positives = 0;
  var negatives = 0;
  var missed = 0;
  var falseSituations = 0;
  var excluded = 0;
  var duplicates = 0;
  final latencies = <double>[];
  final details = <Map<String, Object?>>[];
  for (final episode in episodes) {
    final samples = observations
        .where((s) => s.second >= episode.start && s.second < episode.end)
        .toList();
    final allAlerts =
        alerts
            .where((a) => a.second >= episode.start && a.second < episode.end)
            .toList()
          ..sort((a, b) => a.second.compareTo(b.second));
    final eligibleAlerts = allAlerts.where((a) => a.evidenceEligible).toList();
    // Require a full run of three high-quality samples, spaced exactly 10 s.
    // An excluded-quality alert invalidates this situation rather than silently
    // disappearing from the false-positive or false-negative denominator.
    var run = 0;
    int? last;
    var opportunity = false;
    for (final sample in samples) {
      run = sample.accuracy <= evidenceAccuracyMeters
          ? (last != null && sample.second - last == 10 ? run + 1 : 1)
          : 0;
      last = sample.second;
      if (run >= 3) opportunity = true;
    }
    final eligible = opportunity && allAlerts.every((a) => a.evidenceEligible);
    if (!eligible) {
      excluded++;
    } else if (episode.offRoute) {
      positives++;
      if (eligibleAlerts.isEmpty) {
        missed++;
      } else {
        latencies.add((eligibleAlerts.first.second - episode.start).toDouble());
        duplicates += max(0, eligibleAlerts.length - 1);
      }
    } else {
      negatives++;
      if (eligibleAlerts.isNotEmpty) falseSituations++;
      duplicates += max(0, eligibleAlerts.length - 1);
    }
    details.add({
      'id': episode.id,
      'offRoute': episode.offRoute,
      'evidenceEligible': eligible,
      'alerts': allAlerts.length,
      'exclusionReason': eligible
          ? null
          : 'insufficient_quality_or_excluded_alert',
    });
  }
  var tp = 0;
  var tn = 0;
  var fp = 0;
  var fn = 0;
  var excludedSamples = 0;
  for (final sample in observations) {
    final labels = episodes.where(
      (e) => sample.second >= e.start && sample.second < e.end,
    );
    if (labels.isEmpty || sample.accuracy > evidenceAccuracyMeters) {
      excludedSamples++;
      continue;
    }
    final truth = labels.single.offRoute;
    if (truth && sample.offRoute) tp++;
    if (!truth && !sample.offRoute) tn++;
    if (!truth && sample.offRoute) fp++;
    if (truth && !sample.offRoute) fn++;
  }
  final fpr = rate(falseSituations, negatives);
  final fnr = rate(missed, positives);
  final p95 = nearestRankP95(latencies);
  final complete = fpr != null && fnr != null && p95 != null && excluded == 0;
  final meets = complete && fpr <= 0.05 && fnr <= 0.02 && p95 <= 30;
  return {
    'policyVersion': evaluationPolicyVersion,
    'evidenceKind': 'simulation',
    'releaseConclusion': 'incomplete',
    'releaseReasons': [
      'independent_field_ground_truth_missing',
      'checkpoint_detector_not_evaluated',
    ],
    'simulationConclusion': !complete
        ? 'incomplete'
        : meets
        ? 'meets_thresholds'
        : 'exceeds_thresholds',
    'primaryEpisodes': {
      'positiveSituations': positives,
      'negativeSituations': negatives,
      'falseSituations': falseSituations,
      'missedSituations': missed,
      'excludedSituations': excluded,
      'repeatedAlerts': duplicates,
      'falsePositiveRate': fpr,
      'falseNegativeRate': fnr,
      'p95LatencySeconds': p95,
      'matchedEpisodes': latencies.length,
      'thresholds': {
        'falsePositiveRate': 0.05,
        'falseNegativeRate': 0.02,
        'p95LatencySeconds': 30,
      },
      'details': details,
    },
    'supplementarySamples': {
      'tp': tp,
      'tn': tn,
      'fp': fp,
      'fn': fn,
      'falsePositiveRate': rate(fp, fp + tn),
      'falseNegativeRate': rate(fn, fn + tp),
      'excludedSamples': excludedSamples,
      'observationalOnly': true,
    },
  };
}
