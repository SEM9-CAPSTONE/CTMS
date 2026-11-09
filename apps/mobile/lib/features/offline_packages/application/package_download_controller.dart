import 'dart:async';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
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
import '../domain/offline_package.dart';

final packageDownloaderProvider = FutureProvider.autoDispose<PackageDownloader>(
  (ref) async {
    final userId = ref.watch(authControllerProvider).valueOrNull?.id;
    if (userId == null) throw StateError('Vui lòng đăng nhập lại.');
    final api = DioPackageDownloadApi(ref.watch(apiClientProvider));
    final directory = await getApplicationSupportDirectory();
    return PackageDownloader(
      api,
      PackageDownloadStore(
        Directory('${directory.path}/offline-packages/$userId'),
      ),
      DevicePackageStorageCapacity(),
    );
  },
);

final packageDownloadControllerProvider = ChangeNotifierProvider.autoDispose
    .family<PackageDownloadController, String>((ref, tripId) {
      ref.watch(
        authControllerProvider.select((state) => state.valueOrNull?.id),
      );
      final downloader = ref.watch(packageDownloaderProvider.future);
      final controller = PackageDownloadController(tripId, () => downloader);
      final connectivity = Connectivity().onConnectivityChanged.listen((
        results,
      ) {
        if (results.any((result) => result != ConnectivityResult.none)) {
          controller.onReconnected();
        }
      });
      ref.onDispose(() => unawaited(connectivity.cancel()));
      unawaited(controller.load());
      return controller;
    });

class PackageDownloadController extends ChangeNotifier {
  PackageDownloadController(this.tripId, this._downloader);
  final String tripId;
  final Future<PackageDownloader> Function() _downloader;
  bool loading = true;
  bool downloading = false;
  bool storageBlocked = false;
  bool _disposed = false;
  bool _accessDenied = false;
  bool _resumeWhenOnline = false;
  bool _reloadWhenOnline = false;
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
        await _restoreCandidate(downloader, candidate, cancel);
        _emit();
      }
      if (cancel.isCancelled) return;
      try {
        final remote = await downloader.api.metadata(tripId);
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

  Future<void> start() async {
    final target = package;
    if (_disposed ||
        _cancel != null ||
        loading ||
        _accessDenied ||
        target == null) {
      return;
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
      _cancel = null;
      _emit();
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
        authorizeReplacement: online && candidate.activationAllowed == true
            ? () => _authorizeReplacement(downloader, candidate, cancel)
            : null,
      );
      if (cancel.isCancelled || _accessDenied) return;
      verification = result;
      if (activated) active = candidate;
      if (result == PackageVerificationStatus.failed &&
          active?.sameArtifact(candidate) == true) {
        active = null;
      }
    } catch (_) {
      if (!cancel.isCancelled) verification = PackageVerificationStatus.failed;
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
    if (_deniesAccess(failure)) {
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
    403 || 404 => 'Bạn không còn quyền tải gói dữ liệu của chuyến đi này.',
    409 => 'Gói dữ liệu chưa sẵn sàng. Hãy thử lại sau.',
    503 => 'Chưa thể tải gói dữ liệu. Hãy thử lại sau.',
    _ => 'Tải bị gián đoạn. Kiểm tra kết nối rồi tiếp tục tải.',
  };
}
