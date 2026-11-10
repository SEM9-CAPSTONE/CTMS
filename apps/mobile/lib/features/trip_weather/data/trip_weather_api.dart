import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';

DateTime? _date(Object? value) =>
    value is String ? DateTime.tryParse(value) : null;

double _number(Object? value) => value is num ? value.toDouble() : 0;

/// Worst hour of each criterion over the Trip's own dates (CTMS-93 `worstReading`).
class TripWeatherWorstReading {
  const TripWeatherWorstReading({
    required this.rainfallMm,
    required this.windKph,
    required this.temperatureC,
    required this.visibilityM,
    required this.thunderstorm,
  });

  factory TripWeatherWorstReading.fromJson(Map<String, Object?> json) =>
      TripWeatherWorstReading(
        rainfallMm: _number(json['rainfallMm']),
        windKph: _number(json['windKph']),
        temperatureC: _number(json['temperatureC']),
        visibilityM: _number(json['visibilityM']),
        thunderstorm: json['thunderstorm'] == true,
      );

  final double rainfallMm;
  final double windKph;
  final double temperatureC;
  final double visibilityM;
  final bool thunderstorm;
}

/// Forecast for the Trip's own dates as shown to travellers
/// (`GET /trips/:tripId/weather-forecast/trip-dates`), never today's weather.
class TripWeatherForecast {
  const TripWeatherForecast({
    required this.tripId,
    required this.status,
    required this.tripStartsAt,
    required this.tripEndsAt,
    required this.coversWholeTrip,
    required this.horizonDays,
    required this.createdAt,
    this.riskLevel,
    this.forecastTo,
    this.worstReading,
    this.adviceText,
    this.adviceActions = const [],
    this.checkedAt,
  });

  factory TripWeatherForecast.fromJson(Map<String, Object?> json) {
    final worst = json['worstReading'];
    final advice = json['advice'];
    final adviceMap = advice is Map ? advice.cast<String, Object?>() : null;
    return TripWeatherForecast(
      tripId: json['tripId'] as String,
      status: json['status'] as String,
      riskLevel: json['riskLevel'] as String?,
      tripStartsAt: DateTime.parse(json['tripStartsAt'] as String),
      tripEndsAt: DateTime.parse(json['tripEndsAt'] as String),
      forecastTo: _date(json['forecastTo']),
      coversWholeTrip: json['coversWholeTrip'] == true,
      horizonDays: (json['horizonDays'] as num?)?.toInt() ?? 15,
      worstReading: worst is Map
          ? TripWeatherWorstReading.fromJson(worst.cast<String, Object?>())
          : null,
      adviceText: adviceMap?['text'] as String?,
      adviceActions: [
        for (final action in (adviceMap?['actions'] as List? ?? const []))
          if (action is String) action,
      ],
      createdAt: DateTime.parse(json['createdAt'] as String),
      checkedAt: _date(json['checkedAt']),
    );
  }

  final String tripId;

  /// `available` or `out_of_range` (Trip further than [horizonDays] away).
  final String status;

  /// `green`, `yellow` or `red`; null when there is no forecast yet.
  final String? riskLevel;
  final DateTime tripStartsAt;
  final DateTime tripEndsAt;
  final DateTime? forecastTo;
  final bool coversWholeTrip;
  final int horizonDays;
  final TripWeatherWorstReading? worstReading;
  final String? adviceText;
  final List<String> adviceActions;
  final DateTime createdAt;
  final DateTime? checkedAt;

  bool get isAvailable => status == 'available' && riskLevel != null;
}

/// One CTMS-93 notice: the forecast risk level of a Trip changed (`GET /me/weather-notices`).
class WeatherChangeNotice {
  const WeatherChangeNotice({
    required this.id,
    required this.tripId,
    required this.riskLevel,
    required this.previousRiskLevel,
    required this.worsened,
    required this.message,
    required this.createdAt,
    this.readAt,
  });

  factory WeatherChangeNotice.fromJson(Map<String, Object?> json) =>
      WeatherChangeNotice(
        id: json['id'] as String,
        tripId: json['tripId'] as String,
        riskLevel: json['riskLevel'] as String,
        previousRiskLevel: json['previousRiskLevel'] as String,
        worsened: json['worsened'] == true,
        message: json['message'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        readAt: _date(json['readAt']),
      );

  final String id;
  final String tripId;
  final String riskLevel;
  final String previousRiskLevel;
  final bool worsened;

  /// Ready-to-show Vietnamese sentence from the server.
  final String message;
  final DateTime createdAt;
  final DateTime? readAt;

  bool get isUnread => readAt == null;

  WeatherChangeNotice markedRead(DateTime at) => WeatherChangeNotice(
    id: id,
    tripId: tripId,
    riskLevel: riskLevel,
    previousRiskLevel: previousRiskLevel,
    worsened: worsened,
    message: message,
    createdAt: createdAt,
    readAt: at,
  );
}

/// The part of `GET /bookings/:bookingId` the weather reschedule answer needs.
class BookingWeatherState {
  const BookingWeatherState({
    required this.id,
    required this.status,
    required this.weatherReschedulePending,
    this.tripStartsAt,
    this.tripEndsAt,
  });

  factory BookingWeatherState.fromJson(Map<String, Object?> json) =>
      BookingWeatherState(
        id: json['id'] as String,
        status: json['status'] as String?,
        weatherReschedulePending: json['weatherReschedulePending'] == true,
        tripStartsAt: _date(json['tripStartsAtSnapshot']),
        tripEndsAt: _date(json['tripEndsAtSnapshot']),
      );

  final String id;
  final String? status;

  /// CTMS-58: waiting for reconfirmation after a weather reschedule.
  final bool weatherReschedulePending;
  final DateTime? tripStartsAt;
  final DateTime? tripEndsAt;

  bool get canAnswerWeatherReschedule =>
      status == 'pending_reconfirmation' && weatherReschedulePending;
}

abstract interface class TripWeatherApi {
  Future<TripWeatherForecast> fetchForecast(String tripId);
  Future<List<WeatherChangeNotice>> fetchNotices();
  Future<void> markNoticeRead(String noticeId);
  Future<BookingWeatherState> fetchBooking(String bookingId);

  /// Returns the Booking status after the answer: `confirmed` or `cancelled`.
  Future<String> answerReschedule(String bookingId, {required bool accept});
}

class HttpTripWeatherApi implements TripWeatherApi {
  HttpTripWeatherApi(this.client);
  final ApiClient client;

  Map<String, Object?> _map(Object? data) =>
      (data as Map).cast<String, Object?>();

  @override
  Future<TripWeatherForecast> fetchForecast(String tripId) async {
    final response = await client.get<Object?>(
      ApiEndpoints.weather.tripDatesForecast(tripId),
    );
    return TripWeatherForecast.fromJson(_map(response.data));
  }

  @override
  Future<List<WeatherChangeNotice>> fetchNotices() async {
    final response = await client.get<Object?>(
      ApiEndpoints.weather.changeNotices,
    );
    final items = _map(response.data)['items'] as List? ?? const [];
    return [
      for (final item in items)
        WeatherChangeNotice.fromJson((item as Map).cast<String, Object?>()),
    ];
  }

  @override
  Future<void> markNoticeRead(String noticeId) async {
    await client.patch<Object?>(
      ApiEndpoints.weather.readChangeNotice(noticeId),
    );
  }

  @override
  Future<BookingWeatherState> fetchBooking(String bookingId) async {
    final response = await client.get<Object?>(
      ApiEndpoints.bookings.getById(bookingId),
    );
    return BookingWeatherState.fromJson(_map(response.data));
  }

  @override
  Future<String> answerReschedule(
    String bookingId, {
    required bool accept,
  }) async {
    final response = await client.post<Object?>(
      ApiEndpoints.bookings.weatherRescheduleResponse(bookingId),
      data: {'accept': accept},
    );
    return _map(response.data)['status'] as String;
  }
}
