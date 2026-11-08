enum PackageDownloadStatus { interrupted, downloading, downloaded }

/// A transfer result only. Verification and activation belong to CTMS-054.
class OfflinePackage {
  const OfflinePackage({
    required this.id,
    required this.tripId,
    required this.packageVersion,
    required this.sha256,
    required this.sizeBytes,
    required this.generatedAt,
  });

  final String id;
  final String tripId;
  final int packageVersion;
  final String sha256;
  final int sizeBytes;
  final DateTime generatedAt;
  static const maxBytes = 20 * 1024 * 1024;
  String get etag => '"$sha256"';
  String get key => '$tripId-v$packageVersion-$id-$sha256';

  factory OfflinePackage.fromJson(Map<String, Object?> json) {
    final id = json['id'];
    final tripId = json['tripId'];
    final version = json['packageVersion'];
    final sha = json['sha256'];
    final size = json['sizeBytes'];
    final generated = DateTime.tryParse(json['generatedAt'].toString());
    final uuid = RegExp(
      r'^[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}$',
    );
    if (id is! String ||
        !uuid.hasMatch(id) ||
        tripId is! String ||
        !uuid.hasMatch(tripId) ||
        version is! int ||
        version < 1 ||
        version > 2147483647 ||
        sha is! String ||
        !RegExp(r'^[a-f0-9]{64}$').hasMatch(sha) ||
        size is! int ||
        size <= 0 ||
        size > maxBytes ||
        generated == null ||
        json['schemaVersion'] != 1 ||
        json['contentType'] != 'application/zip') {
      throw const FormatException('Gói dữ liệu không được hỗ trợ.');
    }
    return OfflinePackage(
      id: id,
      tripId: tripId,
      packageVersion: version,
      sha256: sha,
      sizeBytes: size,
      generatedAt: generated,
    );
  }

  Map<String, Object?> toJson() => {
    'id': id,
    'tripId': tripId,
    'packageVersion': packageVersion,
    'schemaVersion': 1,
    'sha256': sha256,
    'sizeBytes': sizeBytes,
    'generatedAt': generatedAt.toIso8601String(),
    'contentType': 'application/zip',
  };

  bool sameArtifact(OfflinePackage other) =>
      key == other.key && sizeBytes == other.sizeBytes;
}

class LocalPackageDownload {
  const LocalPackageDownload(this.package, this.status, this.downloadedBytes);
  final OfflinePackage package;
  final PackageDownloadStatus status;
  final int downloadedBytes;
  double get progress => downloadedBytes / package.sizeBytes;
}
