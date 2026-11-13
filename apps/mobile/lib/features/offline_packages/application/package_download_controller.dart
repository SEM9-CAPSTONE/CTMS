import 'dart:async';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_exception.dart';
import '../../auth/application/auth_controller.dart';
import '../data/dio_package_download_api.dart';
import '../data/device_package_storage_capacity.dart';
import '../data/package_download_errors.dart';
import '../data/package_download_store.dart';
import '../data/package_downloader.dart';
import '../data/package_integrity_service.dart';
import '../data/package_storage_capacity.dart';
import '../data/offline_basemap_store.dart';
import '../domain/offline_package.dart';
import '../domain/package_policy.dart';
import '../data/package_policy_client.dart';

final offlinePackageAccountProvider = Provider<String?>((ref) {
  return ref.watch(
    authControllerProvider.select(
      (state) => state.isLoading ? null : state.asData?.value?.id,
    ),
  );
});

final packageDownloadStoreProvider =
    FutureProvider.autoDispose<PackageDownloadStore?>((ref) async {
      final userId = ref.watch(offlinePackageAccountProvider);
      if (userId == null) return null;
      final directory = await getApplicationSupportDirectory();
      return PackageDownloadStore(
        Directory('${directory.path}/offline-packages/$userId'),
      );
    });

final packageDownloaderProvider = FutureProvider.autoDispose<PackageDownloader>(
  (ref) async {
    final api = DioPackageDownloadApi(ref.watch(apiClientProvider));
    final store = await ref.watch(packageDownloadStoreProvider.future);
    if (store == null) throw StateError('Vui lòng đăng nhập lại.');
    return PackageDownloader(api, store, DevicePackageStorageCapacity());
  },
);

final packageDownloadControllerProvider = ChangeNotifierProvider.autoDispose
    .family<PackageDownloadController, String>((ref, tripId) {
      ref.watch(offlinePackageAccountProvider);
      final downloader = ref.watch(packageDownloaderProvider.future);
      final basemaps = ref.watch(offlineBasemapStoreProvider.future);
      final api = ref.watch(apiClientProvider);
      var accountCurrent = true;
      ref.onDispose(() => accountCurrent = false);
      Future<PackagePolicyClient>? policy;
      Future<PackagePolicyClient> policyClient() => policy ??= () async {
        final store = await ref.read(packageDownloadStoreProvider.future);
        if (store == null) throw StateError('Vui lòng đăng nhập lại.');
        return PackagePolicyClient(
          api,
          store.root,
          isCurrent: () => accountCurrent,
        );
      }();
      final controller = PackageDownloadController(
        tripId,
        () => downloader,
        basemaps: () => basemaps,
        policy: policyClient,
      );
      final connectivity = Connectivity().onConnectivityChanged.listen((
        results,
      ) {
        if (results.any((result) => result != ConnectivityResult.none)) {
          controller.onReconnected();
        }
      });
      ref.onDispose(() => unawaited(connectivity.cancel()));
      final lifecycle = _PackagePolicyLifecycle(
        () => unawaited(controller.load()),
      );
      WidgetsBinding.instance.addObserver(lifecycle);
      final timer = Timer.periodic(
        const Duration(seconds: 60),
        (_) => unawaited(controller.load()),
      );
      ref.onDispose(() {
        timer.cancel();
        WidgetsBinding.instance.removeObserver(lifecycle);
      });
      unawaited(controller.load());
      return controller;
    });

class PackageDownloadController extends ChangeNotifier {
  PackageDownloadController(
    this.tripId,
    this._downloader, {
    Future<OfflineBasemapStore> Function()? basemaps,
    Future<PackagePolicyClient> Function()? policy,
  }) : _basemaps = basemaps,
       _policy = policy;
  final Future<PackagePolicyClient> Function()? _policy;
  PackagePolicy? policy;
  bool policyOffline = false;
  bool awaitingActivation = false;
  String? policyError;
  bool confirmingDeparture = false;
  String? departureMessage;
  bool get replacementLocked => policy != null && !policy!.replaceAllowed;
  bool get activeMatchesTripLock =>
      active != null &&
      policy?.lockedId != null &&
      active!.id == policy!.lockedId;

  Future<void> _refreshPolicy(OfflinePackage selected) async {
    if (_policy == null || _disposed) return;
    final client = await _policy();
    try {
      final current = await client.context(selected);
      if (_disposed) return;
      policy = current;
      policyOffline = false;
      policyError = null;
    } catch (failure) {
      if (_disposed) return;
      policyOffline = isPackageDownloadNetworkFailure(failure);
      policy = policyOffline ? await client.cached(selected) : null;
      policyError = policyOffline
          ? 'Chưa xác thực lại với máy chủ.'
          : 'Không thể kiểm tra chính sách gói. Vui lòng kiểm tra quyền truy cập.';
      if (!policyOffline) {
        rethrow;
      }
    }
  }

  Future<void> confirmDeparture() async {
    final selected = active;
    if (_disposed ||
        confirmingDeparture ||
        selected == null ||
        policy?.hasRequirement != true ||
        replacementLocked ||
        policyOffline) {
      return;
    }
    confirmingDeparture = true;
    departureMessage = null;
    _emit();
    try {
      final client = await _policy!();
      final downloader = await _downloader();
      final valid = await PackageIntegrityService(
        downloader.store,
      ).activePackage(tripId, CancelToken());
      if (valid?.sameArtifact(selected) != true || _disposed) return;
      await client.acceptActivation(selected);
      await client.confirm(selected);
      await client.activationCommitted(selected);
      if (!_disposed) departureMessage = 'Đã xác nhận thiết bị sẵn sàng.';
    } catch (_) {
      if (!_disposed) {
        departureMessage = 'Chưa xác nhận được thiết bị. Vui lòng thử lại.';
      }
    } finally {
      confirmingDeparture = false;
      _emit();
    }
  }

  final Future<OfflineBasemapStore> Function()? _basemaps;
  bool basemapReady = false;
  bool downloadingBasemap = false;
  double basemapProgress = 0;
  String? basemapError;
  String? basemapPackageId;
  bool get readyForOffline =>
      active != null && basemapReady && basemapPackageId == active!.id;
  final String tripId;
  final Future<PackageDownloader> Function() _downloader;
  bool loading = true;
  bool downloading = false;
  bool storageBlocked = false;
  bool _disposed = false;
  bool _accessDenied = false;
  bool _resumeWhenOnline = false;
  bool _reloadWhenOnline = false;
  String? _tripTitle;
  CancelToken? _cancel;
  OfflinePackage? package;
  LocalPackageDownload? local;
  OfflinePackage? active;
  PackageVerificationStatus verification = PackageVerificationStatus.pending;
  String? error;

  void _emit() {
    if (!_disposed) notifyListeners();
  }

  Future<void> load() async {
    if (_disposed || _cancel != null) return;
    final cancel = _cancel = CancelToken();
    loading = true;
    storageBlocked = false;
    _reloadWhenOnline = false;
    error = null;
    _emit();
    try {
      final downloader = await _downloader();
      final store = downloader.store;
      final integrity = PackageIntegrityService(store);
      _accessDenied = await store.accessDenied(tripId);
      if (!_accessDenied && !cancel.isCancelled) {
        final versions = await store.forTrip(tripId);
        final pinned = await store.active(tripId);
        final candidate = versions.firstOrNull?.package ?? pinned;
        active = pinned != null && candidate?.sameArtifact(pinned) != true
            ? await integrity.activePackage(tripId, cancel)
            : null;
        if (_policy != null && (pinned ?? candidate) != null) {
          policy = await (await _policy()).cached((pinned ?? candidate)!);
          policyOffline = true;
        }
        await _restoreCandidate(downloader, candidate, cancel);
        _emit();
      }
      if (cancel.isCancelled) return;
      try {
        var remote = await downloader.api.metadata(tripId);
        await _refreshPolicy(active ?? remote);
        final requiredVersion = policy?.requiredVersion;
        if (policy?.updateRequired == true &&
            requiredVersion != null &&
            !replacementLocked) {
          remote = await downloader.api.metadata(
            tripId,
            version: requiredVersion,
          );
          if (remote.id != policy!.requiredId) {
            throw const FormatException('Gói bắt buộc không khớp.');
          }
        }
        if (replacementLocked && active != null) remote = active!;
        if (cancel.isCancelled) return;
        if (_accessDenied) {
          await store.setAccessDenied(tripId, false);
          _accessDenied = false;
          active = await integrity.activePackage(tripId, cancel);
        }
        final sameCandidate = package?.sameArtifact(remote) == true;
        if (!sameCandidate ||
            (verification == PackageVerificationStatus.verified &&
                active?.sameArtifact(remote) != true &&
                remote.activationAllowed == true)) {
          await _restoreCandidate(downloader, remote, cancel, online: true);
        } else {
          package = remote;
        }
      } catch (failure) {
        if (!cancel.isCancelled) {
          _reloadWhenOnline = isPackageDownloadNetworkFailure(failure);
          await _handleFailure(downloader, failure);
        }
      }
    } catch (failure) {
      if (!cancel.isCancelled) error = downloadErrorMessage(failure);
    } finally {
      if (!cancel.isCancelled && active != null && _basemaps != null) {
        try {
          basemapReady =
              await (await _basemaps()).verifiedPath(active!) != null;
          basemapPackageId = basemapReady ? active!.id : null;
        } catch (_) {
          basemapReady = false;
        }
      }
      loading = false;
      _cancel = null;
      _emit();
    }
  }

  Future<void> _restoreCandidate(
    PackageDownloader downloader,
    OfflinePackage? candidate,
    CancelToken cancel, {
    bool online = false,
  }) async {
    if (cancel.isCancelled) return;
    package = candidate;
    verification = PackageVerificationStatus.pending;
    local = candidate == null
        ? null
        : await downloader.store.recover(candidate);
    if (candidate == null || cancel.isCancelled) return;
    final stored = await downloader.store.verification(candidate);
    if (stored == PackageVerificationStatus.failed) {
      verification = stored;
      if (active?.sameArtifact(candidate) == true) active = null;
    } else if (stored == PackageVerificationStatus.verified ||
        await downloader.store.hasCompletedTransfer(candidate)) {
      await _finalize(downloader, candidate, cancel, online: online);
    }
  }

  Future<void> start({String? tripTitle}) async {
    final target = package?.activationAllowed == false && active != null
        ? active
        : package;
    if (_disposed ||
        _cancel != null ||
        loading ||
        _accessDenied ||
        replacementLocked ||
        target == null) {
      return;
    }
    if (tripTitle != null && tripTitle.trim().isNotEmpty) {
      _tripTitle = tripTitle.trim();
    }
    downloading = true;
    storageBlocked = false;
    if (verification == PackageVerificationStatus.failed) local = null;
    verification = PackageVerificationStatus.pending;
    error = null;
    _resumeWhenOnline = false;
    final cancel = _cancel = CancelToken();
    _emit();
    PackageDownloader? downloader;
    try {
      downloader = await _downloader();
      if (cancel.isCancelled) return;
      if (active?.sameArtifact(target) == true &&
          verification != PackageVerificationStatus.failed) {
        verification = PackageVerificationStatus.verified;
        await _downloadBasemap(target, cancel);
        return;
      }
      local = await downloader.download(target, cancel, (progress) {
        if (cancel.isCancelled) return;
        local = progress;
        _emit();
      });
      final pinned = local!.package;
      package = pinned;
      downloading = false;
      if (!cancel.isCancelled) {
        await _finalize(downloader, pinned, cancel, online: true);
        if (active?.sameArtifact(pinned) == true && !cancel.isCancelled) {
          await _downloadBasemap(pinned, cancel);
        }
      }
    } catch (failure) {
      storageBlocked =
          failure is PackageStorageException ||
          failure is FileSystemException ||
          failure is MissingPluginException ||
          failure is PlatformException;
      if (downloader != null && !cancel.isCancelled) {
        await _handleFailure(downloader, failure);
      } else if (cancel.isCancelled && !_disposed) {
        error = 'Đã tạm dừng.';
      } else if (!cancel.isCancelled) {
        error = downloadErrorMessage(failure);
      }
      _resumeWhenOnline =
          downloading &&
          !cancel.isCancelled &&
          isPackageDownloadNetworkFailure(failure);
      if (downloader != null && !_disposed && !_accessDenied) {
        try {
          local = await downloader.store.recover(target);
          if (downloading) {
            verification = await downloader.store.verification(target);
          }
        } on FileSystemException {
          // Keep the original transfer error.
        }
      }
    } finally {
      downloading = false;
      downloadingBasemap = false;
      _cancel = null;
      _emit();
    }
  }

  Future<void> _downloadBasemap(
    OfflinePackage target,
    CancelToken cancel,
  ) async {
    if (_basemaps == null) return;
    downloading = true;
    downloadingBasemap = true;
    basemapError = null;
    basemapReady = false;
    basemapProgress = 0;
    _emit();
    try {
      final store = await _basemaps();
      await store.download(target, cancel, (value) {
        basemapProgress = value;
        _emit();
      });
      if (cancel.isCancelled || _disposed) return;
      basemapReady = await store.verifiedPath(target) != null;
      basemapPackageId = basemapReady ? target.id : null;
      if (!basemapReady) {
        throw const FormatException('Nền bản đồ chưa được xác thực.');
      }
    } catch (e) {
      if (cancel.isCancelled) {
        basemapError = 'Đã tạm dừng tải nền bản đồ.';
        return;
      }
      final code = _downloadStatus(e);
      _resumeWhenOnline = isPackageDownloadNetworkFailure(e);
      basemapError = code == 409
          ? 'Nền bản đồ của chuyến đi chưa sẵn sàng. Vui lòng thử lại sau.'
          : e is FormatException
          ? e.message
          : e is PackageStorageException
          ? e.message
          : 'Không tải được nền bản đồ. Kiểm tra kết nối rồi thử lại.';
      // Reuse the core denial flow so the map reader fails closed as well.
      if (_deniesAccess(e)) rethrow;
    }
  }

  Future<void> _finalize(
    PackageDownloader downloader,
    OfflinePackage candidate,
    CancelToken cancel, {
    required bool online,
  }) async {
    verification = PackageVerificationStatus.verifying;
    _emit();
    try {
      final (
        result,
        activated,
      ) = await PackageIntegrityService(downloader.store).finalize(
        candidate,
        cancel,
        tripTitle: _tripTitle,
        acceptActivation: _policy == null
            ? null
            : (selected) async {
                awaitingActivation = true;
                _emit();
                await (await _policy()).acceptActivation(selected);
                if (_disposed) cancel.cancel('account changed');
              },
        allowActivation: _policy == null || online,
        authorizeReplacement: online && candidate.activationAllowed == true
            ? () => _authorizeReplacement(downloader, candidate, cancel)
            : null,
      );
      if (cancel.isCancelled || _accessDenied) return;
      verification = result;
      if (_policy != null &&
          result == PackageVerificationStatus.verified &&
          !activated) {
        awaitingActivation = true;
      }
      if (activated) {
        active = candidate;
        awaitingActivation = false;
        if (_policy != null) {
          final client = await _policy();
          await client.activationCommitted(candidate);
          // acceptActivation cached evidence for this exact candidate before
          // reporting. Do not keep the old active package's publication flags.
          final acceptedPolicy = await client.cached(candidate);
          if (!_disposed && acceptedPolicy != null) {
            policy = acceptedPolicy;
            policyOffline = false;
            policyError = null;
          }
        }
      }
      if (result == PackageVerificationStatus.failed &&
          active?.sameArtifact(candidate) == true) {
        active = null;
      }
    } catch (failure) {
      if (!cancel.isCancelled) {
        verification = await downloader.store.verification(candidate);
        final network = isPackageDownloadNetworkFailure(failure);
        awaitingActivation =
            network && verification == PackageVerificationStatus.verified;
        _reloadWhenOnline = network;
        if (network && _policy != null) {
          policyOffline = true;
          policy = await (await _policy()).cached(candidate);
          policyError = 'Chưa xác thực lại với máy chủ.';
          return;
        }
      }
      rethrow;
    }
  }

  Future<OfflinePackage?> _authorizeReplacement(
    PackageDownloader downloader,
    OfflinePackage candidate,
    CancelToken cancel,
  ) async {
    try {
      // Refresh only activation policy, after the local check. A Trip may
      // have started since the transfer was authorized.
      return await downloader.api.metadata(
        tripId,
        version: candidate.packageVersion,
      );
    } catch (failure) {
      if (!cancel.isCancelled) {
        _reloadWhenOnline = isPackageDownloadNetworkFailure(failure);
        if (_deniesAccess(failure)) await _handleFailure(downloader, failure);
      }
      return null;
    }
  }

  Future<void> _handleFailure(
    PackageDownloader downloader,
    Object failure,
  ) async {
    error = downloadErrorMessage(failure);
    if (isPackageDownloadNetworkFailure(failure) && _policy != null) {
      final selected = package ?? active;
      policyOffline = true;
      policyError = 'Chưa xác thực lại với máy chủ.';
      policy = selected == null
          ? null
          : await (await _policy()).cached(selected);
    }
    if (_deniesAccess(failure)) {
      policy = null;
      policyOffline = false;
      policyError = null;
      awaitingActivation = false;
      departureMessage = null;
      basemapReady = false;
      basemapPackageId = null;
      if (_basemaps != null) {
        try {
          await (await _basemaps()).purge(tripId);
        } catch (_) {
          /* Core denial remains authoritative. */
        }
      }
      _accessDenied = true;
      active = null;
      package = null;
      local = null;
      verification = PackageVerificationStatus.pending;
      try {
        await downloader.store.setAccessDenied(tripId, true);
      } on FileSystemException {
        // The current controller still fails closed.
      }
    }
  }

  /// Read only the active, exact version for this authenticated account.
  /// CTMS-224 can pass the checked ZIP to its offline reader.
  Future<Uint8List?> openActive(int version) async {
    if (_disposed || _accessDenied) return null;
    final downloader = await _downloader();
    final bytes = await PackageIntegrityService(
      downloader.store,
    ).openActive(tripId, version);
    if (_disposed || _accessDenied) return null;
    if (bytes == null && active?.packageVersion == version) {
      final lost = active!;
      active = null;
      if (package?.sameArtifact(lost) == true &&
          await downloader.store.verification(lost) ==
              PackageVerificationStatus.failed) {
        verification = PackageVerificationStatus.failed;
      }
      _emit();
    }
    return bytes;
  }

  void pause() {
    _resumeWhenOnline = false;
    if (downloading) _cancel?.cancel('paused');
  }

  void onReconnected() {
    if (_disposed || _cancel != null) return;
    if (_resumeWhenOnline) {
      unawaited(start());
    } else if (_reloadWhenOnline) {
      unawaited(load());
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _cancel?.cancel('disposed');
    super.dispose();
  }
}

class _PackagePolicyLifecycle extends WidgetsBindingObserver {
  _PackagePolicyLifecycle(this.reload);
  final VoidCallback reload;
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) reload();
  }
}

int? _downloadStatus(Object error) => switch (error) {
  ApiException() => error.statusCode,
  DioException() => error.response?.statusCode,
  _ => null,
};

bool _deniesAccess(Object error) => switch (_downloadStatus(error)) {
  401 || 403 || 404 => true,
  _ => false,
};

String downloadErrorMessage(Object error) {
  if (error is PackageStorageException) return error.message;
  if (error is MissingPluginException || error is PlatformException) {
    return 'Không kiểm tra được dung lượng trống trên thiết bị này.';
  }
  if (error is FileSystemException) {
    return 'Không lưu được gói dữ liệu. Kiểm tra dung lượng rồi tiếp tục tải.';
  }
  if (error is FormatException) return error.message;
  return switch (_downloadStatus(error)) {
    401 => 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    403 || 404 => 'Bạn không còn quyền với chuyến này',
    409 => 'Gói dữ liệu chưa sẵn sàng. Hãy thử lại sau.',
    503 => 'Chưa thể tải gói dữ liệu. Hãy thử lại sau.',
    _ => 'Tải bị gián đoạn. Kiểm tra kết nối rồi tiếp tục tải.',
  };
}
