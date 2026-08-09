import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../domain/camper_profile.dart';

class CamperProfileRepository {
  CamperProfileRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<CamperProfile> getProfile() async {
    final response = await _apiClient.get<Map<String, dynamic>>('/profiles/me');
    return CamperProfile.fromJson(response.data ?? <String, dynamic>{});
  }

  Future<CamperProfile> updateProfile(UpdateCamperProfileInput input) async {
    final response = await _apiClient.patch<Map<String, dynamic>>(
      '/profiles/me',
      data: input.toJson(),
    );
    return CamperProfile.fromJson(response.data ?? <String, dynamic>{});
  }
}

final camperProfileRepositoryProvider = Provider<CamperProfileRepository>((ref) {
  return CamperProfileRepository(ref.watch(apiClientProvider));
});
