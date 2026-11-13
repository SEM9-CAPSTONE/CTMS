import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/offline_packages/data/package_policy_client.dart';
import 'package:mobile/features/offline_packages/application/package_download_controller.dart';
import 'package:mobile/features/offline_packages/data/package_download_api.dart';
import 'package:mobile/features/offline_packages/data/package_download_store.dart';
import 'package:mobile/features/offline_packages/data/package_downloader.dart';
import 'package:mobile/features/offline_packages/data/package_storage_capacity.dart';
import 'package:mobile/features/offline_packages/domain/offline_package.dart';
import 'package_integrity_fixture.dart';

class _Server implements HttpClientAdapter {
  final reports = <String>[];
  bool offline = false;
  int denied = 0;
  late String selectedId;
  int selectedVersion = 1;
  String? requiredId;
  final versions = <String, int>{};
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? stream,
    Future<void>? cancel,
  ) async {
    if (offline) {
      throw DioException.connectionError(
        requestOptions: options,
        reason: 'offline',
      );
    }
    if (denied != 0) {
      return ResponseBody.fromString(
        '{}',
        denied,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    }
    Object response = <String, Object?>{};
    if (options.path.endsWith('/context')) {
      final selected = versions.isEmpty
          ? selectedId
          : options.queryParameters['packageId'] as String;
      final version = versions[selected] ?? selectedVersion;
      response = {
        'tripId': testTripId,
        'tripStatus': 'published',
        'checkedAt': '2026-11-12T00:00:00Z',
        'selected': {'packageId': selected, 'version': version},
        'replaceAllowed': true,
        'publication': {
          'requiredPackageId': requiredId ?? selected,
          'requiredVersion': versions[requiredId] ?? 1,
          'updateRequired': requiredId != null && selected != requiredId,
          'newerAvailable': versions.isNotEmpty && version < 2,
        },
        'sourceFreshness': {'state': 'unknown'},
      };
    } else {
      reports.add((options.data as Map)['status'] as String);
    }
    return ResponseBody.fromString(
      jsonEncode(response),
      200,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

class _MetadataApi implements PackageDownloadApi {
  _MetadataApi(this.latest, this.required);
  final OfflinePackage latest;
  final OfflinePackage required;
  final requests = <int?>[];
  bool offline = false;
  @override
  Future<OfflinePackage> metadata(String tripId, {int? version}) async {
    requests.add(version);
    if (offline) {
      throw DioException(
        requestOptions: RequestOptions(path: '/metadata'),
        type: DioExceptionType.connectionError,
      );
    }
    return version == null ? latest : required;
  }

  @override
  Future<Response<ResponseBody>> bytes(
    OfflinePackage package,
    int offset,
    CancelToken cancel,
  ) => throw StateError('No transfer expected');
}

class _Capacity implements PackageStorageCapacity {
  @override
  Future<int> availableBytes() async => 100000000;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory root;
  late _Server server;
  late ApiClient api;
  final package = zipMetadata(packageZip());
  setUp(() async {
    FlutterSecureStorage.setMockInitialValues({});
    root = await Directory.systemTemp.createTemp('ctms306-policy-');
    server = _Server()..selectedId = package.id;
    api = ApiClient(TokenStorage(const FlutterSecureStorage()))
      ..dio.httpClientAdapter = server;
  });
  tearDown(() async {
    api.dio.close();
    await root.delete(recursive: true);
  });

  test(
    'activation replaces old publication flags with exact accepted candidate evidence',
    () async {
      final bytes = packageZip(version: 2);
      final next = zipMetadata(
        bytes,
        version: 2,
        id: '22222222-2222-4222-8222-222222222222',
      );
      server.versions.addAll({package.id: 1, next.id: 2});
      server.requiredId = next.id;
      final store = PackageDownloadStore(root);
      await store.archive(package).writeAsBytes(packageZip());
      await store.saveVerification(
        package,
        PackageVerificationStatus.verified,
        () {},
      );
      await store.saveActive(package, () {});
      await store.archive(next).writeAsBytes(bytes);
      await store.save(
        LocalPackageDownload(
          next,
          PackageDownloadStatus.downloaded,
          next.sizeBytes,
        ),
      );
      final downloader = PackageDownloader(
        _MetadataApi(next, next),
        store,
        _Capacity(),
      );
      final controller = PackageDownloadController(
        testTripId,
        () async => downloader,
        policy: () async => PackagePolicyClient(api, root),
      );
      await controller.load();
      expect(controller.active?.id, next.id);
      expect(controller.policy?.newerAvailable, isFalse);
      expect(controller.policy?.section('selected')['packageId'], next.id);
      expect(controller.policyOffline, isFalse);
      controller.dispose();
    },
  );

  test('required UUID/version wins over a different latest version', () async {
    final latest = zipMetadata(
      packageZip(version: 3),
      version: 3,
      id: '33333333-3333-4333-8333-333333333333',
    );
    server
      ..selectedId = latest.id
      ..selectedVersion = 3
      ..requiredId = package.id;
    final metadata = _MetadataApi(latest, package);
    final downloader = PackageDownloader(
      metadata,
      PackageDownloadStore(root),
      _Capacity(),
    );
    final controller = PackageDownloadController(
      testTripId,
      () async => downloader,
      policy: () async => PackagePolicyClient(api, root),
    );
    await controller.load();
    expect(controller.package?.id, package.id);
    expect(controller.package?.packageVersion, 1);
    expect(metadata.requests, [null, 1]);
    controller.dispose();
  });

  test(
    'metadata network failure marks cached policy as not revalidated',
    () async {
      final store = PackageDownloadStore(root);
      await store.archive(package).writeAsBytes(packageZip());
      await store.saveVerification(
        package,
        PackageVerificationStatus.verified,
        () {},
      );
      await store.saveActive(package, () {});
      final metadata = _MetadataApi(package, package);
      final client = PackagePolicyClient(api, root);
      final controller = PackageDownloadController(
        testTripId,
        () async => PackageDownloader(metadata, store, _Capacity()),
        policy: () async => client,
      );
      await controller.load();
      expect(controller.policyOffline, false);
      metadata.offline = true;
      await controller.load();
      expect(controller.policyOffline, true);
      expect(controller.policyError, 'Chưa xác thực lại với máy chủ.');
      expect(controller.policy, isNotNull);
      expect(controller.active?.id, package.id);
      controller.dispose();
    },
  );

  test(
    'offline queue survives restart and reports replay in order before local commit',
    () async {
      final first = PackagePolicyClient(api, root);
      server.offline = true;
      await expectLater(first.acceptActivation(package), throwsException);
      expect(
        await root.list().any(
          (file) => file.path.endsWith('activation-pending'),
        ),
        isTrue,
      );
      server.offline = false;
      final reopened = PackagePolicyClient(api, root);
      expect(await reopened.deviceId, await first.deviceId);
      await reopened.acceptActivation(package);
      await reopened.acceptActivation(package);
      expect(server.reports, [
        'downloaded',
        'verified',
        'active',
        'downloaded',
        'verified',
        'active',
      ]);
      await reopened.activationCommitted(package);
      expect(
        await root.list().any(
          (file) => file.path.endsWith('activation-pending'),
        ),
        isFalse,
      );
    },
  );
  test(
    'cached policy is scoped by account root, device and exact package',
    () async {
      final first = PackagePolicyClient(api, root);
      await first.context(package);
      final otherRoot = Directory('${root.path}/another-account');
      final other = PackagePolicyClient(api, otherRoot);
      expect(await other.cached(package), isNull);
      expect(await other.deviceId, isNot(await first.deviceId));
      expect(
        await first.cached(zipMetadata(packageZip(version: 2), version: 2)),
        isNull,
      );
    },
  );
  test(
    'account change stops queue reporting; forbidden never uses cached policy',
    () async {
      var current = true;
      final client = PackagePolicyClient(api, root, isCurrent: () => current);
      await client.context(package);
      server.denied = 403;
      await expectLater(client.context(package), throwsException);
      current = false;
      await expectLater(client.acceptActivation(package), throwsStateError);
      expect(server.reports, isEmpty);
    },
  );
}
