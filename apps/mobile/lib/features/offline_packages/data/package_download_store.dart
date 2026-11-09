import 'dart:convert';
import 'dart:io';

import '../domain/offline_package.dart';

/// App-private, account-scoped files. Byte length is recovered from disk, never the journal.
class PackageDownloadStore {
  PackageDownloadStore(this.root);
  final Directory root;
  File partial(OfflinePackage package) =>
      File('${root.path}/${package.key}.part');
  File archive(OfflinePackage package) =>
      File('${root.path}/${package.key}.zip');
  File _journal(OfflinePackage package) =>
      File('${root.path}/${package.key}.json');

  Future<void> save(LocalPackageDownload download) async {
    await root.create(recursive: true);
    final target = _journal(download.package);
    final temporary = File('${target.path}.tmp');
    await temporary.writeAsString(
      jsonEncode({
        'package': download.package.toJson(),
        'status': download.status.name,
        'downloadedBytes': download.downloadedBytes,
      }),
      flush: true,
    );
    await temporary.rename(target.path);
  }

  Future<LocalPackageDownload?> recover(OfflinePackage package) async {
    final completed = archive(package);
    if (await completed.exists() &&
        await completed.length() == package.sizeBytes) {
      // Includes a crash between atomic .part -> .zip rename and journal commit.
      return LocalPackageDownload(
        package,
        PackageDownloadStatus.downloaded,
        package.sizeBytes,
      );
    }
    final part = partial(package);
    var size = await part.exists() ? await part.length() : 0;
    if (size > package.sizeBytes) {
      await part.delete();
      size = 0;
    }
    return LocalPackageDownload(
      package,
      PackageDownloadStatus.interrupted,
      size,
    );
  }

  Future<List<LocalPackageDownload>> forTrip(String tripId) async {
    if (!await root.exists()) return [];
    final result = <LocalPackageDownload>[];
    await for (final entry in root.list()) {
      if (entry is! File || !entry.path.endsWith('.json')) continue;
      try {
        final json =
            jsonDecode(await entry.readAsString()) as Map<String, Object?>;
        final package = OfflinePackage.fromJson(
          json['package'] as Map<String, Object?>,
        );
        if (package.tripId != tripId || entry.uri != _journal(package).uri) {
          continue;
        }
        final recovered = await recover(package);
        if (recovered != null) result.add(recovered);
      } on FormatException {
        continue;
      } on TypeError {
        continue;
      } on FileSystemException {
        continue;
      }
    }
    result.sort(
      (a, b) => b.package.packageVersion.compareTo(a.package.packageVersion),
    );
    return result;
  }

  Future<void> complete(OfflinePackage package) async {
    if (await partial(package).length() != package.sizeBytes) {
      throw const FormatException('Gói dữ liệu chưa được tải đầy đủ.');
    }
    await partial(package).rename(archive(package).path);
    await save(
      LocalPackageDownload(
        package,
        PackageDownloadStatus.downloaded,
        package.sizeBytes,
      ),
    );
  }
}
