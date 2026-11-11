import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/features/offline_packages/data/package_download_api.dart';
import 'package:mobile/features/offline_packages/data/package_download_errors.dart';
import 'package:mobile/features/offline_packages/data/package_download_store.dart';
import 'package:mobile/features/offline_packages/data/package_downloader.dart';
import 'package:mobile/features/offline_packages/data/package_storage_capacity.dart';
import 'package:mobile/features/offline_packages/domain/offline_package.dart';

const tripId = 'a1736fee-62be-4991-9478-a62288e9b80a';
OfflinePackage fixture({int version = 1, String? sha}) => OfflinePackage(
  id: 'a1736fee-62be-4991-9478-a62288e9b80b',
  tripId: tripId,
  packageVersion: version,
  sha256: sha ?? List.filled(64, 'a').join(),
  sizeBytes: 10,
  generatedAt: DateTime.utc(2026, 11, 8),
);
final payload = List.generate(10, (index) => index);

class FakeCapacity implements PackageStorageCapacity {
  int available = 100 * 1024 * 1024;
  int calls = 0;
  bool fullAtCompletion = false;
  @override
  Future<int> availableBytes() async {
    calls++;
    return fullAtCompletion && calls > 1 ? 0 : available;
  }
}

class FakeApi implements PackageDownloadApi {
  OfflinePackage remote = fixture();
  final offsets = <int>[];
  int authorizations = 0;
  bool deny = false;
  bool ignoreRange = false;
  bool interrupt = false;
  bool badEtag = false;
  bool shortBody = false;
  bool overlong = false;
  bool badRange = false;
  @override
  Future<OfflinePackage> metadata(String tripId, {int? version}) async {
    authorizations++;
    if (deny) {
      throw DioException(
        requestOptions: RequestOptions(),
        response: Response(requestOptions: RequestOptions(), statusCode: 404),
      );
    }
    return remote;
  }

  @override
  Future<Response<ResponseBody>> bytes(
    OfflinePackage package,
    int offset,
    CancelToken cancel,
  ) async {
    offsets.add(offset);
    final start = ignoreRange ? 0 : offset;
    final status = start == package.sizeBytes
        ? 416
        : start > 0
        ? 206
        : 200;
    final content = payload.sublist(start);
    Stream<Uint8List> stream() async* {
      if (content.isNotEmpty) {
        yield Uint8List.fromList(
          content.take(interrupt || shortBody ? 4 : content.length).toList(),
        );
      }
      if (interrupt) {
        throw DioException(
          requestOptions: RequestOptions(),
          type: DioExceptionType.connectionError,
        );
      }
      if (overlong) yield Uint8List.fromList([99]);
    }

    return Response(
      requestOptions: RequestOptions(),
      statusCode: status,
      data: ResponseBody(stream(), status),
      headers: Headers.fromMap({
        'etag': [badEtag ? '"other"' : package.etag],
        'content-type': ['application/zip'],
        'content-length': ['${package.sizeBytes - start}'],
        if (status == 206)
          'content-range': [badRange ? 'bytes 0-9/10' : 'bytes $start-9/10'],
        if (status == 416) 'content-range': ['bytes */10'],
      }),
    );
  }
}

void main() {
  late Directory root;
  late FakeApi api;
  late FakeCapacity capacity;
  late PackageDownloadStore store;
  late PackageDownloader downloader;
  setUp(() async {
    final base = await Directory(
      '${Directory.current.path}/test-results/ctms53',
    ).create(recursive: true);
    root = await base.createTemp('transfer-');
    api = FakeApi();
    capacity = FakeCapacity();
    store = PackageDownloadStore(root);
    downloader = PackageDownloader(api, store, capacity);
  });
  tearDown(() async {
    await root.delete(recursive: true);
  });

  Future<LocalPackageDownload> start({
    CancelToken? cancel,
    void Function(LocalPackageDownload)? onProgress,
  }) => downloader.download(
    fixture(),
    cancel ?? CancelToken(),
    onProgress ?? (_) {},
  );

  test(
    'complete transfer reports byte progress and remains DOWNLOADED only',
    () async {
      final progress = <int>[];
      final result = await start(
        onProgress: (state) => progress.add(state.downloadedBytes),
      );
      expect(result.status, PackageDownloadStatus.downloaded);
      expect(result.progress, 1);
      expect(await store.archive(fixture()).readAsBytes(), payload);
      expect(progress.last, 10);
      expect(capacity.calls, greaterThanOrEqualTo(2));
      expect(
        PackageDownloadStatus.values.map((s) => s.name),
        isNot(contains('active')),
      );
    },
  );

  test(
    'network interruption survives a new downloader/store and resumes actual file length',
    () async {
      api.interrupt = true;
      await expectLater(start(), throwsA(isA<DioException>()));
      expect(await store.partial(fixture()).length(), 4);
      api.interrupt = false;
      downloader = PackageDownloader(api, PackageDownloadStore(root), capacity);
      final result = await start();
      expect(result.status, PackageDownloadStatus.downloaded);
      expect(api.offsets, [0, 4]);
      expect(api.authorizations, 2);
      expect(await store.archive(fixture()).readAsBytes(), payload);
    },
  );

  test(
    'recovery disregards persisted byte counters and DOWNLOADING marker',
    () async {
      await store.save(
        LocalPackageDownload(fixture(), PackageDownloadStatus.downloading, 9),
      );
      await store
          .partial(fixture())
          .writeAsBytes(payload.take(3).toList(), flush: true);
      final recovered = (await store.forTrip(tripId)).single;
      expect(recovered.downloadedBytes, 3);
      expect(recovered.status, PackageDownloadStatus.interrupted);
      await start();
      expect(api.offsets, [3]);
    },
  );

  test('insufficient space prevents transport and completion', () async {
    capacity.available = 1;
    await expectLater(start(), throwsA(isA<PackageStorageException>()));
    expect(api.offsets, isEmpty);
    expect(await store.archive(fixture()).exists(), false);
  });

  test(
    'storage is checked again at completion; complete .part recovers through authorized 416',
    () async {
      capacity.fullAtCompletion = true;
      await expectLater(start(), throwsA(isA<PackageStorageException>()));
      expect(await store.archive(fixture()).exists(), false);
      expect(await store.partial(fixture()).length(), 10);
      capacity.fullAtCompletion = false;
      await start();
      expect(api.offsets, [0, 10]);
      expect(await store.archive(fixture()).readAsBytes(), payload);
    },
  );

  test(
    'a server ignoring Range restarts from zero without concatenating',
    () async {
      await store.partial(fixture()).writeAsBytes(payload.take(4).toList());
      api.ignoreRange = true;
      await start();
      expect(api.offsets, [4]);
      expect(await store.archive(fixture()).readAsBytes(), payload);
    },
  );

  test('a full 200 restart checks space for the full replacement', () async {
    await store.partial(fixture()).writeAsBytes(payload.take(4).toList());
    api.ignoreRange = true;
    capacity.available = PackageDownloader.storageReserve + 6;
    await expectLater(start(), throwsA(isA<PackageStorageException>()));
    expect(await store.partial(fixture()).length(), 4);
    expect(await store.archive(fixture()).exists(), false);
  });

  test(
    'changed digest in authenticated metadata cannot be appended to previous file',
    () async {
      await store.partial(fixture()).writeAsBytes([1, 2, 3]);
      api.remote = fixture(sha: List.filled(64, 'b').join());
      await expectLater(start(), throwsFormatException);
      expect(api.offsets, isEmpty);
      expect(await store.partial(fixture()).readAsBytes(), [1, 2, 3]);
    },
  );

  test('wrong response ETag never writes a byte', () async {
    api.badEtag = true;
    await expectLater(start(), throwsFormatException);
    expect(await store.archive(fixture()).exists(), false);
    expect(await store.partial(fixture()).exists(), false);
  });

  test('wrong Content-Range never appends to a partial', () async {
    await store.partial(fixture()).writeAsBytes([0, 1, 2]);
    api.badRange = true;
    await expectLater(start(), throwsFormatException);
    expect(await store.partial(fixture()).readAsBytes(), [0, 1, 2]);
  });

  test(
    'revoked participation rejects resume without touching local bytes',
    () async {
      await store.partial(fixture()).writeAsBytes([0, 1, 2]);
      api.deny = true;
      await expectLater(start(), throwsA(isA<DioException>()));
      expect(api.offsets, isEmpty);
      expect(await store.partial(fixture()).length(), 3);
    },
  );

  test('short and overlong responses never become completed', () async {
    api.shortBody = true;
    await expectLater(start(), throwsFormatException);
    expect(await store.archive(fixture()).exists(), false);
    api.shortBody = false;
    api.overlong = true;
    await expectLater(start(), throwsFormatException);
    expect(await store.archive(fixture()).exists(), false);
  });

  test('pause preserves bytes and retry resumes', () async {
    final cancel = CancelToken();
    await expectLater(
      start(cancel: cancel, onProgress: (_) => cancel.cancel()),
      throwsA(isA<DioException>()),
    );
    expect(await store.archive(fixture()).exists(), false);
    await start();
    expect(api.offsets, [0, 10]);
  });

  test('atomic rename recovery does not require a completed journal', () async {
    await store.save(
      LocalPackageDownload(fixture(), PackageDownloadStatus.downloading, 4),
    );
    await store.archive(fixture()).writeAsBytes(payload);
    final recovered = (await store.forTrip(tripId)).single;
    expect(recovered.status, PackageDownloadStatus.downloaded);
    expect(recovered.downloadedBytes, 10);
  });

  test('newer version keeps old downloaded archive and its metadata', () async {
    await start();
    final newer = fixture(version: 2);
    api.remote = newer;
    await downloader.download(newer, CancelToken(), (_) {});
    expect(await store.archive(fixture()).readAsBytes(), payload);
    expect(
      (await store.forTrip(tripId)).map((item) => item.package.packageVersion),
      [2, 1],
    );
  });

  test('account and Trip namespaces do not share download state', () async {
    await start();
    final otherAccount = PackageDownloadStore(
      Directory('${root.path}/another-account'),
    );
    expect(await otherAccount.forTrip(tripId), isEmpty);
    expect(
      await store.forTrip('a1736fee-62be-4991-9478-a62288e9b80c'),
      isEmpty,
    );
  });

  test('parallel retries cannot write the same partial concurrently', () async {
    final first = start();
    await expectLater(start(), throwsStateError);
    await first;
    expect(api.offsets, [0]);
  });

  test(
    'untrusted metadata rejects unsupported schema and unsafe identities',
    () {
      expect(
        () => OfflinePackage.fromJson({
          ...fixture().toJson(),
          'schemaVersion': 2,
        }),
        throwsFormatException,
      );
      expect(
        () =>
            OfflinePackage.fromJson({...fixture().toJson(), 'id': '../escape'}),
        throwsFormatException,
      );
      expect(
        () => OfflinePackage.fromJson({
          ...fixture().toJson(),
          'sizeBytes': OfflinePackage.maxBytes + 1,
        }),
        throwsFormatException,
      );
    },
  );

  for (final kind in ApiExceptionKind.values) {
    test('connectivity retry classifies metadata failure $kind', () {
      final error = ApiException('metadata failed', kind: kind);
      expect(
        isPackageDownloadNetworkFailure(error),
        kind == ApiExceptionKind.network || kind == ApiExceptionKind.timeout,
      );
    });
  }

  for (final type in [
    DioExceptionType.connectionError,
    DioExceptionType.connectionTimeout,
    DioExceptionType.sendTimeout,
    DioExceptionType.receiveTimeout,
  ]) {
    test('connectivity retry accepts interrupted byte transport $type', () {
      expect(
        isPackageDownloadNetworkFailure(
          DioException(requestOptions: RequestOptions(), type: type),
        ),
        isTrue,
      );
    });
  }

  test(
    'reconnection cannot retry cancellation, revoked access or invalid bytes',
    () {
      final cancel = CancelToken()..cancel('paused');
      for (final error in <Object>[
        cancel.cancelError!,
        ApiException(
          'revoked',
          statusCode: 404,
          kind: ApiExceptionKind.response,
        ),
        DioException(
          requestOptions: RequestOptions(),
          type: DioExceptionType.badResponse,
          response: Response(requestOptions: RequestOptions(), statusCode: 404),
        ),
        DioException(
          requestOptions: RequestOptions(),
          type: DioExceptionType.badCertificate,
        ),
        const FormatException('wrong package identity'),
        const PackageStorageException('disk full'),
      ]) {
        expect(isPackageDownloadNetworkFailure(error), isFalse);
      }
    },
  );
}
