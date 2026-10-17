import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_exception.dart';
import '../../auth/application/auth_controller.dart';
import '../../auth/domain/user_role.dart';
import '../data/incident_store.dart';
import '../data/incidents_api.dart';
import '../domain/trip_incident.dart';
import 'incident_sync.dart';

class IncidentsController extends ChangeNotifier with WidgetsBindingObserver {
  IncidentsController(this.store, this.api) {
    WidgetsBinding.instance.addObserver(this);
    unawaited(_initialize());
  }
  final IncidentStore store;
  final IncidentsApi api;
  List<IncidentTrip> trips = [];
  List<LocalIncident> records = [];
  final Map<String, List<IncidentJson>> serverRecords = {};
  bool ready = false;
  bool online = false;
  bool syncing = false;
  bool _disposed = false;
  String? error;
  Timer? _timer;
  StreamSubscription<List<ConnectivityResult>>? _connection;

  String _requestErrorMessage(ApiException failure) {
    if (failure.kind == ApiExceptionKind.network ||
        failure.kind == ApiExceptionKind.timeout) {
      return 'Chưa kết nối được máy chủ. Bạn vẫn có thể lưu sự cố trên thiết bị cho chuyến đi đang diễn ra đã được lưu; ứng dụng sẽ thử đồng bộ lại.';
    }
    return failure.message;
  }

  void _changed() {
    if (!_disposed) notifyListeners();
  }

  Future<void> _initialize() async {
    try {
      records = await store.read();
      trips = await store.readTrips();
      online = !(await Connectivity().checkConnectivity()).contains(
        ConnectivityResult.none,
      );
      if (_disposed) return;
      ready = true;
      _connection = Connectivity().onConnectivityChanged.listen((results) {
        online = !results.contains(ConnectivityResult.none);
        _changed();
        if (online) unawaited(refresh());
      });
      _timer = Timer.periodic(
        const Duration(seconds: 15),
        (_) => unawaited(refresh()),
      );
      _changed();
      await refresh();
    } catch (_) {
      error = 'Không thể đọc bộ nhớ sự cố. Vui lòng mở lại ứng dụng.';
      _changed();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(refresh());
  }

  Future<void> refresh() async {
    if (!ready || !online || syncing || _disposed) return;
    syncing = true;
    _changed();
    try {
      try {
        final assigned = await api.assignedTrips();
        if (_disposed) return;
        await store.saveTrips(assigned);
        trips = assigned;
        error = null;
      } on ApiException catch (failure) {
        if (failure.statusCode == 403) {
          trips = [];
          await store.saveTrips([]);
        }
        error = _requestErrorMessage(failure);
      }
      for (final record in List<LocalIncident>.of(records)) {
        if (_disposed) return;
        if (!record.due(DateTime.now())) continue;
        final updated = await synchronizeIncident(
          record,
          api,
          DateTime.now(),
          isActive: () => !_disposed,
        );
        await store.put(updated);
        if (_disposed) return;
        records = records
            .map((item) => item.id == updated.id ? updated : item)
            .toList();
        _changed();
      }
    } catch (_) {
      error =
          'Không thể cập nhật bộ nhớ sự cố. Báo cáo đã lưu sẽ được thử lại.';
    } finally {
      syncing = false;
      _changed();
    }
  }

  Future<void> loadTrip(String tripId) async {
    if (!online || _disposed) return;
    try {
      final items = await api.list(tripId);
      if (_disposed) return;
      serverRecords[tripId] = items;
      error = null;
    } on ApiException catch (failure) {
      error = _requestErrorMessage(failure);
    }
    _changed();
  }

  Future<void> save({
    required IncidentTrip trip,
    required String category,
    required String severity,
    required String description,
    required DateTime occurredAt,
    IncidentJson? location,
    Uint8List? photo,
  }) async {
    if (_disposed ||
        !ready ||
        !trips.any((item) => item.id == trip.id && item.canReport)) {
      throw StateError('Chuyến đi không còn cho phép báo cáo sự cố.');
    }
    if (!incidentCategories.containsKey(category) ||
        !incidentSeverities.containsKey(severity) ||
        description.trim().isEmpty ||
        description.trim().length > incidentDescriptionMaxLength ||
        (photo != null && photo.length > incidentPhotoMaxBytes)) {
      throw ArgumentError('Thông tin sự cố không hợp lệ.');
    }
    final record = LocalIncident(
      tripId: trip.id,
      payload: {
        'id': newIncidentId(),
        'category': category,
        'severity': severity,
        'description': description.trim(),
        'occurredAt': occurredAt.toUtc().toIso8601String(),
        'location': location,
        'capturedOffline': !online,
      },
      photo: photo,
      mediaState: photo == null
          ? IncidentMediaState.none
          : IncidentMediaState.pending,
    );
    await store.put(record);
    if (_disposed) return;
    records = [...records, record];
    _changed();
    unawaited(refresh());
  }

  Future<void> retry(String id) async {
    if (syncing || _disposed) return;
    final record = records.firstWhere((item) => item.id == id);
    final updated = record.delivery(
      sync: record.syncState == IncidentSyncState.failed
          ? IncidentSyncState.pending
          : record.syncState,
      media: record.mediaState == IncidentMediaState.failed
          ? IncidentMediaState.pending
          : record.mediaState,
    );
    await store.put(updated);
    records = records.map((item) => item.id == id ? updated : item).toList();
    _changed();
    await refresh();
  }

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    unawaited(_connection?.cancel());
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}

final incidentsControllerProvider =
    ChangeNotifierProvider<IncidentsController?>((ref) {
      final user = ref.watch(authControllerProvider).valueOrNull;
      if (user == null ||
          !(user.roles.contains(UserRole.porter) ||
              user.role == UserRole.porter)) {
        return null;
      }
      return IncidentsController(
        FileIncidentStore(user.id),
        HttpIncidentsApi(ref.watch(apiClientProvider)),
      );
    });
