import 'package:dio/dio.dart';

import '../../../core/api/api_exception.dart';

/// Metadata uses ApiClient errors; byte streaming exposes Dio errors directly.
bool isPackageDownloadNetworkFailure(Object error) {
  if (error is ApiException) {
    return error.kind == ApiExceptionKind.network ||
        error.kind == ApiExceptionKind.timeout;
  }
  return error is DioException &&
      switch (error.type) {
        DioExceptionType.connectionError ||
        DioExceptionType.connectionTimeout ||
        DioExceptionType.sendTimeout ||
        DioExceptionType.receiveTimeout => true,
        _ => false,
      };
}
