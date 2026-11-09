import 'dart:io';

import 'package:dio/dio.dart';

import '../domain/offline_package.dart';
import 'package_download_api.dart';
import 'package_download_store.dart';
import 'package_storage_capacity.dart';

class PackageDownloader {
  PackageDownloader(this.api, this.store, this.capacity);
  final PackageDownloadApi api;
  final PackageDownloadStore store;
  final PackageStorageCapacity capacity;
  static final _running = <String>{};
  static const storageReserve = 4 * 1024 * 1024;

  void _checkCancelled(CancelToken cancel) {
    final error = cancel.cancelError;
    if (error != null) throw error;
  }

  Future<void> _checkStorage(int remaining) async {
    if (await capacity.availableBytes() < remaining + storageReserve) {
      throw const PackageStorageException(
        'Không đủ dung lượng trống. Hãy giải phóng bộ nhớ rồi tiếp tục tải.',
      );
    }
  }

  Future<LocalPackageDownload> download(
    OfflinePackage package,
    CancelToken cancel,
    void Function(LocalPackageDownload) onProgress,
  ) async {
    final lockKey = '${store.root.absolute.path}/${package.key}';
    if (!_running.add(lockKey)) {
      throw StateError('Gói dữ liệu đang được tải.');
    }
    try {
      return await _transfer(package, cancel, onProgress);
    } finally {
      _running.remove(lockKey);
    }
  }

  Future<LocalPackageDownload> _transfer(
    OfflinePackage package,
    CancelToken cancel,
    void Function(LocalPackageDownload) onProgress,
  ) async {
    // Re-authorize the exact immutable version, including after an app restart.
    final current = await api.metadata(
      package.tripId,
      version: package.packageVersion,
    );
    if (!package.sameArtifact(current)) {
      throw const FormatException(
        'Phiên bản gói dữ liệu đã thay đổi. Hãy tải lại thông tin.',
      );
    }
    var recovered = (await store.recover(package))!;
    if (recovered.status == PackageDownloadStatus.downloaded) return recovered;
    var offset = recovered.downloadedBytes;
    RandomAccessFile? output;
    ResponseBody? pendingBody;
    try {
      await _checkStorage(package.sizeBytes - offset);
      _checkCancelled(cancel);
      await store.save(
        LocalPackageDownload(
          package,
          PackageDownloadStatus.downloading,
          offset,
        ),
      );
      // Even a full .part must contact the byte endpoint again before becoming DOWNLOADED.
      final response = await api.bytes(package, offset, cancel);
      final body = response.data!;
      pendingBody = body;
      final headers = response.headers;
      final validIdentity = headers.value('etag') == package.etag;
      if (response.statusCode == 416) {
        pendingBody = null;
        await body.stream.drain<void>();
        if (offset != package.sizeBytes ||
            !validIdentity ||
            headers.value('content-range') != 'bytes */${package.sizeBytes}') {
          throw const FormatException(
            'Không tiếp tục được bản tải này. Hãy thử lại.',
          );
        }
      } else {
        final isPartial = response.statusCode == 206;
        final start = isPartial ? offset : 0;
        final expectedLength = package.sizeBytes - start;
        if (!validIdentity ||
            headers.value('content-type')?.split(';').first !=
                'application/zip' ||
            headers.value('content-length') != '$expectedLength' ||
            (isPartial &&
                headers.value('content-range') !=
                    'bytes $offset-${package.sizeBytes - 1}/${package.sizeBytes}')) {
          throw const FormatException('Phản hồi tải không khớp gói dữ liệu.');
        }
        // A server/proxy ignoring Range sends 200: truncate and restart, then re-check full space.
        if (!isPartial) {
          if (offset > 0) await _checkStorage(package.sizeBytes);
          offset = 0;
        }
        await store.root.create(recursive: true);
        output = await store
            .partial(package)
            .open(mode: isPartial ? FileMode.append : FileMode.write);
        var checkpoint = offset;
        pendingBody = null;
        await for (final chunk in body.stream) {
          _checkCancelled(cancel);
          if (offset + chunk.length > package.sizeBytes) {
            throw const FormatException(
              'Gói dữ liệu vượt quá dung lượng dự kiến.',
            );
          }
          await output.writeFrom(chunk);
          offset += chunk.length;
          onProgress(
            LocalPackageDownload(
              package,
              PackageDownloadStatus.downloading,
              offset,
            ),
          );
          if (offset - checkpoint >= 256 * 1024) {
            await output.flush();
            await store.save(
              LocalPackageDownload(
                package,
                PackageDownloadStatus.downloading,
                offset,
              ),
            );
            checkpoint = offset;
          }
        }
        await output.flush();
        await output.close();
        output = null;
      }
      _checkCancelled(cancel);
      if (offset != package.sizeBytes) {
        throw const FormatException(
          'Kết nối gián đoạn. Bạn có thể tiếp tục tải.',
        );
      }
      await _checkStorage(0);
      await store.complete(package);
      recovered = LocalPackageDownload(
        package,
        PackageDownloadStatus.downloaded,
        offset,
      );
      onProgress(recovered);
      return recovered;
    } catch (_) {
      // Header/storage failures can happen before the response stream is consumed.
      // Cancel that subscription rather than downloading an unrelated body or leaking a socket.
      if (pendingBody != null) {
        await pendingBody.stream.listen((_) {}).cancel();
      }
      if (output != null) {
        await output.close();
        output = null;
      }
      final partial = store.partial(package);
      final saved = await partial.exists() ? await partial.length() : 0;
      // Journaling failure (e.g. disk full) must not hide the original error; recovery uses file length.
      try {
        await store.save(
          LocalPackageDownload(
            package,
            PackageDownloadStatus.interrupted,
            saved,
          ),
        );
      } on FileSystemException {
        /* Recovery uses actual bytes after restart. */
      }
      rethrow;
    }
  }
}
