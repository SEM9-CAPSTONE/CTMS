import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/offline_packages/application/package_download_controller.dart';
import 'package:mobile/features/offline_packages/data/package_download_api.dart';
import 'package:mobile/features/offline_packages/data/package_download_store.dart';
import 'package:mobile/features/offline_packages/data/package_downloader.dart';
import 'package:mobile/features/offline_packages/data/package_integrity_service.dart';
import 'package:mobile/features/offline_packages/data/package_integrity_verifier.dart';
import 'package:mobile/features/offline_packages/data/package_storage_capacity.dart';
import 'package:mobile/features/offline_packages/domain/offline_package.dart';

import 'package_integrity_fixture.dart';

class _Capacity implements PackageStorageCapacity {
  @override
  Future<int> availableBytes() async => 100 * 1024 * 1024;
}

class _Api implements PackageDownloadApi {
  late OfflinePackage remote;
  late Uint8List content;
  final offsets = <int>[];
  int? interruptedAt;
  bool offline = false;
  bool denied = false;
  OfflinePackage? Function(int? version)? metadataOverride;

  @override
  Future<OfflinePackage> metadata(String tripId, {int? version}) async {
    final options = RequestOptions();
    if (offline) {
      throw DioException.connectionError(
        requestOptions: options,
        reason: 'offline',
      );
    }
    if (denied) {
      throw DioException.badResponse(
        statusCode: 404,
        requestOptions: options,
        response: Response(requestOptions: options, statusCode: 404),
      );
    }
    return metadataOverride?.call(version) ?? remote;
  }

  @override
  Future<Response<ResponseBody>> bytes(
    OfflinePackage package,
    int offset,
    CancelToken cancel,
  ) async {
    offsets.add(offset);
    final status = offset == 0 ? 200 : 206;
    final end = interruptedAt ?? content.length;
    Stream<Uint8List> stream() async* {
      yield Uint8List.sublistView(content, offset, end);
      if (interruptedAt != null) {
        throw DioException.connectionError(
          requestOptions: RequestOptions(),
          reason: 'offline',
        );
      }
    }

    return Response(
      requestOptions: RequestOptions(),
      statusCode: status,
      data: ResponseBody(stream(), status),
      headers: Headers.fromMap({
        'etag': [package.etag],
        'content-type': ['application/zip'],
        'content-length': ['${package.sizeBytes - offset}'],
        if (offset > 0)
          'content-range': [
            'bytes $offset-${package.sizeBytes - 1}/${package.sizeBytes}',
          ],
      }),
    );
  }
}

class _PausedVerifier extends PackageIntegrityVerifier {
  final entered = Completer<void>();
  final resume = Completer<void>();

  @override
  Future<Uint8List?> verify(
    OfflinePackage package,
    String path, {
    bool includeBytes = false,
  }) async {
    entered.complete();
    await resume.future;
    return super.verify(package, path, includeBytes: includeBytes);
  }
}

void main() {
  late Directory root;
  late _Api api;
  late PackageDownloadStore store;
  late PackageDownloader downloader;
  late PackageDownloadController controller;
  late Uint8List goodZip;

  setUp(() async {
    root = await Directory.systemTemp.createTemp('ctms223-integration-');
    goodZip = packageZip();
    api = _Api()
      ..remote = zipMetadata(goodZip)
      ..content = goodZip;
    store = PackageDownloadStore(root);
    downloader = PackageDownloader(api, store, _Capacity());
    controller = PackageDownloadController(testTripId, () async => downloader);
  });

  tearDown(() async {
    controller.dispose();
    await root.delete(recursive: true);
  });

  void reopen() {
    controller.dispose();
    downloader = PackageDownloader(
      api,
      PackageDownloadStore(root),
      _Capacity(),
    );
    controller = PackageDownloadController(testTripId, () async => downloader);
  }

  Future<void> seedCompleted() async {
    await store.save(
      LocalPackageDownload(api.remote, PackageDownloadStatus.downloading, 0),
    );
    await store.partial(api.remote).writeAsBytes(api.content);
    await store.complete(api.remote);
  }

  test('resumes at the saved 70% offset and verifies automatically', () async {
    final observed = <PackageVerificationStatus>[];
    controller.addListener(() {
      observed.add(controller.verification);
      if (controller.verification == PackageVerificationStatus.verifying) {
        expect(controller.active, isNull);
      }
    });
    await controller.load();
    final offset = (goodZip.length * .7).floor();
    api.interruptedAt = offset;
    await controller.start();
    expect(controller.local?.downloadedBytes, offset);
    expect(await controller.openActive(1), isNull);
    expect(observed, isNot(contains(PackageVerificationStatus.verifying)));
    api.interruptedAt = null;
    await controller.start();
    expect(api.offsets, [0, offset]);
    expect(observed, contains(PackageVerificationStatus.verifying));
    expect(controller.verification, PackageVerificationStatus.verified);
    expect(await controller.openActive(1), goodZip);
  });

  test(
    'checksum mismatch stays failed after reopen and redownload fetches fresh bytes',
    () async {
      api.content = Uint8List.fromList(goodZip)..[40] ^= 1;
      await controller.load();
      await controller.start();
      expect(controller.verification, PackageVerificationStatus.failed);
      expect(await controller.openActive(1), isNull);
      expect(await store.archive(api.remote).length(), goodZip.length);
      reopen();
      await controller.load();
      expect(controller.verification, PackageVerificationStatus.failed);
      api.content = goodZip;
      await controller.start();
      expect(api.offsets, [0, 0]);
      expect(await controller.openActive(1), goodZip);
    },
  );

  test('restart after completed transfer verifies and opens offline', () async {
    // Legacy CTMS-053 journals have no activation policy field.
    api.remote = zipMetadata(goodZip, activationAllowed: null);
    await seedCompleted();
    api.offline = true;
    reopen();
    await controller.load();
    expect(controller.verification, PackageVerificationStatus.verified);
    expect(await controller.openActive(1), goodZip);
    expect(await controller.openActive(2), isNull);
    expect(
      await PackageIntegrityService(store).openActive(otherTripId, 1),
      isNull,
    );
    final otherAccount = PackageDownloadStore(
      Directory('${root.path}/other-account'),
    );
    expect(
      await PackageIntegrityService(otherAccount).openActive(testTripId, 1),
      isNull,
    );
    expect(api.offsets, isEmpty);
  });

  test(
    'cancelling verification leaves no receipt and restart verifies again',
    () async {
      await seedCompleted();
      final verifier = _PausedVerifier();
      final cancel = CancelToken();
      final service = PackageIntegrityService(store, verifier: verifier);
      final pending = service.finalize(api.remote, cancel);
      final cancelled = expectLater(pending, throwsA(isA<DioException>()));
      await verifier.entered.future;
      cancel.cancel('disposed');
      verifier.resume.complete();
      await cancelled;
      expect(
        await store.verification(api.remote),
        PackageVerificationStatus.pending,
      );
      expect(await store.active(testTripId), isNull);
      api.offline = true;
      reopen();
      await controller.load();
      expect(await controller.openActive(1), goodZip);
    },
  );

  test(
    'disposing the controller while finalizing cannot publish verified',
    () async {
      await seedCompleted();
      // ChangeNotifier prohibits disposing from inside notifyListeners.
      final previous = controller;
      previous.addListener(() {
        if (previous.verification == PackageVerificationStatus.verifying) {
          scheduleMicrotask(reopen);
        }
      });
      await previous.load();
      expect(
        await store.verification(api.remote),
        PackageVerificationStatus.pending,
      );
      expect(await store.active(testTripId), isNull);
      api.offline = true;
      await controller.load();
      expect(await controller.openActive(1), goodZip);
    },
  );

  test(
    'wrong replacement preserves the prior active ZIP after failure and restart',
    () async {
      await controller.load();
      await controller.start();
      api.content = packageZip(version: 9);
      api.remote = zipMetadata(api.content, version: 2);
      await controller.load();
      await controller.start();
      expect(controller.verification, PackageVerificationStatus.failed);
      expect(await controller.openActive(1), goodZip);
      expect(await controller.openActive(2), isNull);
      api.offline = true;
      reopen();
      await controller.load();
      expect(controller.active?.packageVersion, 1);
      expect(await controller.openActive(1), goodZip);
    },
  );

  test(
    'a Trip that starts during transfer retains the locked active version',
    () async {
      await controller.load();
      await controller.start();
      api.content = packageZip(version: 2);
      api.remote = zipMetadata(api.content, version: 2);
      var exactLookups = 0;
      api.metadataOverride = (version) {
        if (version != 2 || ++exactLookups == 1) return null;
        return zipMetadata(api.content, version: 2, activationAllowed: false);
      };
      await controller.load();
      await controller.start();
      expect(exactLookups, 2);
      expect(controller.verification, PackageVerificationStatus.verified);
      expect(controller.active?.packageVersion, 1);
      expect(await controller.openActive(1), goodZip);
      expect(await controller.openActive(2), isNull);
    },
  );

  test(
    'a valid replacement activates before departure while retaining prior bytes',
    () async {
      final original = api.remote;
      await controller.load();
      await controller.start();
      api.content = packageZip(version: 2);
      api.remote = zipMetadata(api.content, version: 2);
      await controller.load();
      await controller.start();
      expect(controller.active?.packageVersion, 2);
      expect(await controller.openActive(2), api.content);
      expect(await controller.openActive(1), isNull);
      expect(await store.archive(original).readAsBytes(), goodZip);
    },
  );

  test(
    'the old version opens while replacement authorization is pending',
    () async {
      await controller.load();
      await controller.start();
      api.content = packageZip(version: 2);
      api.remote = zipMetadata(api.content, version: 2);
      await seedCompleted();
      final entered = Completer<void>();
      final approval = Completer<OfflinePackage>();
      final replacement = PackageIntegrityService(store).finalize(
        api.remote,
        CancelToken(),
        authorizeReplacement: () {
          entered.complete();
          return approval.future;
        },
      );
      await entered.future;
      try {
        expect(
          await controller.openActive(1).timeout(const Duration(seconds: 3)),
          goodZip,
        );
      } finally {
        approval.complete(
          zipMetadata(api.content, version: 2, id: otherTripId),
        );
      }
      expect(await replacement, (PackageVerificationStatus.verified, false));
      expect(await controller.openActive(2), isNull);
    },
  );

  test(
    'gate rejects same-size replacement even with a verified journal',
    () async {
      await controller.load();
      await controller.start();
      final changed = Uint8List.fromList(goodZip)..[40] ^= 1;
      await store.archive(api.remote).writeAsBytes(changed);
      expect(await controller.openActive(1), isNull);
      expect(controller.verification, PackageVerificationStatus.failed);
    },
  );

  test(
    'a candidate damaged while awaiting approval leaves the old version active',
    () async {
      await controller.load();
      await controller.start();
      api.content = packageZip(version: 2);
      api.remote = zipMetadata(api.content, version: 2);
      await seedCompleted();
      final candidate = api.remote;
      final result = await PackageIntegrityService(store).finalize(
        candidate,
        CancelToken(),
        authorizeReplacement: () async {
          final damaged = Uint8List.fromList(api.content)..[40] ^= 1;
          await store.archive(candidate).writeAsBytes(damaged);
          return candidate;
        },
      );
      expect(result, (PackageVerificationStatus.failed, false));
      expect(await controller.openActive(1), goodZip);
      expect(await controller.openActive(2), isNull);
    },
  );

  test('gate rejects missing active ZIP on offline startup', () async {
    await controller.load();
    await controller.start();
    await store.archive(api.remote).delete();
    api.offline = true;
    reopen();
    await controller.load();
    expect(controller.verification, PackageVerificationStatus.failed);
    expect(controller.active, isNull);
    expect(await controller.openActive(1), isNull);
  });

  test(
    'a known access denial prevents first activation of a complete ZIP',
    () async {
      await seedCompleted();
      await store.setAccessDenied(testTripId, true);
      final integrity = PackageIntegrityService(store);

      expect(await integrity.finalize(api.remote, CancelToken()), (
        PackageVerificationStatus.verified,
        false,
      ));
      expect(await store.active(testTripId), isNull);
      expect(await integrity.openActive(testTripId, 1), isNull);

      await controller.load();
      expect(await controller.openActive(1), goodZip);
    },
  );

  test(
    'authorization denial blocks active access and survives offline restart',
    () async {
      await controller.load();
      await controller.start();
      api.denied = true;
      await controller.load();
      expect(await controller.openActive(1), isNull);
      expect(await store.archive(api.remote).exists(), isTrue);
      api.offline = true;
      reopen();
      await controller.load();
      expect(await controller.openActive(1), isNull);
      api.offline = false;
      api.denied = false;
      await controller.load();
      expect(await controller.openActive(1), goodZip);
    },
  );

  test(
    'denied resume does not fetch bytes or verify the partial archive',
    () async {
      await controller.load();
      api.interruptedAt = 20;
      await controller.start();
      api.denied = true;
      await controller.start();
      expect(api.offsets, [0]);
      expect(await store.partial(api.remote).length(), 20);
      expect(
        await store.verification(api.remote),
        PackageVerificationStatus.pending,
      );
      expect(await controller.openActive(1), isNull);
    },
  );
}
