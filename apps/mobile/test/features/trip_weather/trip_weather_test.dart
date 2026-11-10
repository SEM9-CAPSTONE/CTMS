import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/trip_weather/application/trip_weather_controller.dart';
import 'package:mobile/features/trip_weather/data/trip_weather_api.dart';
import 'package:mobile/features/trip_weather/presentation/trip_weather_panel.dart';
import 'package:mobile/features/trip_weather/presentation/weather_reschedule_response_card.dart';

const tripId = '62626262-6262-4626-8626-626262626262';
const bookingId = 'b0b0b0b0-6262-4626-8626-626262626262';
final now = DateTime.utc(2026, 11, 10, 1);

TripWeatherForecast forecast({
  String status = 'available',
  String? riskLevel = 'red',
  bool coversWholeTrip = true,
  Duration startsIn = const Duration(days: 2),
}) => TripWeatherForecast.fromJson({
  'id': 'f-1',
  'tripId': tripId,
  'status': status,
  'riskLevel': riskLevel,
  'tripStartsAt': now.add(startsIn).toIso8601String(),
  'tripEndsAt': now.add(startsIn + const Duration(hours: 30)).toIso8601String(),
  'forecastFrom': now.add(startsIn).toIso8601String(),
  'forecastTo': coversWholeTrip
      ? null
      : now.add(startsIn + const Duration(hours: 12)).toIso8601String(),
  'coversWholeTrip': coversWholeTrip,
  'worstReading': status == 'available'
      ? {
          'rainfallMm': 42.5,
          'windKph': 55,
          'temperatureC': 9,
          'visibilityM': 800,
          'thunderstorm': true,
        }
      : null,
  'advice': status == 'available'
      ? {
          'text': 'Mưa lớn và dông trên đỉnh, cân nhắc hoãn.',
          'actions': ['Mang áo mưa', 'Theo dõi thông báo của Host'],
          'generatedAt': now.toIso8601String(),
        }
      : null,
  'horizonDays': 15,
  'createdAt': now.toIso8601String(),
  'checkedAt': now.toIso8601String(),
});

WeatherChangeNotice notice(
  String id, {
  String trip = tripId,
  bool read = false,
}) => WeatherChangeNotice.fromJson({
  'id': id,
  'tripId': trip,
  'forecastId': 'f-1',
  'tripTitle': 'Tà Năng – Phan Dũng',
  'tripStartsAt': now.toIso8601String(),
  'previousRiskLevel': 'yellow',
  'riskLevel': 'red',
  'worsened': true,
  'message': 'Dự báo cho Trip $id chuyển từ Vàng sang Đỏ.',
  'readAt': read ? now.toIso8601String() : null,
  'createdAt': now.toIso8601String(),
});

BookingWeatherState booking({
  bool weather = true,
  String status = 'pending_reconfirmation',
}) => BookingWeatherState.fromJson({
  'id': bookingId,
  'status': status,
  'weatherReschedulePending': weather,
  'tripStartsAtSnapshot': now.add(const Duration(days: 10)).toIso8601String(),
  'tripEndsAtSnapshot': now.add(const Duration(days: 11)).toIso8601String(),
});

class FakeApi implements TripWeatherApi {
  Object forecastResult = forecast();
  List<WeatherChangeNotice> noticeList = const [];
  Object bookingResult = booking();
  Object answerResult = 'confirmed';
  int forecastCalls = 0;
  final readIds = <String>[];
  final answers = <bool>[];

  @override
  Future<TripWeatherForecast> fetchForecast(String tripId) async {
    forecastCalls++;
    final result = forecastResult;
    if (result is Exception) throw result;
    return result as TripWeatherForecast;
  }

  @override
  Future<List<WeatherChangeNotice>> fetchNotices() async => noticeList;

  @override
  Future<void> markNoticeRead(String noticeId) async => readIds.add(noticeId);

  @override
  Future<BookingWeatherState> fetchBooking(String bookingId) async {
    final result = bookingResult;
    if (result is Exception) throw result;
    return result as BookingWeatherState;
  }

  @override
  Future<String> answerReschedule(
    String bookingId, {
    required bool accept,
  }) async {
    answers.add(accept);
    final result = answerResult;
    if (result is Exception) throw result;
    return result as String;
  }
}

Future<void> pump(
  WidgetTester tester,
  FakeApi api, {
  String? booking = bookingId,
}) async {
  final key = (tripId: tripId, bookingId: booking);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        tripWeatherControllerProvider(key).overrideWith(
          (ref) => TripWeatherController(
            tripId: tripId,
            bookingId: booking,
            api: api,
            refreshInterval: const Duration(hours: 1),
            now: () => now,
          ),
        ),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(
          body: SingleChildScrollView(
            child: Column(
              children: [
                WeatherRescheduleResponseCard(
                  tripId: tripId,
                  bookingId: booking,
                ),
                TripWeatherPanel(tripId: tripId, bookingId: booking),
                Consumer(
                  builder: (context, ref, _) => Text(
                    'highlight:${tripWeatherHighlightValue(ref.watch(tripWeatherControllerProvider(key)), 'An toàn')}',
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'shows the Red forecast for the Trip dates with readings, advice and reliability',
    (tester) async {
      final api = FakeApi()..forecastResult = forecast(coversWholeTrip: false);
      await pump(tester, api);

      expect(find.text('Dự báo thời tiết ngày đi'), findsOneWidget);
      expect(find.text('Nguy hiểm (Đỏ)'), findsOneWidget);
      expect(find.text('Độ tin cậy cao'), findsOneWidget);
      expect(find.text('42.5 mm'), findsOneWidget);
      expect(find.text('55 km/h'), findsOneWidget);
      expect(find.text('9°C'), findsOneWidget);
      expect(find.text('800 m'), findsOneWidget);
      expect(find.text('Có'), findsOneWidget);
      expect(find.byKey(const Key('trip-weather-partial')), findsOneWidget);
      expect(
        find.text('Mưa lớn và dông trên đỉnh, cân nhắc hoãn.'),
        findsOneWidget,
      );
      expect(find.text('• Mang áo mưa'), findsOneWidget);
      expect(find.textContaining('Kiểm tra lần cuối:'), findsOneWidget);
      expect(find.text('highlight:Nguy hiểm'), findsOneWidget);
    },
  );

  testWidgets(
    'explains a Trip beyond the forecast horizon instead of using today\'s weather',
    (tester) async {
      final api = FakeApi()
        ..forecastResult = forecast(
          status: 'out_of_range',
          riskLevel: null,
          startsIn: const Duration(days: 30),
        );
      await pump(tester, api);

      expect(find.byKey(const Key('trip-weather-empty')), findsOneWidget);
      expect(find.textContaining('còn xa hơn 15 ngày'), findsOneWidget);
      expect(find.byKey(const Key('trip-weather-risk')), findsNothing);
      expect(find.text('highlight:Chưa có dự báo'), findsOneWidget);
    },
  );

  testWidgets('shows a Vietnamese error and retries', (tester) async {
    final api = FakeApi()
      ..forecastResult = ApiException('down', statusCode: 503);
    await pump(tester, api);

    expect(
      find.text(
        'Dịch vụ thời tiết tạm thời không khả dụng. Vui lòng thử lại sau.',
      ),
      findsOneWidget,
    );
    expect(find.text('highlight:Chưa có dự báo'), findsOneWidget);

    api.forecastResult = forecast(riskLevel: 'green');
    await tester.tap(find.text('Thử lại'));
    await tester.pumpAndSettle();
    expect(api.forecastCalls, 2);
    expect(find.text('An toàn (Xanh)'), findsOneWidget);
  });

  testWidgets(
    'lists only this Trip\'s risk-change notices and marks one read on tap',
    (tester) async {
      final api = FakeApi()
        ..noticeList = [
          notice('n-1'),
          notice('n-2', read: true),
          notice('n-x', trip: 'other'),
        ];
      await pump(tester, api);

      expect(find.text('Thay đổi dự báo'), findsOneWidget);
      expect(find.byKey(const Key('trip-weather-notice-n-1')), findsOneWidget);
      expect(find.byKey(const Key('trip-weather-notice-n-2')), findsOneWidget);
      expect(find.byKey(const Key('trip-weather-notice-n-x')), findsNothing);
      expect(
        find.byKey(const Key('trip-weather-notice-unread-n-1')),
        findsOneWidget,
      );
      expect(
        find.byKey(const Key('trip-weather-notice-unread-n-2')),
        findsNothing,
      );

      await tester.tap(find.byKey(const Key('trip-weather-notice-n-1')));
      await tester.pumpAndSettle();
      expect(api.readIds, ['n-1']);
      expect(
        find.byKey(const Key('trip-weather-notice-unread-n-1')),
        findsNothing,
      );
    },
  );

  testWidgets(
    'hides the reschedule answer for an ordinary reschedule (CTMS-58 flag false)',
    (tester) async {
      final api = FakeApi()..bookingResult = booking(weather: false);
      await pump(tester, api);
      expect(
        find.byKey(const Key('weather-reschedule-response-card')),
        findsNothing,
      );
    },
  );

  testWidgets('hides the reschedule answer when the screen has no Booking', (
    tester,
  ) async {
    await pump(tester, FakeApi(), booking: null);
    expect(
      find.byKey(const Key('weather-reschedule-response-card')),
      findsNothing,
    );
    expect(find.byKey(const Key('trip-weather-panel')), findsOneWidget);
  });

  testWidgets('keeps the new date after confirmation', (tester) async {
    final api = FakeApi();
    await pump(tester, api);

    expect(find.text('Trip đã dời lịch vì thời tiết'), findsOneWidget);
    await tester.tap(find.byKey(const Key('weather-reschedule-keep')));
    await tester.pumpAndSettle();
    expect(find.text('Giữ chỗ ở lịch mới?'), findsOneWidget);

    api.bookingResult = booking(weather: false, status: 'confirmed');
    await tester.tap(find.text('Xác nhận'));
    await tester.pumpAndSettle();
    expect(api.answers, [true]);
    expect(
      find.byKey(const Key('weather-reschedule-answered')),
      findsOneWidget,
    );
    expect(find.text('Bạn đã giữ chỗ ở lịch mới.'), findsOneWidget);
  });

  testWidgets('does nothing when the Camper backs out of the decline dialog', (
    tester,
  ) async {
    final api = FakeApi();
    await pump(tester, api);

    await tester.tap(find.byKey(const Key('weather-reschedule-decline')));
    await tester.pumpAndSettle();
    expect(find.text('Huỷ và nhận hoàn 100%?'), findsOneWidget);
    await tester.tap(find.text('Quay lại'));
    await tester.pumpAndSettle();
    expect(api.answers, isEmpty);
    expect(
      find.byKey(const Key('weather-reschedule-response-card')),
      findsOneWidget,
    );
  });

  testWidgets('explains the server refusal of a decline in Vietnamese', (
    tester,
  ) async {
    final api = FakeApi()
      ..answerResult = ApiException(
        'Conflict',
        statusCode: 409,
        errorData: {
          'message': 'The Trip was not rescheduled because of the weather',
        },
      );
    await pump(tester, api);

    await tester.tap(find.byKey(const Key('weather-reschedule-decline')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Xác nhận'));
    await tester.pumpAndSettle();
    expect(api.answers, [false]);
    expect(find.byKey(const Key('weather-reschedule-error')), findsOneWidget);
    expect(find.textContaining('không phải vì thời tiết'), findsOneWidget);
    expect(
      find.byKey(const Key('weather-reschedule-response-card')),
      findsOneWidget,
    );
  });
}
