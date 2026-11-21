import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../application/package_download_controller.dart';

class CamperPackagePreparation {
  const CamperPackagePreparation({
    required this.status,
    required this.packageId,
    required this.policyVersion,
    required this.acknowledged,
    this.startsAt,
  });

  final String status;
  final String? packageId;
  final String policyVersion;
  final bool acknowledged;
  final DateTime? startsAt;

  factory CamperPackagePreparation.fromJson(Map<String, Object?> json) =>
      CamperPackagePreparation(
        status: json['status'] as String,
        packageId: json['packageId'] as String?,
        policyVersion: json['policyVersion'] as String,
        acknowledged: json['confirmedAt'] != null,
        startsAt: DateTime.tryParse(json['startsAt'] as String? ?? ''),
      );
}

class CamperPackagePreparationApi {
  const CamperPackagePreparationApi(this.client);

  final ApiClient client;

  String _path(String tripId) =>
      '/trips/$tripId/offline-package-policy/camper-preparation';

  Future<CamperPackagePreparation> read(String tripId) async {
    final response = await client.get<Map<String, Object?>>(_path(tripId));
    return CamperPackagePreparation.fromJson(response.data!);
  }

  Future<void> acknowledge(
    String tripId,
    CamperPackagePreparation preparation,
  ) async {
    await client.post<Object?>(
      _path(tripId),
      data: {
        'packageId': preparation.packageId,
        'policyVersion': preparation.policyVersion,
        'acknowledged': true,
      },
    );
  }
}

final camperPreparationApiProvider = Provider<CamperPackagePreparationApi>(
  (ref) => CamperPackagePreparationApi(ref.watch(apiClientProvider)),
);

final camperPreparationProvider = FutureProvider.autoDispose
    .family<CamperPackagePreparation?, String>((ref, tripId) {
      if (ref.watch(offlinePackageAccountProvider) == null) {
        return Future.value();
      }
      return ref.watch(camperPreparationApiProvider).read(tripId);
    });
