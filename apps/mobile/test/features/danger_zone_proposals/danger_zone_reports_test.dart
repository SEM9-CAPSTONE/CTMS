import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/features/danger_zone_proposals/application/danger_zone_report_queue.dart';
import 'package:mobile/features/danger_zone_proposals/application/report_gps.dart';
import 'package:mobile/features/danger_zone_proposals/application/report_photos.dart';
import 'package:mobile/features/danger_zone_proposals/data/danger_zone_report_store.dart';
import 'package:mobile/features/danger_zone_proposals/data/danger_zone_reports_api.dart';
import 'package:mobile/features/danger_zone_proposals/data/report_photo_store.dart';
import 'package:mobile/features/danger_zone_proposals/domain/danger_zone_report.dart';
import 'package:mobile/features/danger_zone_proposals/presentation/report_danger_zone_form.dart';
import 'package:mobile/features/danger_zone_proposals/presentation/danger_zone_reports_panel.dart';
import 'package:mobile/features/sync/application/reconnection_sync_coordinator.dart';
import '../sync/reconnection_sync_coordinator_test.dart'
    show FakeConnectivitySource, FakeIncidentStore, FakeIncidentsApi;

class ReportApi implements DangerZoneReportsApi {
  Object? failure;
  Completer<ReportJson>? pending;
  List<ReportJson> sent = [];
  List<ReportJson> rows = [];
  @override
  Future<List<ReportJson>> list(
    String account,
    String trip,
    CancelToken cancel,
  ) async => rows;
  @override
  Future<ReportJson> send(
    String account,
    String trip,
    ReportJson payload,
    CancelToken cancel,
  ) async {
    sent.add(jsonDecode(jsonEncode(payload)) as ReportJson);
    if (failure != null) throw failure!;
    if (pending != null) return pending!.future;
    return {
      'id': 'server-id',
      'clientRequestId': payload['clientRequestId'],
      'status': 'PENDING',
      ...payload,
    };
  }

  Object? photoFailure;
  final List<Uint8List> photos = [];
  @override
  Future<ReportJson> uploadPhoto(
    String account,
    String trip,
    String proposalId,
    Uint8List bytes,
    CancelToken cancel,
  ) async {
    if (photoFailure != null) throw photoFailure!;
    photos.add(bytes);
    return {
      'id': proposalId,
      'status': 'PENDING',
      'photos': [
        for (var i = 0; i < photos.length; i++)
          {'url': '/uploads/photo-$i.jpg'},
      ],
    };
  }
}

/// A real 1×1 PNG so previews decode in widget tests.
final png = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
);
Uint8List jpeg(int marker) =>
    Uint8List.fromList([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, marker]);

DangerZoneReportStore newStore() => DangerZoneReportStore(
  const FlutterSecureStorage(),
  MemoryReportPhotoStore(),
);

class UnwritableStore extends DangerZoneReportStore {
  @override
  Future<void> put(String account, DangerZoneReport report) async =>
      throw StateError('Disk full');
}

ReportJson fix(DateTime now) => {
  'latitude': 16.06,
  'longitude': 108.24,
  'accuracyMeters': 12,
  'capturedAt': now.toUtc().toIso8601String(),
};
DangerZoneReport report(DateTime now) => DangerZoneReport(
  tripId: 'trip',
  payload: {
    'clientRequestId': '11111111-1111-4111-8111-111111111111',
    'hazardType': 'SLIPPERY_OR_LANDSLIDE',
    'description': 'Đất đá tràn xuống lối đi.',
    'severity': 'high',
    'observedAt': now.toUtc().toIso8601String(),
    'location': fix(now),
  },
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test('failed durable save is never treated as a committed report', () async {
    final api = ReportApi();
    final queue = DangerZoneReportQueue(
      account: 'porter',
      store: UnwritableStore(),
      api: api,
    );
    await expectLater(queue.commit(report(DateTime.now())), throwsStateError);
    expect(queue.records, isEmpty);
    expect(queue.commits, 0);
    await queue.flush();
    expect(api.sent, isEmpty);
    queue.dispose();
  });
  test(
    'persistent queue survives restart and retains capture across timeout retries',
    () async {
      var now = DateTime.utc(2026, 11, 21, 3);
      final store = newStore();
      final api = ReportApi()
        ..failure = ApiException('Timeout', statusCode: 503);
      var queue = DangerZoneReportQueue(
        account: 'porter',
        store: store,
        api: api,
        clock: () => now,
      );
      await queue.commit(report(now));
      expect(await queue.flush(), isTrue);
      final original = api.sent.single;
      expect(queue.records.single.statusLabel, 'Chờ gửi');
      queue.dispose();
      now = now.add(const Duration(days: 1));
      api.failure = null;
      queue = DangerZoneReportQueue(
        account: 'porter',
        store: newStore(),
        api: api,
        clock: () => now,
      );
      await queue.ready;
      expect(await queue.flush(), isFalse);
      expect(api.sent.last, original);
      expect(queue.records.single.statusLabel, 'Chờ duyệt');
      final other = DangerZoneReportQueue(
        account: 'another',
        store: store,
        api: api,
      );
      await other.ready;
      expect(other.records, isEmpty);
      queue.dispose();
      other.dispose();
    },
  );
  test(
    'validation errors stop automatic retries and never expose API text',
    () async {
      final api = ReportApi()
        ..failure = ApiException('Internal SQL details', statusCode: 403);
      final queue = DangerZoneReportQueue(
        account: 'porter',
        store: newStore(),
        api: api,
      );
      await queue.commit(report(DateTime.now()));
      expect(await queue.flush(), isFalse);
      expect(queue.records.single.failed, isTrue);
      expect(queue.records.single.error, isNot(contains('SQL')));
      await queue.flush();
      expect(api.sent, hasLength(1));
      await queue.retry(queue.records.single);
      await queue.flush();
      expect(api.sent, hasLength(2));
      queue.dispose();
    },
  );
  test(
    'photos are saved with the report and uploaded after it in order',
    () async {
      final api = ReportApi();
      final store = newStore();
      final queue = DangerZoneReportQueue(
        account: 'porter',
        store: store,
        api: api,
      );
      await queue.commit(report(DateTime.now()), photos: [jpeg(1), jpeg(2)]);
      expect(queue.records.single.photoStatusLabel, 'Đang chờ gửi ảnh (0/2)');
      expect(await queue.flush(), isFalse);
      expect(api.sent, hasLength(1));
      expect(api.photos, [jpeg(1), jpeg(2)]);
      expect(queue.records.single.photoStatusLabel, 'Đã gửi 2 ảnh');
      expect(
        await store.readPhoto('porter', queue.records.single.id, 0),
        isNull,
      );
      // Photos stay out of the secure key-value store, whose web quota is a few MB.
      expect(
        (await const FlutterSecureStorage().readAll()).keys,
        everyElement(isNot(startsWith('dangerZoneReportPhoto:'))),
      );
      queue.dispose();
    },
  );
  test(
    'photos left in secure storage by earlier builds are moved out once',
    () async {
      FlutterSecureStorage.setMockInitialValues({
        'dangerZoneReportPhoto:porter:report-id:0': base64Encode(jpeg(7)),
      });
      final photos = MemoryReportPhotoStore();
      final store = DangerZoneReportStore(const FlutterSecureStorage(), photos);
      await store.moveLegacyPhotos();
      expect(await store.readPhoto('porter', 'report-id', 0), jpeg(7));
      expect(
        (await const FlutterSecureStorage().readAll()).keys,
        isNot(contains('dangerZoneReportPhoto:porter:report-id:0')),
      );
    },
  );
  test(
    'a decided report stops photo retries and explains it in Vietnamese',
    () async {
      final api = ReportApi()
        ..photoFailure = ApiException(
          'Conflict',
          statusCode: 409,
          errorData: {'code': 'PROPOSAL_ALREADY_DECIDED'},
        );
      final queue = DangerZoneReportQueue(
        account: 'porter',
        store: newStore(),
        api: api,
      );
      await queue.commit(report(DateTime.now()), photos: [jpeg(1)]);
      expect(await queue.flush(), isFalse);
      final row = queue.records.single;
      expect(row.statusLabel, 'Chờ duyệt');
      expect(row.photoFailed, isTrue);
      expect(row.canRetry, isTrue);
      expect(
        row.photoError,
        'Báo cáo đã được xét duyệt nên không gửi thêm ảnh.',
      );
      api.photoFailure = null;
      await queue.retry(row);
      await queue.flush();
      expect(api.sent, hasLength(1));
      expect(queue.records.single.photoStatusLabel, 'Đã gửi 1 ảnh');
      queue.dispose();
    },
  );
  test(
    'a temporary photo failure keeps the photo queued for a later retry',
    () async {
      var now = DateTime.utc(2026, 11, 21, 3);
      final api = ReportApi()
        ..photoFailure = ApiException('Timeout', statusCode: 503);
      final queue = DangerZoneReportQueue(
        account: 'porter',
        store: newStore(),
        api: api,
        clock: () => now,
      );
      await queue.commit(report(now), photos: [jpeg(1)]);
      expect(await queue.flush(), isTrue);
      expect(queue.records.single.photoFailed, isFalse);
      expect(queue.records.single.photoStatusLabel, 'Đang chờ gửi ảnh (0/1)');
      api.photoFailure = null;
      now = now.add(const Duration(minutes: 10));
      expect(await queue.flush(), isFalse);
      expect(api.photos, [jpeg(1)]);
      expect(api.sent, hasLength(1));
      queue.dispose();
    },
  );
  test(
    'logout cancels an in-flight delivery and ignores its late response',
    () async {
      final api = ReportApi()..pending = Completer<ReportJson>();
      final store = newStore();
      final queue = DangerZoneReportQueue(
        account: 'porter',
        store: store,
        api: api,
      );
      await queue.commit(report(DateTime.now()));
      final flushing = queue.flush();
      await Future<void>.delayed(Duration.zero);
      queue.dispose();
      expect(queue.cancel.isCancelled, isTrue);
      api.pending!.complete({'status': 'PENDING'});
      await flushing;
      expect((await store.read('porter')).single.server, isNull);
    },
  );
  test(
    'coordinator sends persisted work on reconnect without opening the form',
    () async {
      final api = ReportApi();
      final queue = DangerZoneReportQueue(
        account: 'porter',
        store: newStore(),
        api: api,
      );
      final connectivity = FakeConnectivitySource();
      final coordinator = ReconnectionSyncCoordinator(
        connectivitySource: connectivity,
        incidentStore: FakeIncidentStore(),
        incidentsApi: FakeIncidentsApi(),
        dangerReportQueue: queue,
      );
      await queue.commit(report(DateTime.now()));
      await Future<void>.delayed(const Duration(milliseconds: 20));
      expect(api.sent, isEmpty);
      connectivity.setConnected(true);
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(api.sent, hasLength(1));
      expect(queue.records.single.statusLabel, 'Chờ duyệt');
      coordinator.dispose();
      queue.dispose();
      connectivity.dispose();
    },
  );
  testWidgets(
    'missing GPS blocks save and retry retains the entered description',
    (tester) async {
      final api = ReportApi();
      final queue = DangerZoneReportQueue(
        account: 'porter',
        store: newStore(),
        api: api,
      );
      var gpsReady = false;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            dangerZoneReportQueueProvider.overrideWith((ref) => queue),
            reportGpsReaderProvider.overrideWithValue(() async {
              if (!gpsReady) {
                throw const ReportGpsException(
                  'Hãy bật GPS để ghi nhận vị trí.',
                );
              }
              return fix(DateTime.now());
            }),
          ],
          child: MaterialApp(
            home: ReportDangerZoneForm(
              tripId: 'trip',
              tripTitle: 'Khám phá bán đảo Sơn Trà',
              queue: queue,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField), 'Sạt đất gần ngã rẽ.');
      await tester.scrollUntilVisible(
        find.text('Gửi báo cáo'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull,
      );
      gpsReady = true;
      await tester.ensureVisible(find.text('Lấy lại GPS'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Lấy lại GPS'));
      await tester.pumpAndSettle();
      expect(find.text('Sạt đất gần ngã rẽ.'), findsOneWidget);
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNotNull,
      );
      await tester.tap(find.text('Gửi báo cáo'));
      await tester.pumpAndSettle();
      expect(
        queue.records.single.payload['description'],
        'Sạt đất gần ngã rẽ.',
      );
      expect(
        queue.records.single.payload['location'],
        containsPair('latitude', 16.06),
      );
      expect(api.sent, isEmpty);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets('field photos are previewed, limited to three and removable', (
    tester,
  ) async {
    final api = ReportApi();
    final queue = DangerZoneReportQueue(
      account: 'porter',
      store: newStore(),
      api: api,
    );
    var invalid = false;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          dangerZoneReportQueueProvider.overrideWith((ref) => queue),
          reportGpsReaderProvider.overrideWithValue(
            () async => fix(DateTime.now()),
          ),
          reportPhotoPickerProvider.overrideWithValue(
            (ImageSource source) async =>
                invalid ? Uint8List.fromList(utf8.encode('not an image')) : png,
          ),
        ],
        child: MaterialApp(
          home: ReportDangerZoneForm(
            tripId: 'trip',
            tripTitle: 'Khám phá bán đảo Sơn Trà',
            queue: queue,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField), 'Cây đổ chắn lối.');
    for (var i = 0; i < 3; i++) {
      await tester.ensureVisible(find.text('Chụp ảnh'));
      await tester.tap(find.text('Chụp ảnh'));
      await tester.pumpAndSettle();
    }
    expect(find.text('Ảnh hiện trường (3/3)'), findsOneWidget);
    expect(
      tester
          .widget<TextButton>(
            find.ancestor(
              of: find.text('Chọn ảnh'),
              matching: find.byWidgetPredicate((w) => w is TextButton),
            ),
          )
          .onPressed,
      isNull,
    );
    await tester.tap(find.byTooltip('Xóa ảnh 2'));
    await tester.pumpAndSettle();
    expect(find.text('Ảnh hiện trường (2/3)'), findsOneWidget);
    invalid = true;
    await tester.ensureVisible(find.text('Chọn ảnh'));
    await tester.tap(find.text('Chọn ảnh'));
    await tester.pumpAndSettle();
    expect(find.text('Chọn ảnh JPEG, PNG hoặc WebP.'), findsOneWidget);
    expect(find.text('Ảnh hiện trường (2/3)'), findsOneWidget);
    ScaffoldMessenger.of(
      tester.element(find.byType(ReportDangerZoneForm)),
    ).removeCurrentSnackBar();
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Gửi báo cáo'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Gửi báo cáo'));
    await tester.pumpAndSettle();
    expect(queue.records.single.photoCount, 2);
    await tester.pumpWidget(const SizedBox.shrink());
  });
  testWidgets(
    'completed trips show review decisions without a new report action',
    (tester) async {
      final api = ReportApi()
        ..rows = [
          {
            'id': 'private-id',
            'clientRequestId': 'client-id',
            'status': 'REJECTED',
            'hazardType': 'WILDLIFE',
            'description': 'Có tổ ong gần lối đi.',
            'observedAt': DateTime.now().toIso8601String(),
            'reviewReason': 'Tổ ong đã được đội kiểm lâm di dời.',
          },
        ];
      final queue = DangerZoneReportQueue(
        account: 'porter',
        store: newStore(),
        api: api,
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            dangerZoneReportQueueProvider.overrideWith((ref) => queue),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: DangerZoneReportsPanel(
                tripId: 'trip',
                tripTitle: 'Sơn Trà',
                canReport: false,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Báo điểm nguy hiểm'), findsNothing);
      expect(find.textContaining('Bị từ chối'), findsOneWidget);
      expect(find.textContaining('đội kiểm lâm'), findsOneWidget);
      expect(find.textContaining('private-id'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}
