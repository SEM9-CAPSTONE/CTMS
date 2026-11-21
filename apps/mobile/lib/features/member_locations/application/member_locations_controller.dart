import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_exception.dart';
import '../data/member_locations_api.dart';
import '../../auth/application/auth_controller.dart';

/// Same approved cadence as the CTMS-063 progress panel.
const memberLocationsRefreshInterval = Duration(minutes: 1);

/// CTMS-066-T02: keeps the server's last-synced member locations for one Trip.
///
/// A failed refresh keeps the last successful data, labelled with its time; nothing from the
/// Porter's own device buffer is ever merged in.
class MemberLocationsController extends ChangeNotifier {
  MemberLocationsController({
    required this.tripId,
    required this.api,
    Duration refreshInterval = memberLocationsRefreshInterval,
  }) {
    unawaited(refresh());
    _timer = Timer.periodic(refreshInterval, (_) => unawaited(refresh()));
  }

  final String tripId;
  final MemberLocationsApi api;
  Timer? _timer;
  bool _disposed = false;

  TripMemberLocations? data;
  bool isLoading = true;
  bool lastRefreshFailed = false;
  bool isRefreshing = false;

  /// HTTP status of the last failure (403/404 = outside scope, 409 = Trip not ongoing).
  int? errorStatus;

  Future<void> refresh() async {
    if (_disposed || isRefreshing) return;
    isRefreshing = true;
    isLoading = data == null;
    _notify();
    try {
      final result = await api.fetch(tripId);
      if (_disposed) return;
      data = result;
      lastRefreshFailed = false;
      errorStatus = null;
    } on ApiException catch (error) {
      lastRefreshFailed = true;
      errorStatus = error.statusCode;
      if ([401, 403, 404, 409].contains(errorStatus)) {
        data = null;
        _timer?.cancel();
      }
    } catch (_) {
      lastRefreshFailed = true;
      errorStatus = null;
    } finally {
      isLoading = false;
      isRefreshing = false;
      _notify();
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    super.dispose();
  }
}

final memberLocationsApiProvider = Provider<MemberLocationsApi>(
  (ref) => HttpMemberLocationsApi(
    ref.watch(apiClientProvider),
    accountId: ref.watch(authControllerProvider).asData?.value?.id,
  ),
);

final memberLocationsControllerProvider = ChangeNotifierProvider.autoDispose
    .family<MemberLocationsController, String>(
      (ref, tripId) => MemberLocationsController(
        tripId: tripId,
        api: ref.watch(memberLocationsApiProvider),
      ),
    );
