import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../domain/danger_zone_report.dart';

abstract interface class DangerZoneReportsApi {
  Future<ReportJson> send(
    String account,
    String tripId,
    ReportJson payload,
    CancelToken cancel,
  );
  Future<List<ReportJson>> list(
    String account,
    String tripId,
    CancelToken cancel,
  );
  Future<ReportJson> uploadPhoto(
    String account,
    String tripId,
    String proposalId,
    Uint8List bytes,
    CancelToken cancel,
  );
}

class HttpDangerZoneReportsApi implements DangerZoneReportsApi {
  HttpDangerZoneReportsApi(this.client);
  final ApiClient client;
  @override
  Future<ReportJson> send(
    String account,
    String tripId,
    ReportJson payload,
    CancelToken cancel,
  ) async => (await client.post<ReportJson>(
    ApiEndpoints.trips.dangerZoneProposals(tripId),
    data: payload,
    expectedUserId: account,
    cancelToken: cancel,
  )).data!;
  @override
  Future<List<ReportJson>> list(
    String account,
    String tripId,
    CancelToken cancel,
  ) async => (await client.get<List<dynamic>>(
    ApiEndpoints.trips.dangerZoneProposals(tripId),
    expectedUserId: account,
    cancelToken: cancel,
  )).data!.map((v) => Map<String, dynamic>.from(v as Map)).toList();
  @override
  Future<ReportJson> uploadPhoto(
    String account,
    String tripId,
    String proposalId,
    Uint8List bytes,
    CancelToken cancel,
  ) async => (await client.post<ReportJson>(
    ApiEndpoints.trips.dangerZoneProposalPhotos(tripId, proposalId),
    data: FormData.fromMap({
      'file': MultipartFile.fromBytes(bytes, filename: 'danger-zone.jpg'),
    }),
    expectedUserId: account,
    cancelToken: cancel,
  )).data!;
}

final dangerZoneReportsApiProvider = Provider<DangerZoneReportsApi>(
  (ref) => HttpDangerZoneReportsApi(ref.watch(apiClientProvider)),
);
