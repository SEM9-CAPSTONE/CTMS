import 'dart:convert';
import 'dart:io';
import 'dart:math';

import '../../lib/features/gps_tracking/domain/gps_tracking_models.dart';
import '../../lib/features/route_deviation/domain/route_deviation_detector.dart';
import '../../lib/features/route_deviation/domain/route_deviation_models.dart';
import 'metrics.dart';

/// Deterministic simulation, never an independent field dataset. Truth is the
/// scripted clean track, not the detector output or noisy measured position.
Map<String, Object?> simulate({int seed = 395}) {
  final random = Random(seed);
  final route = <List<double>>[
    [108, 16],
    [108.02, 16],
  ];
  final start = DateTime.utc(2026, 1, 1);
  final scenarios = <(String, List<double>, double, bool)>[
    ('on-route-jitter', List.filled(12, 0), 5, false),
    (
      'off-route-recovery',
      [...List.filled(9, 65.0), ...List.filled(3, 0.0)],
      5,
      true,
    ),
    ('near-threshold', List.filled(12, 49), 5, false),
    ('short-excursion', [65, 65, ...List.filled(10, 0.0)], 5, true),
    ('accuracy-10-to-20', List.filled(12, 65), 15, true),
    ('invalid-accuracy', List.filled(12, 65), 25, true),
    ('signal-loss', List.filled(15, 0), 5, false),
  ];
  final reports = <Map<String, Object?>>[];
  for (final scenario in scenarios) {
    final (id, cleanDistances, accuracy, _) = scenario;
    final detector = RouteDeviationDetector(route: route, startedAt: start);
    final observations = <Observation>[];
    final alerts = <Alert>[];
    final events = <Map<String, Object?>>[];
    final episodes = <Episode>[];
    final rawSamples = <Map<String, Object?>>[];
    var truth = false;
    var episodeStart = 0;
    var run = 0;
    var previousTick = 0;
    for (var index = 0; index < cleanDistances.length; index++) {
      final second = index * 10;
      final clean = cleanDistances[index];
      final nextTruth = clean > 50
          ? true
          : clean < 20
          ? false
          : truth;
      if (nextTruth != truth) {
        if (second > episodeStart) {
          episodes.add(
            Episode('$id-${episodes.length}', episodeStart, second, truth),
          );
        }
        episodeStart = second;
        truth = nextTruth;
      }
      // Tick at production 5-second cadence, including gaps without samples.
      for (var tick = previousTick + 5; tick <= second; tick += 5) {
        for (final event in detector.onTick(
          start.add(Duration(seconds: tick)),
        )) {
          events.add({'second': tick, 'type': event.type.wireName});
        }
      }
      previousTick = second;
      if (id == 'signal-loss' && index > 0) continue;
      final measured = clean + (random.nextDouble() * 6 - 3);
      // A horizontal reference line makes the independent clean-track offset
      // explicit. Longitude remains inside the Route segment.
      final sample = GpsSample(
        capturedAt: start.add(Duration(seconds: second)),
        latitude: 16 + measured / 111195.0802335329,
        longitude: 108.01,
        accuracyMeters: accuracy,
      );
      rawSamples.add({
        'second': second,
        'latitude': sample.latitude,
        'longitude': sample.longitude,
        'accuracyMeters': accuracy,
        'cleanDistanceMeters': clean,
        'truthOffRoute': truth,
      });
      run = accuracy <= 10 ? run + 1 : 0;
      for (final event in detector.onSample(sample)) {
        events.add({'second': second, 'type': event.type.wireName});
        if (event.type == SafetyEventType.offRoute)
          alerts.add(Alert(second, run >= 3));
      }
      observations.add(
        Observation(
          second,
          accuracy,
          detector.navigation == RouteNavigationState.offRoute,
        ),
      );
    }
    episodes.add(
      Episode(
        '$id-${episodes.length}',
        episodeStart,
        cleanDistances.length * 10,
        truth,
      ),
    );
    reports.add({
      'scenario': id,
      'rawSamples': rawSamples,
      'truthIntervals': [
        for (final e in episodes)
          {'id': e.id, 'start': e.start, 'end': e.end, 'offRoute': e.offRoute},
      ],
      'events': events,
      'metrics': evaluate(episodes, observations, alerts),
    });
  }
  return {
    'schemaVersion': 1,
    'datasetVersion': 'ctms395-synthetic-v1',
    'seed': seed,
    'configVersion': 'v3',
    'route': {'type': 'LineString', 'coordinates': route},
    'packageVersion': null,
    'packageContext': 'not_available_simulation_only',
    'samplingIntervalSeconds': 10,
    'tickIntervalSeconds': 5,
    'detectorSource':
        'apps/mobile/lib/features/route_deviation/domain/route_deviation_detector.dart',
    'releaseConclusion': 'incomplete',
    'limitations': [
      'Synthetic labels are not independent field ground truth.',
      'Checkpoint detector is not evaluated.',
      'No device battery measurements or end-to-end synchronization claims.',
      'Scenario metrics are separate; rates must not be averaged.',
    ],
    'scenarios': reports,
  };
}

void main(List<String> args) {
  try {
    if (args.length != 2 || args.first != '--output') {
      throw ArgumentError(
        'Usage: dart run tool/gps_evaluation/replay.dart --output <report.json>',
      );
    }
    final result = simulate();
    final git = Process.runSync('git', ['rev-parse', 'HEAD']);
    if (git.exitCode != 0) throw StateError('Cannot resolve detector commit');
    result['detectorCommit'] = (git.stdout as String).trim();
    final dirty = Process.runSync('git', [
      'status',
      '--porcelain',
      '--',
      'apps/mobile/lib/features/route_deviation',
      'apps/mobile/lib/features/gps_tracking/domain/gps_tracking_models.dart',
    ]);
    if (dirty.exitCode != 0 || (dirty.stdout as String).trim().isNotEmpty) {
      throw StateError(
        'Detector sources must be clean for reproducible evidence',
      );
    }
    final file = File(args[1]);
    file.parent.createSync(recursive: true);
    file.writeAsStringSync(
      '${const JsonEncoder.withIndent('  ').convert(result)}\n',
    );
    stdout.writeln(
      'Simulation report written. Release conclusion: incomplete.',
    );
  } on Object catch (error) {
    stderr.writeln(error);
    exitCode = 1;
  }
}
