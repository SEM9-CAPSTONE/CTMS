/// Broad category of what went wrong — lets callers branch on "was this a
/// connectivity problem" without string-matching [ApiException.message].
/// CTMS-214/CTMS-215 Implementation Checklist: "Handle offline, timeout,
/// server-error, ... states" as distinct cases, not one generic bucket.
enum ApiExceptionKind {
  /// No response ever came back — no network, DNS failure, connection
  /// refused, etc.
  network,

  /// Connect/send/receive timeout — a network exists, the server (or the
  /// request) was just too slow.
  timeout,

  /// A real HTTP response came back with an error status (4xx/5xx) —
  /// [ApiException.statusCode]/[ApiException.errorData] are populated.
  response,

  /// Anything else (cancelled request, unexpected Dio error type).
  unknown,
}

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.errorData, this.kind = ApiExceptionKind.unknown});

  final String message;
  final int? statusCode;

  /// Raw parsed response body, when one exists — e.g. the 422
  /// `{statusCode, error, message: [{field, errors}]}` shape. Callers that
  /// need field-level detail (duplicate-email/phone, per-field validation)
  /// read this instead of parsing [message], mirroring
  /// apps/web/src/core/api/httpClient.ts's `HttpError.errorData`.
  final Object? errorData;

  final ApiExceptionKind kind;

  @override
  String toString() => 'ApiException($statusCode): $message';
}
