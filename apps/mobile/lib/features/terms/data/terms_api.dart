import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../domain/terms_models.dart';

class TermsApi {
  TermsApi(this._client);

  final ApiClient _client;

  Future<TermsVersionDetail> getCurrent() async {
    final response = await _client.get<Map<String, dynamic>>(
      ApiEndpoints.terms.current,
    );
    return TermsVersionDetail.fromJson(response.data ?? const {});
  }

  Future<List<TermsVersionSummary>> listVersions() async {
    final response = await _client.get<List<dynamic>>(
      ApiEndpoints.terms.versions,
    );
    final data = response.data ?? const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(TermsVersionSummary.fromJson)
        .toList();
  }

  Future<TermsVersionDetail> getVersionByCode(String version) async {
    final response = await _client.get<Map<String, dynamic>>(
      ApiEndpoints.terms.versionByCode(version),
    );
    return TermsVersionDetail.fromJson(response.data ?? const {});
  }

  Future<MyTermsStatus> getMyStatus() async {
    final response = await _client.get<Map<String, dynamic>>(
      ApiEndpoints.terms.myStatus,
    );
    return MyTermsStatus.fromJson(response.data ?? const {});
  }

  Future<AcceptTermsResult> acceptTerms({
    required String version,
    String platform = 'mobile',
  }) async {
    final response = await _client.post<Map<String, dynamic>>(
      ApiEndpoints.terms.accept,
      data: {'version': version, 'platform': platform},
    );
    return AcceptTermsResult.fromJson(response.data ?? const {});
  }
}

final termsApiProvider = Provider<TermsApi>(
  (ref) => TermsApi(ref.watch(apiClientProvider)),
);
