import 'dart:convert';
import 'dart:io';
import 'dart:math';

import '../../../core/api/api_client.dart';
import '../domain/offline_package.dart';
import '../domain/package_policy.dart';

/// Account-scoped installation identity, durable report queue and exact-package cache.
/// The enclosing provider is disposed on account changes; never share this root.
class PackagePolicyClient {
  PackagePolicyClient(this.api, this.root, {bool Function()? isCurrent})
    : _isCurrent = isCurrent ?? (() => true);
  final ApiClient api;
  final Directory root;
  final bool Function() _isCurrent;
  void _checkAccount() {
    if (!_isCurrent()) throw StateError('Account changed');
  }

  Future<String>? _device;
  Future<String> get deviceId => _device ??= _readDevice();
  Future<String> _readDevice() async {
    await root.create(recursive: true);
    final file = File('${root.path}/policy-device');
    if (await file.exists()) return file.readAsString();
    final bytes = List<int>.generate(16, (_) => Random.secure().nextInt(256));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    final id =
        '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
    await file.writeAsString(id, flush: true);
    return id;
  }

  String base(String trip) => '/trips/$trip/offline-package-policy';
  Future<File> _record(OfflinePackage package, String suffix) async =>
      File('${root.path}/${await deviceId}-${package.key}.$suffix');

  Future<PackagePolicy> context(OfflinePackage package) async {
    final device = await deviceId;
    _checkAccount();
    final response = await api.get<Map<String, Object?>>(
      '${base(package.tripId)}/context',
      queryParameters: {'deviceId': device, 'packageId': package.id},
    );
    final policy = PackagePolicy(response.data!);
    _checkAccount();
    if (policy.section('selected')['packageId'] != package.id ||
        policy.section('selected')['version'] != package.packageVersion ||
        policy.json['tripId'] != package.tripId) {
      throw const FormatException('Dữ liệu gói không khớp.');
    }
    await (await _record(
      package,
      'policy',
    )).writeAsString(jsonEncode(policy.json), flush: true);
    return policy;
  }

  Future<PackagePolicy?> cached(OfflinePackage package) async {
    final file = await _record(package, 'policy');
    if (!await file.exists()) return null;
    try {
      return PackagePolicy(
        Map<String, Object?>.from(jsonDecode(await file.readAsString()) as Map),
      );
    } on FormatException {
      return null;
    }
  }

  /// Called only after local hash/manifest validation. A failed request leaves a
  /// durable queue marker; resume revalidates bytes before replaying these reports.
  Future<void> acceptActivation(OfflinePackage package) async {
    final device = await deviceId;
    _checkAccount();
    final queue = await _record(package, 'activation-pending');
    await queue.writeAsString(jsonEncode(package.toJson()), flush: true);
    final policy = await context(package);
    if (!policy.replaceAllowed ||
        (policy.hasRequirement && policy.requiredId != package.id)) {
      throw const FormatException('Không được thay gói đang sử dụng.');
    }
    for (final status in ['downloaded', 'verified', 'active']) {
      _checkAccount();
      await api.post<Object?>(
        '${base(package.tripId)}/device-report',
        data: {
          'deviceId': device,
          'packageId': package.id,
          'status': status,
          if (status != 'downloaded') 'sha256': package.sha256,
        },
      );
    }
    // Keep the marker until the local activation has also committed.
  }

  Future<void> activationCommitted(OfflinePackage package) async {
    final queue = await _record(package, 'activation-pending');
    if (await queue.exists()) await queue.delete();
  }

  Future<void> confirm(OfflinePackage package) async {
    final device = await deviceId;
    _checkAccount();
    await api.post<Object?>(
      '${base(package.tripId)}/departure-ready',
      data: {'deviceId': device, 'packageId': package.id},
    );
  }
}
