import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../data/trip_weather_api.dart';
import '../presentation/trip_weather_labels.dart';

/// The monitor re-checks a Trip every 6 h at most (CTMS-93), so a minute is plenty for the app.
const tripWeatherRefreshInterval = Duration(seconds: 60);

/// Which Trip, and which of the Camper's Bookings, the weather view is for.
typedef TripWeatherKey = ({String tripId, String? bookingId});

/// CTMS-62: weather for one Trip in the Camper app: the forecast for the Trip's own dates, the
/// risk-change notices of that Trip and, for a weather reschedule, the keep / full-refund answer.
///
/// Refreshes every [tripWeatherRefreshInterval] and when the app returns to the foreground
/// (the app has no socket). A failed refresh keeps what was loaded before.
class TripWeatherController extends ChangeNotifier with WidgetsBindingObserver {
  TripWeatherController({
    required this.tripId,
    required this.api,
    this.bookingId,
    Duration refreshInterval = tripWeatherRefreshInterval,
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now {
    WidgetsBinding.instance.addObserver(this);
    unawaited(refresh());
    _timer = Timer.periodic(refreshInterval, (_) => unawaited(refresh()));
  }

  final String tripId;
  final String? bookingId;
  final TripWeatherApi api;
  final DateTime Function() _now;
  Timer? _timer;
  bool _disposed = false;
  bool _refreshing = false;

  bool loaded = false;
  TripWeatherForecast? forecast;
  String? forecastError;
  List<WeatherChangeNotice> notices = const [];
  BookingWeatherState? booking;

  bool answering = false;
  String? answerError;

  /// `confirmed` or `cancelled` once the Camper answered a weather reschedule.
  String? answeredStatus;

  DateTime get now => _now();

  bool get showRescheduleAnswer =>
      answeredStatus != null || (booking?.canAnswerWeatherReschedule ?? false);

  Future<void> refresh() async {
    if (_refreshing || _disposed) return;
    _refreshing = true;
    try {
      await Future.wait([
        _loadForecast(),
        _loadNotices(),
        if (bookingId != null) _loadBooking(bookingId!),
      ]);
    } finally {
      _refreshing = false;
      loaded = true;
      _notify();
    }
  }

  Future<void> _loadForecast() async {
    try {
      forecast = await api.fetchForecast(tripId);
      forecastError = null;
    } catch (error) {
      forecastError = tripWeatherErrorMessage(error);
    }
  }

  Future<void> _loadNotices() async {
    try {
      final items = await api.fetchNotices();
      notices = items.where((item) => item.tripId == tripId).toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    } catch (_) {}
  }

  Future<void> _loadBooking(String id) async {
    try {
      booking = await api.fetchBooking(id);
    } catch (_) {}
  }

  Future<void> markNoticeRead(WeatherChangeNotice notice) async {
    if (!notice.isUnread) return;
    final at = _now();
    notices = [
      for (final item in notices)
        item.id == notice.id ? item.markedRead(at) : item,
    ];
    _notify();
    try {
      await api.markNoticeRead(notice.id);
    } catch (_) {
      // The next refresh shows the server's state again.
    }
  }

  /// Sends the Camper's answer once; returns true when the server accepted it.
  Future<bool> answerReschedule({required bool accept}) async {
    final id = bookingId;
    if (id == null || answering) return false;
    answering = true;
    answerError = null;
    _notify();
    try {
      answeredStatus = await api.answerReschedule(id, accept: accept);
      return true;
    } catch (error) {
      answerError = weatherRescheduleErrorMessage(error);
      return false;
    } finally {
      answering = false;
      _notify();
      if (answeredStatus != null) unawaited(_reloadAfterAnswer(id));
    }
  }

  Future<void> _reloadAfterAnswer(String id) async {
    await _loadBooking(id);
    _notify();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(refresh());
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }
}

final tripWeatherApiProvider = Provider<TripWeatherApi>(
  (ref) => HttpTripWeatherApi(ref.watch(apiClientProvider)),
);

final tripWeatherControllerProvider = ChangeNotifierProvider.autoDispose
    .family<TripWeatherController, TripWeatherKey>(
      (ref, key) => TripWeatherController(
        tripId: key.tripId,
        bookingId: key.bookingId,
        api: ref.watch(tripWeatherApiProvider),
      ),
    );
