import 'package:dio/dio.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../domain/offline_package.dart';
import 'package_download_api.dart';

class DioPackageDownloadApi implements PackageDownloadApi {
  DioPackageDownloadApi(this.client);
  final ApiClient client;

  @override
  Future<OfflinePackage> metadata(String tripId, {int? version}) async {
    final response = await client.get<Map<String, Object?>>(
      ApiEndpoints.trips.offlinePackage(tripId, version: version),
    );
    final package = OfflinePackage.fromJson(response.data!);
    if (package.tripId != tripId ||
        (version != null && package.packageVersion != version)) {
      throw const FormatException('Gói dữ liệu không khớp chuyến đi.');
    }
    return package;
  }

  @override
  Future<Response<ResponseBody>> bytes(
    OfflinePackage package,
    int offset,
    CancelToken cancel,
  ) {
    return client.dio.get<ResponseBody>(
      ApiEndpoints.trips.offlinePackageDownload(
        package.tripId,
        package.packageVersion,
      ),
      cancelToken: cancel,
      options: Options(
        responseType: ResponseType.stream,
        receiveTimeout: const Duration(seconds: 30),
        validateStatus: (status) =>
            status == 200 || status == 206 || status == 416,
        headers: {
          'Accept-Encoding': 'identity',
          if (offset > 0) 'Range': 'bytes=$offset-',
          if (offset > 0) 'If-Range': package.etag,
        },
      ),
    );
  }
}
