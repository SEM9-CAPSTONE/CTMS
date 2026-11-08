import 'package:dio/dio.dart';

import '../domain/offline_package.dart';

abstract class PackageDownloadApi {
  Future<OfflinePackage> metadata(String tripId, {int? version});
  Future<Response<ResponseBody>> bytes(
    OfflinePackage package,
    int offset,
    CancelToken cancel,
  );
}
