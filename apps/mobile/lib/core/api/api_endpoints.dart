/// Mirrors apps/web/src/core/api/endpoints.ts so both clients stay in sync
/// with the same backend contract.
class ApiEndpoints {
  ApiEndpoints._();

  static const auth = AuthEndpoints();
  static const terms = TermsEndpoints();
  static const bookings = BookingEndpoints();
  static const bookingInvitations = BookingInvitationEndpoints();
  static const porterReviews = PorterReviewEndpoints();
  static const trekking = TrekkingEndpoints();
  static const trips = TripEndpoints();
  static const weather = WeatherEndpoints();
  static const ai = AiEndpoints();
  static const sos = SosEndpoints();
}

class AuthEndpoints {
  const AuthEndpoints();

  String get login => '/auth/login';
  String get google => '/auth/google';
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

class TermsEndpoints {
  const TermsEndpoints();

  String get current => '/terms/current';
  String get versions => '/terms/versions';
  String versionByCode(String version) =>
      '/terms/versions/${Uri.encodeComponent(version)}';
  String get myStatus => '/terms/my-status';
  String get accept => '/terms/accept';
}

class BookingEndpoints {
  const BookingEndpoints();

  String get getAll => '/bookings';
  String getById(String id) => '/bookings/$id';
  String get create => '/bookings';
  String cancel(String id) => '/bookings/$id/cancel';
  String items(String id) => '/bookings/$id/items';
  String pay(String id) => '/bookings/$id/pay';
  String syncPayment(String id) => '/bookings/$id/sync-payment';
  String refunds(String id) => '/bookings/$id/refunds';
  String equipmentForTrip(String tripId) =>
      '/equipment-catalog/for-trip/$tripId';
  String get bankAccounts => '/profiles/me/bank-accounts';
  String bankAccount(String id) => '/profiles/me/bank-accounts/$id';
  String defaultBankAccount(String id) =>
      '/profiles/me/bank-accounts/$id/default';
  String payments(String id) => '/bookings/$id/payments';
  String complete(String id) => '/bookings/$id/complete';
  String reviewContext(String id) => '/bookings/$id/reviews/context';
  String reviews(String id) => '/bookings/$id/reviews';
  String weatherRescheduleResponse(String id) =>
      '/bookings/$id/weather-reschedule-response';
  String review(String id) => '/trip-reviews/$id';
  String completeTripBookings(String tripId) =>
      '/bookings/trip/$tripId/complete-all';
  String invitations(String bookingId) => '/bookings/$bookingId/invitations';
  String invitation(String bookingId, String invitationId) =>
      '/bookings/$bookingId/invitations/$invitationId';
  String member(String bookingId, String memberId) =>
      '/bookings/$bookingId/members/$memberId';
}

class BookingInvitationEndpoints {
  const BookingInvitationEndpoints();

  String get mine => '/booking-invitations/mine';
  String byToken(String token) =>
      '/booking-invitations/${Uri.encodeComponent(token)}';
  String accept(String token) =>
      '/booking-invitations/${Uri.encodeComponent(token)}/accept';
  String decline(String token) =>
      '/booking-invitations/${Uri.encodeComponent(token)}/decline';
}

class PorterReviewEndpoints {
  const PorterReviewEndpoints();
  String get participations => '/porter-reviews/participations';
  String context(String bookingId) =>
      '/bookings/$bookingId/porter-reviews/context';
  String create(String bookingId) => '/bookings/$bookingId/porter-reviews';
  String update(String reviewId) => '/porter-reviews/$reviewId';
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
  String dangerZoneProposals(String tripId) =>
      '/trips/$tripId/danger-zone-proposals';
  String dangerZoneProposalPhotos(String tripId, String proposalId) =>
      '/trips/$tripId/danger-zone-proposals/$proposalId/photos';
  String offlineBasemap(String tripId, int version, {bool download = false}) =>
      '/trips/$tripId/offline-packages/$version/tiles${download ? '/download' : ''}';
  const TripEndpoints();

  String offlinePackage(String tripId, {int? version}) =>
      '/trips/$tripId/offline-packages/${version ?? 'latest'}';
  String offlinePackageDownload(String tripId, int version) =>
      '/trips/$tripId/offline-packages/$version/download';

  String get assigned => '/trips/assigned';
  String lifecycle(String tripId) => '/trips/$tripId/lifecycle';
  String start(String tripId) => '${lifecycle(tripId)}/start';
  String end(String tripId) => '${lifecycle(tripId)}/end';
  String incidents(String tripId) => '/trips/$tripId/incidents';
  String incidentMedia(String tripId, String id) =>
      '/trips/$tripId/incidents/$id/media';

  String get getAll => '/trips';
  String getById(String id) => '/trips/$id';
  String images(String tripId) => '/trips/$tripId/images';
  String get recommendations => '/trip-recommendations';
  String get regenerateRecommendations => '/trip-recommendations/regenerate';
  String get preferences => '/profiles/me/trip-preferences';
  String recommendationExplanation(String tripId) =>
      '/trip-recommendations/trips/$tripId/explanation';
  String members(String tripId) => '/trips/$tripId/members';
  String gpsLogs(String tripId) => '/trips/$tripId/gps-logs';
  String gpsTrackingContext(String tripId) =>
      '/trips/$tripId/gps-tracking/context';
  String routeDeviationContext(String tripId) =>
      '/trips/$tripId/route-deviation/context';

  String routeRecoveryContext(String tripId) =>
      '/trips/$tripId/route-recovery/context';
  String safetyEvents(String tripId) => '/trips/$tripId/safety-events';
  String deviceSyncStatus(String tripId) => '/trips/$tripId/device-sync/status';
  String scheduleProgress(String tripId) => '/trips/$tripId/schedule-progress';
  String memberLocations(String tripId) => '/trips/$tripId/member-locations';
  String emergencyBroadcasts(String tripId) =>
      '/trips/$tripId/emergency-broadcasts';
  String checkpointArrivals(String tripId) =>
      '/trips/$tripId/automatic-checkpoint-arrivals';
  String checkpointArrivalContext(String tripId) =>
      '/trips/$tripId/automatic-checkpoint-arrivals/context';
}

class WeatherEndpoints {
  const WeatherEndpoints();

  String get riskAssessment => '/weather/risk-assessment';
  String get snapshot => '/weather/snapshots';
  String tripDatesForecast(String tripId) =>
      '/trips/$tripId/weather-forecast/trip-dates';
  String get changeNotices => '/me/weather-notices';
  String readChangeNotice(String noticeId) =>
      '/me/weather-notices/$noticeId/read';
}

class AiEndpoints {
  const AiEndpoints();

  String get conversations => '/ai/conversations';
  String messages(String conversationId) =>
      '/ai/conversations/$conversationId/messages';
  String get feedback => '/ai/answers/feedback';
}

class SosEndpoints {
  const SosEndpoints();

  String get alerts => '/sos-alerts';
  String alertById(String id) => '/sos-alerts/$id';
  String tripSos(String tripId) => '/trips/$tripId/sos';
  String cancel(String tripId, String sosId) =>
      '/trips/$tripId/sos/$sosId/cancel';
  String acknowledge(String tripId, String sosId) =>
      '/trips/$tripId/sos/$sosId/acknowledge';
  String close(String tripId, String sosId) =>
      '/trips/$tripId/sos/$sosId/close';
}
