import 'dart:async';
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
  File _verification(OfflinePackage package) =>
      File('${root.path}/${package.key}-${package.sizeBytes}.integrity');
  File _active(String tripId) => File('${root.path}/$tripId.active');
  File _denial(String tripId) => File('${root.path}/$tripId.access-denied');
  static final _integrityOperations = <String, Future<void>>{};
  static final _deniedTrips = <String>{};

  String _tripKey(String tripId) => '${root.absolute.path}/$tripId';

  Future<T> withIntegrityLock<T>(
    String tripId,
    Future<T> Function() operation,
  ) async {
    final key = _tripKey(tripId);
    final previous = _integrityOperations[key];
    final finished = Completer<void>();
    _integrityOperations[key] = finished.future;
    try {
      await previous;
      return await operation();
    } finally {
      if (_integrityOperations[key] == finished.future) {
        _integrityOperations.remove(key);
      }
      finished.complete();
    }
  }

  Future<Map<String, Object?>?> _readRecord(File file) async {
    try {
      if (!await file.exists()) return null;
      final json = jsonDecode(await file.readAsString());
      return json is Map<String, Object?> ? json : null;
    } on FormatException {
      return null;
    }
  }

  OfflinePackage? _recordPackage(Map<String, Object?>? record) {
    final json = record?['package'];
    if (json is! Map<String, Object?>) return null;
    try {
      return OfflinePackage.fromJson(json);
    } on FormatException {
      return null;
    }
  }

  Future<PackageVerificationStatus> verification(OfflinePackage package) async {
    final record = await _readRecord(_verification(package));
    if (_recordPackage(record)?.sameArtifact(package) != true) {
      return PackageVerificationStatus.pending;
    }
    return switch (record?['status']) {
      'verified' => PackageVerificationStatus.verified,
      'failed' => PackageVerificationStatus.failed,
      _ => PackageVerificationStatus.pending,
    };
  }

  Future<OfflinePackage?> active(String tripId) async =>
      (await _activeEntry(tripId))?.package;

  Future<SavedOfflinePackage?> _activeEntry(String tripId) async {
    // Trip IDs also name local files. Ignore invalid navigation input.
    if (!OfflinePackage.isTripId(tripId)) return null;
    final record = await _readRecord(_active(tripId));
    final package = _recordPackage(record);
    if (package == null || package.tripId != tripId) return null;
    final title = record?['tripTitle'];
    return (package: package, tripTitle: title is String ? title : null);
  }

  Future<List<SavedOfflinePackage>> activePackages() async {
    if (!await root.exists()) return [];
    final packages = <SavedOfflinePackage>[];
    await for (final entry in root.list(followLinks: false)) {
      if (entry is! File) continue;
      final name = entry.uri.pathSegments.last;
      if (!name.endsWith('.active')) continue;
      final tripId = name.substring(0, name.length - '.active'.length);
      final active = await _activeEntry(tripId);
      if (active != null &&
          await verification(active.package) ==
              PackageVerificationStatus.verified &&
          !await accessDenied(tripId)) {
        packages.add(active);
      }
    }
    packages.sort(
      (a, b) => b.package.generatedAt.compareTo(a.package.generatedAt),
    );
    return packages;
  }

  Future<bool> accessDenied(String tripId) async =>
      OfflinePackage.isTripId(tripId) &&
      (_deniedTrips.contains(_tripKey(tripId)) ||
          await _denial(tripId).exists());

  Future<void> setAccessDenied(String tripId, bool denied) async {
    if (!OfflinePackage.isTripId(tripId)) return;
    final marker = _denial(tripId);
    final key = _tripKey(tripId);
    if (denied) {
      // The download controller and offline viewer both fail closed even if
      // the denial marker cannot be written to disk.
      _deniedTrips.add(key);
      await root.create(recursive: true);
      await marker.create();
    } else {
      if (await marker.exists()) await marker.delete();
      _deniedTrips.remove(key);
    }
  }

  Future<void> saveVerification(
    OfflinePackage package,
    PackageVerificationStatus status,
    void Function() checkCancelled,
  ) => _writeIntegrityRecord(_verification(package), {
    'package': package.toJson(),
    'status': status.name,
  }, checkCancelled);

  Future<void> saveActive(
    OfflinePackage package,
    void Function() checkCancelled, {
    String? tripTitle,
  }) async {
    final title = tripTitle ?? (await _activeEntry(package.tripId))?.tripTitle;
    await _writeIntegrityRecord(_active(package.tripId), {
      'package': package.toJson(),
      'tripTitle': ?title,
    }, checkCancelled);
  }

  Future<void> _writeIntegrityRecord(
    File target,
    Map<String, Object?> record,
    void Function() checkCancelled,
  ) async {
    await root.create(recursive: true);
    final temporary = File('${target.path}.tmp');
    await temporary.writeAsString(jsonEncode(record), flush: true);
    // No asynchronous gap between the cancellation check and publication.
    checkCancelled();
    temporary.renameSync(target.path);
  }

  Future<bool> hasCompletedTransfer(OfflinePackage package) async =>
      await archive(package).exists() ||
      (await _readRecord(_journal(package)))?['status'] == 'downloaded';

  Future<void> resetFailed(OfflinePackage package) async {
    if (await verification(package) != PackageVerificationStatus.failed) return;
    for (final file in [archive(package), partial(package)]) {
      if (await file.exists()) await file.delete();
    }
    // Leave the failure receipt until the old bytes and completion marker
    // are gone. A crash anywhere before then safely retries the reset.
    await save(
      LocalPackageDownload(package, PackageDownloadStatus.interrupted, 0),
    );
    await _verification(package).delete();
  }

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
