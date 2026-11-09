import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/gps_tracking/application/gps_location_source.dart';
import 'package:mobile/features/gps_tracking/application/gps_tracking_controller.dart';
import 'package:mobile/features/gps_tracking/data/gps_log_store.dart';
import 'package:mobile/features/gps_tracking/data/gps_tracking_api.dart';
import 'package:mobile/features/gps_tracking/domain/gps_tracking_models.dart';
import 'package:mobile/features/offline_map/application/offline_map_controller.dart';
import 'package:mobile/features/offline_map/data/offline_map_package_reader.dart';
import 'package:mobile/features/offline_map/domain/offline_map_models.dart';

const kTestTripId = '11111111-2222-3333-4444-555555555555';

class FakeOfflineMapPackageReader implements OfflineMapPackageReader {
  OfflineMapContext? contextToReturn;
  Exception? exceptionToThrow;
  int readCount = 0;

  @override
  Future<OfflineMapContext?> readActivePackage(String tripId) async {
    readCount++;
    if (exceptionToThrow != null) {
      throw exceptionToThrow!;
    }
    return contextToReturn;
  }
}

class FakeGpsLocationSource implements GpsLocationSource {
  GpsPermissionState permission = GpsPermissionState.granted;
  GpsSample? sampleToReturn;
  int sampleCallCount = 0;

  @override
  Future<GpsPermissionState> checkPermission() async => permission;

  @override
  Future<GpsPermissionState> requestPermission() async => permission;

  @override
  Future<GpsSample> currentSample({required Duration timeLimit}) async {
    sampleCallCount++;
    if (sampleToReturn != null) {
      return sampleToReturn!;
    }
    throw TimeoutException('No fix');
  }
}

class FakeGpsTrackingApi implements GpsTrackingApi {
  @override
  Future<GpsTrackingContext> context(String tripId) async => GpsTrackingContext(
        tripId: tripId,
        eligible: true,
        reason: null,
        participantRole: 'CAMPER',
        samplingIntervalSeconds: 10,
        loggingIntervalSeconds: 30,
        configVersion: 'v3',
      );

  @override
  Future<List<GpsLogUploadResult>> upload(String tripId, List<LocalGpsLog> logs) async =>
      const [];
}

class FakeGpsLogStore implements GpsLogStore {
  @override
  Future<List<LocalGpsLog>> read(String tripId) async => const [];

  @override
  Future<List<LocalGpsLog>> update(
    String tripId,
    List<LocalGpsLog> Function(List<LocalGpsLog> current) transform,
  ) async =>
      const [];
}

OfflineMapContext createTestContext({String tripId = kTestTripId, int version = 1}) {
  return OfflineMapContext(
    tripId: tripId,
    packageVersion: version,
    packageId: 'pkg-01',
    route: const OfflineRouteGeometry(
      routeId: 'route-01',
      points: [
        OfflineRoutePoint(latitude: 16.21, longitude: 108.15),
        OfflineRoutePoint(latitude: 16.22, longitude: 108.16),
      ],
    ),
    checkpoints: const [
      OfflineMapCheckpoint(
        id: 'cp-01',
        routeId: 'route-01',
        name: 'Trạm 1',
        type: 'START',
        latitude: 16.21,
        longitude: 108.15,
        radiusMeters: 20.0,
      ),
    ],
  );
}

void main() {
  late FakeOfflineMapPackageReader reader;
  late FakeGpsLocationSource locationSource;
  late DateTime simulatedNow;

  setUp(() {
    reader = FakeOfflineMapPackageReader();
    locationSource = FakeGpsLocationSource();
    simulatedNow = DateTime.utc(2026, 11, 9, 12, 0, 0);
  });

  group('OfflineMapController - Package Loading States', () {
    test('tải thành công package active khi offline', () async {
      reader.contextToReturn = createTestContext();

      final controller = OfflineMapController(
        tripId: kTestTripId,
        packageReader: reader,
        locationSource: locationSource,
        clock: () => simulatedNow,
        autoStart: false,
      );

      expect(controller.state.packageStatus, equals(OfflineMapPackageStatus.loading));
      await controller.start();

      expect(controller.state.packageStatus, equals(OfflineMapPackageStatus.ready));
      expect(controller.state.hasUsableMap, isTrue);
      expect(controller.state.context?.route.points.length, equals(2));
      expect(controller.state.context?.checkpoints.length, equals(1));
    });

    test('trả về packageMissing khi chưa tải gói offline', () async {
      reader.contextToReturn = null;

      final controller = OfflineMapController(
        tripId: kTestTripId,
        packageReader: reader,
        locationSource: locationSource,
        autoStart: false,
      );
      await controller.start();

      expect(controller.state.packageStatus, equals(OfflineMapPackageStatus.packageMissing));
      expect(controller.state.hasUsableMap, isFalse);
    });

    test('trả về accessDenied khi bị thu hồi quyền tham gia chuyến đi', () async {
      reader.exceptionToThrow = const OfflineMapAccessDeniedException('Bị từ chối truy cập.');

      final controller = OfflineMapController(
        tripId: kTestTripId,
        packageReader: reader,
        locationSource: locationSource,
        autoStart: false,
      );
      await controller.start();

      expect(controller.state.packageStatus, equals(OfflineMapPackageStatus.accessDenied));
      expect(controller.state.hasUsableMap, isFalse);
      expect(controller.state.errorMessage, contains('Bị từ chối'));
    });

    test('trả về packageInvalid khi gói dữ liệu hỏng hoặc sai hash', () async {
      reader.exceptionToThrow = const OfflineMapPackageInvalidException('Hash sai');

      final controller = OfflineMapController(
        tripId: kTestTripId,
        packageReader: reader,
        locationSource: locationSource,
        autoStart: false,
      );
      await controller.start();

      expect(controller.state.packageStatus, equals(OfflineMapPackageStatus.packageInvalid));
      expect(controller.state.hasUsableMap, isFalse);
    });
  });

  group('OfflineMapController - Real GPS & No Mock Fabrications', () {
    test('tuyệt đối không tạo tọa độ giả khi GPS chưa có fix hoặc timeout', () async {
      reader.contextToReturn = createTestContext();
      locationSource.sampleToReturn = null; // Gây timeout

      final controller = OfflineMapController(
        tripId: kTestTripId,
        packageReader: reader,
        locationSource: locationSource,
        autoStart: false,
      );
      await controller.start();

      expect(controller.state.location.sample, isNull);
      expect(controller.state.hasGpsFix, isFalse);
      expect(controller.state.location.status, equals(OfflineMapGpsStatus.unavailable));
    });

    test('đánh giá tín hiệu tốt (good) khi độ chính xác <= 20.0m', () async {
      reader.contextToReturn = createTestContext();
      locationSource.sampleToReturn = GpsSample(
        capturedAt: simulatedNow,
        latitude: 16.2105,
        longitude: 108.1505,
        accuracyMeters: 20.0, // Đúng biên 20.0m là good
      );

      final controller = OfflineMapController(
        tripId: kTestTripId,
        packageReader: reader,
        locationSource: locationSource,
        clock: () => simulatedNow,
        autoStart: false,
      );
      await controller.start();

      expect(controller.state.location.status, equals(OfflineMapGpsStatus.ready));
      expect(controller.state.location.sample?.accuracyMeters, equals(20.0));
      expect(controller.state.location.quality, equals(GpsSignalQuality.good));
    });

    test('đánh giá tín hiệu yếu (poor) khi độ chính xác > 20.0m', () async {
      reader.contextToReturn = createTestContext();
      locationSource.sampleToReturn = GpsSample(
        capturedAt: simulatedNow,
        latitude: 16.2105,
        longitude: 108.1505,
        accuracyMeters: 25.5,
      );

      final controller = OfflineMapController(
        tripId: kTestTripId,
        packageReader: reader,
        locationSource: locationSource,
        clock: () => simulatedNow,
        autoStart: false,
      );
      await controller.start();

      expect(controller.state.location.status, equals(OfflineMapGpsStatus.ready));
      expect(controller.state.location.sample?.accuracyMeters, equals(25.5));
      expect(controller.state.location.quality, equals(GpsSignalQuality.poor));
    });
  });

  group('OfflineMapController - Freshness (isStale) & Clock Discrepancies', () {
    test('mẫu GPS mới (<= 30s) có isStale = false; sau 30s chuyển isStale = true', () async {
      reader.contextToReturn = createTestContext();
      locationSource.sampleToReturn = GpsSample(
        capturedAt: simulatedNow,
        latitude: 16.2100,
        longitude: 108.1500,
        accuracyMeters: 5.0,
      );

      var currentTime = simulatedNow;
      final controller = OfflineMapController(
        tripId: kTestTripId,
        packageReader: reader,
        locationSource: locationSource,
        clock: () => currentTime,
        autoStart: false,
      );
      await controller.start();

      // Tại thời điểm đo: tươi mới
      expect(controller.state.location.isStale(currentTime), isFalse);

      // Sau 25 giây: vẫn còn mới
      currentTime = simulatedNow.add(const Duration(seconds: 25));
      expect(controller.state.location.isStale(currentTime), isFalse);

      // Sau 31 giây: đã cũ (stale)
      currentTime = simulatedNow.add(const Duration(seconds: 31));
      expect(controller.state.location.isStale(currentTime), isTrue);

      controller.dispose();
    });

    test('OfflineMapLocationState.isStale kiểm tra chuẩn xác biên kGpsFutureSkewTolerance (đúng 5s = fresh)', () {
      final state = OfflineMapLocationState(
        sample: GpsSample(
          capturedAt: simulatedNow.add(kGpsFutureSkewTolerance),
          latitude: 16.2100,
          longitude: 108.1500,
          accuracyMeters: 5.0,
        ),
      );
      expect(state.isStale(simulatedNow), isFalse);
    });

    test('OfflineMapLocationState.isStale kiểm tra chuẩn xác biên kGpsFutureSkewTolerance (5s + 1ms = stale)', () {
      final state = OfflineMapLocationState(
        sample: GpsSample(
          capturedAt: simulatedNow.add(kGpsFutureSkewTolerance + const Duration(milliseconds: 1)),
          latitude: 16.2100,
          longitude: 108.1500,
          accuracyMeters: 5.0,
        ),
      );
      expect(state.isStale(simulatedNow), isTrue);
    });

    test('controller nhận mẫu GPS ở tương lai đúng biên 5s có isStale = false', () async {
      reader.contextToReturn = createTestContext();

      // Đúng biên 5s: hợp lệ (fresh)
      locationSource.sampleToReturn = GpsSample(
        capturedAt: simulatedNow.add(kGpsFutureSkewTolerance),
        latitude: 16.2100,
        longitude: 108.1500,
        accuracyMeters: 5.0,
      );

      final controller = OfflineMapController(
        tripId: kTestTripId,
        packageReader: reader,
        locationSource: locationSource,
        clock: () => simulatedNow,
        autoStart: false,
      );
      await controller.start();

      expect(controller.state.location.isStale(simulatedNow), isFalse);
      controller.dispose();
    });

    testWidgets('ticker định kỳ re-evaluate isStale và chỉ notifyListeners khi isStale chuyển từ false sang true', (tester) async {
      var currentTime = simulatedNow;
      reader.contextToReturn = createTestContext();
      locationSource.sampleToReturn = GpsSample(
        capturedAt: simulatedNow,
        latitude: 16.2100,
        longitude: 108.1500,
        accuracyMeters: 5.0,
      );

      final controller = OfflineMapController(
        tripId: kTestTripId,
        packageReader: reader,
        locationSource: locationSource,
        clock: () => currentTime,
        autoStart: false,
      );

      int notifyCount = 0;
      controller.addListener(() => notifyCount++);

      await controller.start();
      await tester.pump();

      expect(controller.state.location.sample, isNotNull);
      expect(controller.state.location.isStale(currentTime), isFalse);
      final initialNotifyCount = notifyCount;

      // Tiến tới 15 giây (3 chu kỳ ticker 5s): isStale vẫn là false, notifyCount không tăng thêm
      currentTime = simulatedNow.add(const Duration(seconds: 15));
      await tester.pump(const Duration(seconds: 15));
      expect(notifyCount, equals(initialNotifyCount));

      // Tiến vượt qua 30 giây (đến 35 giây): isStale chuyển sang true, ticker gọi notifyListeners 1 lần duy nhất
      currentTime = simulatedNow.add(const Duration(seconds: 35));
      await tester.pump(const Duration(seconds: 20));
      expect(controller.state.location.isStale(currentTime), isTrue);
      expect(notifyCount, equals(initialNotifyCount + 1));

      // Tiến thêm 15 giây nữa (đến 50 giây): isStale vẫn true, không spam notifyListeners
      currentTime = simulatedNow.add(const Duration(seconds: 50));
      await tester.pump(const Duration(seconds: 15));
      expect(notifyCount, equals(initialNotifyCount + 1));

      controller.dispose();
    });

    testWidgets('chuyển trạng thái 2 chiều: stale -> có mẫu GPS mới -> fresh (reset _lastKnownStale, không notify thừa)', (tester) async {
      var currentTime = simulatedNow;
      reader.contextToReturn = createTestContext();
      locationSource.sampleToReturn = GpsSample(
        capturedAt: simulatedNow,
        latitude: 16.2100,
        longitude: 108.1500,
        accuracyMeters: 5.0,
      );

      final controller = OfflineMapController(
        tripId: kTestTripId,
        packageReader: reader,
        locationSource: locationSource,
        clock: () => currentTime,
        autoStart: false,
      );

      int notifyCount = 0;
      controller.addListener(() => notifyCount++);

      await controller.start();
      await tester.pump();
      expect(controller.state.location.isStale(currentTime), isFalse);

      // 1. Tiến tới 35s: mẫu trở nên stale, ticker phát hiện và notifyListeners
      currentTime = simulatedNow.add(const Duration(seconds: 35));
      await tester.pump(const Duration(seconds: 35));
      expect(controller.state.location.isStale(currentTime), isTrue);
      final countAfterStale = notifyCount;

      // 2. Nhận mẫu GPS mới tại currentTime (35s)
      locationSource.sampleToReturn = GpsSample(
        capturedAt: currentTime,
        latitude: 16.2105,
        longitude: 108.1505,
        accuracyMeters: 4.0,
      );
      await controller.refreshLocation();
      await tester.pump();

      // State trở về fresh ngay lập tức
      expect(controller.state.location.isStale(currentTime), isFalse);
      expect(notifyCount, equals(countAfterStale + 1)); // do _emit mẫu mới
      final countAfterFresh = notifyCount;

      // 3. Ticker chạy tiếp 15s nữa (đến 50s): mẫu mới vẫn fresh
      // Ticker thấy currentlyStale = false == _lastKnownStale -> KHÔNG notifyListeners thừa
      currentTime = simulatedNow.add(const Duration(seconds: 50));
      await tester.pump(const Duration(seconds: 15));
      expect(controller.state.location.isStale(currentTime), isFalse);
      expect(notifyCount, equals(countAfterFresh));

      controller.dispose();
    });

    test('timestamp ở tương lai bất thường (> 5s) được đánh dấu isStale = true', () async {
      reader.contextToReturn = createTestContext();
      locationSource.sampleToReturn = GpsSample(
        capturedAt: simulatedNow.add(const Duration(seconds: 15)), // Tương lai 15s
        latitude: 16.2100,
        longitude: 108.1500,
        accuracyMeters: 5.0,
      );

      final controller = OfflineMapController(
        tripId: kTestTripId,
        packageReader: reader,
        locationSource: locationSource,
        clock: () => simulatedNow,
        autoStart: false,
      );
      await controller.start();

      expect(controller.state.location.isStale(simulatedNow), isTrue);
      controller.dispose();
    });
  });

  group('OfflineMapController - Permission Revocation & Sample Clearing', () {
    test('khi quyền vị trí bị thu hồi, xóa sạch sample trong state (sample = null)', () async {
      reader.contextToReturn = createTestContext();
      locationSource.permission = GpsPermissionState.denied;

      final controller = OfflineMapController(
        tripId: kTestTripId,
        packageReader: reader,
        locationSource: locationSource,
        autoStart: false,
      );
      await controller.start();

      expect(controller.state.location.status, equals(OfflineMapGpsStatus.permissionDenied));
      expect(controller.state.location.sample, isNull);
      expect(controller.state.hasGpsFix, isFalse);
    });

    test('khi GPS thiết bị bị tắt (serviceDisabled), xóa sạch sample (sample = null)', () async {
      reader.contextToReturn = createTestContext();
      locationSource.permission = GpsPermissionState.serviceDisabled;

      final controller = OfflineMapController(
        tripId: kTestTripId,
        packageReader: reader,
        locationSource: locationSource,
        autoStart: false,
      );
      await controller.start();

      expect(controller.state.location.status, equals(OfflineMapGpsStatus.serviceDisabled));
      expect(controller.state.location.sample, isNull);
    });
  });

  group('OfflineMapController - Single Stream Reuse with GpsTrackingController', () {
    test('tái sử dụng trực tiếp mẫu từ GpsTrackingController, không tạo timer/luồng GPS thứ hai (sampleCallCount = 0)', () async {
      reader.contextToReturn = createTestContext();

      final gpsTracking = GpsTrackingController(
        tripId: kTestTripId,
        api: FakeGpsTrackingApi(),
        store: FakeGpsLogStore(),
        location: locationSource,
        clock: () => simulatedNow,
        autoStart: false,
      );

      final controller = OfflineMapController(
        tripId: kTestTripId,
        packageReader: reader,
        gps: gpsTracking,
        locationSource: locationSource,
        clock: () => simulatedNow,
        autoStart: false,
      );
      await controller.start();

      // Giả lập GpsTrackingController nhận được mẫu mới từ luồng tracking chính
      gpsTracking.lastSample = GpsSample(
        capturedAt: simulatedNow,
        latitude: 16.2111,
        longitude: 108.1511,
        accuracyMeters: 8.0,
      );
      gpsTracking.notifyListeners();

      // OfflineMapController nhận ngay lập tức mà không gọi locationSource.currentSample
      expect(controller.state.location.status, equals(OfflineMapGpsStatus.ready));
      expect(controller.state.location.sample?.latitude, equals(16.2111));
      expect(controller.state.location.quality, equals(GpsSignalQuality.good));

      // Không gọi locationSource thêm
      expect(locationSource.sampleCallCount, equals(0));

      controller.dispose();
      gpsTracking.dispose();
    });
  });
}
