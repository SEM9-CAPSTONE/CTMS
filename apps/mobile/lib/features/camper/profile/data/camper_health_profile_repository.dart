import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../domain/health_profile.dart';

class CamperHealthProfileRepository {
  CamperHealthProfileRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<HealthProfile> getProfile() async {
    final response = await _apiClient.get<Map<String, dynamic>>('/camper/health-profile');
    return HealthProfile.fromJson(response.data ?? <String, dynamic>{});
  }

  Future<HealthProfile> updateProfile(UpdateHealthProfileInput input, int version) async {
    final response = await _apiClient.put<Map<String, dynamic>>(
      '/camper/health-profile?version=$version',
      data: input.toJson(),
    );
    return HealthProfile.fromJson(response.data ?? <String, dynamic>{});
  }

  Future<HealthProfile> grantConsent() async {
    final response = await _apiClient.post<Map<String, dynamic>>('/camper/health-profile/consent/grant');
    return HealthProfile.fromJson(response.data ?? <String, dynamic>{});
  }

  Future<HealthProfile> revokeConsent() async {
    final response = await _apiClient.post<Map<String, dynamic>>('/camper/health-profile/consent/revoke');
    return HealthProfile.fromJson(response.data ?? <String, dynamic>{});
  }

  Future<HealthProfile> getCamperProfile(String userId) async {
    final response = await _apiClient.get<Map<String, dynamic>>('/camper/health-profile/$userId');
    return HealthProfile.fromJson(response.data ?? <String, dynamic>{});
  }
}

final camperHealthProfileRepositoryProvider = Provider<CamperHealthProfileRepository>((ref) {
  return CamperHealthProfileRepository(ref.watch(apiClientProvider));
});
