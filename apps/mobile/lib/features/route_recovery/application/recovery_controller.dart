import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_exception.dart';
import '../../auth/application/auth_controller.dart';
import '../../offline_map/application/offline_map_controller.dart';
import '../../route_deviation/application/route_deviation_controller.dart';
import '../../route_deviation/domain/route_deviation_models.dart';
import '../data/recovery_api.dart';
import '../data/recovery_cache.dart';
import '../domain/recovery_geometry.dart';
import '../domain/recovery_state.dart';

const recoveryValidationTtl = Duration(seconds: 60);
const recoveryCalculationInterval = Duration(seconds: 1);
const recoveryMovementMetres = 3.0;

final recoveryApiProvider = Provider<RecoveryApi>(
  (ref) => HttpRecoveryApi(ref.watch(apiClientProvider)),
);
final recoveryCacheProvider = Provider<RecoveryCache>(
  (ref) => SecureRecoveryCache(
    ref.watch(authControllerProvider.select((s) => s.valueOrNull?.id)) ??
        'signed-out',
  ),
);
final recoveryControllerProvider = ChangeNotifierProvider.autoDispose
    .family<RecoveryController, String>((ref, tripId) {
      final userId = ref.watch(
        authControllerProvider.select((s) => s.valueOrNull?.id),
      );
      final map = ref.watch(offlineMapControllerProvider(tripId).notifier);
      final detector = ref.watch(
        routeDeviationControllerProvider(tripId).notifier,
      );
      return RecoveryController(
        tripId: tripId,
        api: ref.watch(recoveryApiProvider),
        cache: ref.watch(recoveryCacheProvider),
        inputs: Listenable.merge([map, detector]),
        readInput: () => RecoveryInput(
          map.state,
          offRoute: detector.navigation == RouteNavigationState.offRoute,
          detectionActive: detector.status == RouteDeviationStatus.active,
          detectionRouteId: detector.context?.routeId,
          detectionCoordinates: detector.context?.coordinates ?? const [],
        ),
        signedIn: userId != null,
      );
    });

class RecoveryController extends ChangeNotifier {
  RecoveryController({
    required this.tripId,
    required this.api,
    required this.cache,
    required this.inputs,
    required this.readInput,
    this.signedIn = true,
    DateTime Function()? clock,
    bool autoStart = true,
  }) : clock = clock ?? DateTime.now {
    inputs.addListener(update);
    if (autoStart) {
      update();
      _timer = Timer.periodic(const Duration(seconds: 1), (_) => update());
    }
  }
  final String tripId;
  final RecoveryApi api;
  final RecoveryCache cache;
  final Listenable inputs;
  final RecoveryInput Function() readInput;
  final bool signedIn;
  final DateTime Function() clock;
  RecoveryView view = const RecoveryView(RecoveryDisplay.loading);
  RecoveryEvidence _evidence = RecoveryEvidence.checking;
  RecoveryBinding? _binding;
  DateTime? _lastCheck, _observedAt, _calculatedAt;
  RecoveryTarget? _target;
  Timer? _timer;
  bool _disposed = false;
  int _epoch = 0;
  String? _requestKey;
  String get _restrictionKey => 'restriction:$tripId';

  void update() {
    if (_disposed) return;
    final input = readInput();
    final context = input.map.hasUsableMap ? input.map.context : null;
    final next = context == null ? null : RecoveryBinding(context);
    if (next?.key != _binding?.key) {
      _epoch++;
      _binding = next;
      _target = null;
      _lastCheck = null;
      _observedAt = null;
      _evidence = RecoveryEvidence.checking;
    }
    if (!signedIn) _evidence = RecoveryEvidence.restricted;
    if (signedIn && next != null && !next.valid) {
      _evidence = RecoveryEvidence.artifactInvalid;
    }
    if (signedIn &&
        next?.valid == true &&
        (_lastCheck == null ||
            clock().difference(_lastCheck!) >= recoveryValidationTtl) &&
        _requestKey != next!.key) {
      _evidence = RecoveryEvidence.checking;
      _lastCheck = clock();
      unawaited(refresh());
    }
    var display = decideRecovery(input, _evidence, clock());
    if (display == RecoveryDisplay.ready ||
        display == RecoveryDisplay.offlineReady) {
      final s = input.map.location.sample!;
      final point = RecoveryPoint(s.latitude, s.longitude);
      if (_target == null ||
          (_calculatedAt != null &&
              clock().difference(_calculatedAt!) >=
                  recoveryCalculationInterval &&
              recoveryDistance(_target!.origin, point) >=
                  recoveryMovementMetres)) {
        _target = nearestRecoveryTarget(point, [
          for (final p in context!.route.points)
            RecoveryPoint(p.latitude, p.longitude),
        ]);
        _calculatedAt = clock();
      }
      if (_target == null) display = RecoveryDisplay.unavailable;
      // Suppress sub-metre projection noise while the detector settles.
      // This affects guidance only; it never confirms a return to the route.
      if (_target != null && _target!.distanceMeters < 0.5) {
        display = RecoveryDisplay.notOffRoute;
      }
    } else {
      _target = null;
    }
    final target =
        (display == RecoveryDisplay.ready ||
            display == RecoveryDisplay.offlineReady)
        ? _target
        : null;
    if (view.display != display ||
        view.target != target ||
        view.observedAt != _observedAt) {
      view = RecoveryView(display, target: target, observedAt: _observedAt);
      notifyListeners();
    }
  }

  Future<void> refresh() async {
    final binding = _binding;
    if (_disposed ||
        !signedIn ||
        binding == null ||
        !binding.valid ||
        _requestKey == binding.key) {
      return;
    }
    final epoch = _epoch;
    _requestKey = binding.key;
    _lastCheck = clock();
    _evidence = RecoveryEvidence.checking;
    update();
    bool current() => !_disposed && epoch == _epoch;
    try {
      final confirmed = await api.check(binding);
      if (!current()) return;
      _evidence = confirmed.evidence;
      _observedAt = confirmed.observedAt;
      // Persist a negative decision too; a later outage cannot revive older approval.
      await cache.write(
        binding.key,
        jsonEncode({
          'evidence': _evidence.name,
          'observedAt': _observedAt!.toIso8601String(),
        }),
      );
      if (current()) await cache.write(_restrictionKey, 'false');
    } on ApiException catch (error) {
      if (!current()) return;
      if ([401, 403, 404].contains(error.statusCode)) {
        _evidence = RecoveryEvidence.restricted;
        await _safeWrite(_restrictionKey, 'true');
      } else if (error.kind == ApiExceptionKind.network ||
          error.kind == ApiExceptionKind.timeout) {
        _evidence = RecoveryEvidence.unverified;
        try {
          final restricted = await cache.read(_restrictionKey);
          if (!current()) return;
          if (restricted == 'true') {
            _evidence = RecoveryEvidence.restricted;
          } else {
            final raw = await cache.read(binding.key);
            if (!current()) return;
            if (raw != null) {
              final saved = jsonDecode(raw) as Map<String, Object?>;
              final evidence = RecoveryEvidence.values.byName(
                saved['evidence'] as String,
              );
              _observedAt = DateTime.parse(saved['observedAt'] as String);
              _evidence = evidence == RecoveryEvidence.available
                  ? RecoveryEvidence.offline
                  : [
                      RecoveryEvidence.stale,
                      RecoveryEvidence.artifactInvalid,
                      RecoveryEvidence.mismatch,
                      RecoveryEvidence.unavailable,
                    ].contains(evidence)
                  ? evidence
                  : RecoveryEvidence.unverified;
            }
          }
        } catch (_) {
          _evidence = RecoveryEvidence.unverified;
        }
      } else {
        _evidence = RecoveryEvidence.error;
        await _safeWrite(
          binding.key,
          jsonEncode({
            'evidence': 'error',
            'observedAt': clock().toUtc().toIso8601String(),
          }),
        );
      }
    } on FormatException {
      if (current()) {
        _evidence = RecoveryEvidence.mismatch;
        await _safeWrite(
          binding.key,
          jsonEncode({
            'evidence': 'mismatch',
            'observedAt': clock().toUtc().toIso8601String(),
          }),
        );
      }
    } catch (_) {
      if (current()) {
        _evidence = RecoveryEvidence.error;
        await _safeWrite(
          binding.key,
          jsonEncode({
            'evidence': 'error',
            'observedAt': clock().toUtc().toIso8601String(),
          }),
        );
      }
    } finally {
      if (_requestKey == binding.key) _requestKey = null;
      if (current()) update();
    }
  }

  Future<void> _safeWrite(String key, String value) async {
    try {
      await cache.write(key, value);
    } catch (_) {}
  }

  @override
  void dispose() {
    _disposed = true;
    _epoch++;
    inputs.removeListener(update);
    _timer?.cancel();
    super.dispose();
  }
}
