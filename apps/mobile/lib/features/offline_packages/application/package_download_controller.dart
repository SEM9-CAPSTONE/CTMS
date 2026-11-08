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
  bool _disposed = false;
  bool _resumeWhenOnline = false;
  CancelToken? _cancel;
  OfflinePackage? package;
  LocalPackageDownload? local;
  List<LocalPackageDownload> versions = [];
  String? error;

  void _emit() {
    if (!_disposed) notifyListeners();
  }

  Future<void> load() async {
    if (downloading) return;
    loading = true;
    error = null;
    local = null;
    package = null;
    _emit();
    try {
      final downloader = await _downloader();
      versions = await downloader.store.forTrip(tripId);
      try {
        package = await downloader.api.metadata(tripId);
      } catch (failure) {
        // Offline recovery remains visible, but resume still requires server authorization.
        package = versions.isEmpty ? null : versions.first.package;
        error = downloadErrorMessage(failure);
      }
      if (package != null) local = await downloader.store.recover(package!);
    } catch (failure) {
      error = downloadErrorMessage(failure);
    } finally {
      loading = false;
      _emit();
    }
  }

  Future<void> start() async {
    final target = package;
    if (_disposed || downloading || loading || target == null) return;
    downloading = true;
    error = null;
    _resumeWhenOnline = false;
    final cancel = CancelToken();
    _cancel = cancel;
    _emit();
    try {
      final downloader = await _downloader();
      if (_disposed) {
        cancel.cancel();
        return;
      }
      local = await downloader.download(target, cancel, (progress) {
        local = progress;
        _emit();
      });
      versions = await downloader.store.forTrip(tripId);
    } catch (failure) {
      _resumeWhenOnline =
          !cancel.isCancelled && isPackageDownloadNetworkFailure(failure);
      error = cancel.isCancelled
          ? 'Đã tạm dừng. Bạn có thể tiếp tục tải.'
          : downloadErrorMessage(failure);
      try {
        final downloader = await _downloader();
        local = await downloader.store.recover(target);
      } catch (_) {
        /* Show the original transfer error. */
      }
    } finally {
      downloading = false;
      _cancel = null;
      _emit();
    }
  }

  void pause() {
    _resumeWhenOnline = false;
    _cancel?.cancel('paused');
  }

  void onReconnected() {
    if (_resumeWhenOnline && !_disposed && !downloading) unawaited(start());
  }

  @override
  void dispose() {
    _disposed = true;
    pause();
    super.dispose();
  }
}

String downloadErrorMessage(Object error) {
  if (error is PackageStorageException) return error.message;
  if (error is MissingPluginException || error is PlatformException) {
    return 'Không kiểm tra được dung lượng trống trên thiết bị này.';
  }
  if (error is FileSystemException) {
    return 'Không lưu được gói dữ liệu. Kiểm tra dung lượng rồi tiếp tục tải.';
  }
  if (error is FormatException) return error.message;
  final status = error is ApiException
      ? error.statusCode
      : error is DioException
      ? error.response?.statusCode
      : null;
  return switch (status) {
    401 => 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    403 || 404 => 'Bạn không còn quyền tải gói dữ liệu của chuyến đi này.',
    409 => 'Gói dữ liệu chưa sẵn sàng. Hãy thử lại sau.',
    503 => 'Chưa thể tải gói dữ liệu. Hãy thử lại sau.',
    _ => 'Tải bị gián đoạn. Kiểm tra kết nối rồi tiếp tục tải.',
  };
}
