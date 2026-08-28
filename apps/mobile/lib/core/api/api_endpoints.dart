/// Mirrors apps/web/src/core/api/endpoints.ts so both clients stay in sync
/// with the same backend contract.
class ApiEndpoints {
  ApiEndpoints._();

  static const auth = AuthEndpoints();
  static const campsites = CampsiteEndpoints();
  static const bookings = BookingEndpoints();
  static const trekking = TrekkingEndpoints();
  static const trips = TripEndpoints();
  static const weather = WeatherEndpoints();
  static const ai = AiEndpoints();
  static const sos = SosEndpoints();
}

class AuthEndpoints {
  const AuthEndpoints();

  String get login => '/auth/login';
  String get register => '/auth/register';
  String get sendOtp => '/auth/send-otp';
  String get resendOtp => '/auth/resend';
  String get verifyOtp => '/auth/verify';
  String get forgotPassword => '/auth/forgot-password';
  String get resetPassword => '/auth/reset-password';
  String get refresh => '/auth/refresh';
  String get logout => '/auth/logout';
  String get me => '/auth/me';
}

class CampsiteEndpoints {
  const CampsiteEndpoints();

  String get getAll => '/campsites';
  String getById(String id) => '/campsites/$id';
  String get create => '/campsites';
  String update(String id) => '/campsites/$id';
  String delete(String id) => '/campsites/$id';
  String zones(String campsiteId) => '/campsites/$campsiteId/zones';
  String slots(String zoneId) => '/campsite-zones/$zoneId/slots';
}

class BookingEndpoints {
  const BookingEndpoints();

  String get getAll => '/bookings';
  String getById(String id) => '/bookings/$id';
  String get create => '/bookings';
  String cancel(String id) => '/bookings/$id/cancel';
  String payments(String id) => '/bookings/$id/payments';
}

class TrekkingEndpoints {
  const TrekkingEndpoints();

  String get routes => '/trekking-routes';
  String routeById(String id) => '/trekking-routes/$id';
  String checkpoints(String routeId) => '/trekking-routes/$routeId/checkpoints';
  String dangerZones(String routeId) =>
      '/trekking-routes/$routeId/danger-zones';
}

class TripEndpoints {
  const TripEndpoints();

  String get getAll => '/trips';
  String getById(String id) => '/trips/$id';
  String members(String tripId) => '/trips/$tripId/members';
  String gpsLogs(String tripId) => '/trips/$tripId/gps-logs';
}

class WeatherEndpoints {
  const WeatherEndpoints();

  String get riskAssessment => '/weather/risk-assessment';
  String get snapshot => '/weather/snapshots';
}

class AiEndpoints {
  const AiEndpoints();

  String get conversations => '/ai/conversations';
  String messages(String conversationId) =>
      '/ai/conversations/$conversationId/messages';
  String get feedback => '/ai/messages/feedback';
}

class SosEndpoints {
  const SosEndpoints();

  String get alerts => '/sos-alerts';
  String alertById(String id) => '/sos-alerts/$id';
}
