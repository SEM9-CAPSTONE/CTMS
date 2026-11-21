import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/features/trip_operations/presentation/porter_trips_screen.dart';
import '../porter/porter_trip_test_support.dart';
import 'package:mobile/features/trip_operations/application/trip_operations_providers.dart';
import 'package:mobile/features/trip_operations/data/trip_operations_api.dart';
import 'package:mobile/features/trip_operations/domain/operational_trip.dart';
import 'package:mobile/features/trip_operations/presentation/trip_lifecycle_panel.dart';
import 'package:mobile/features/trip_operations/presentation/trip_operations_copy.dart';

const _key = (accountId: 'porter-account', tripId: 'internal-trip-key');

class _Api implements TripOperationsApi {
  String status = 'published';
  String? block;
  int transitions = 0;
  Object? failure;
  Completer<void>? pending;

  TripLifecycle get value => TripLifecycle.fromJson({
    'status': status,
    'canStart': status == 'published' && block == null,
    'canEnd': status == 'ongoing',
    'startBlockedReason': block,
    'actualStartedAt': status != 'published' ? '2026-11-21T01:00:00Z' : null,
    'actualEndedAt': status == 'completed' ? '2026-11-21T08:00:00Z' : null,
  });

  @override
  Future<List<OperationalTrip>> assigned(String accountId) async => [
    OperationalTrip(
      id: _key.tripId,
      title: 'Đi bộ ven rừng Sơn Trà',
      status: OperationalTripStatus.parse(status),
      startsAt: '2026-11-21T01:00:00Z',
      endsAt: '2026-11-21T08:00:00Z',
      routeName: 'Cung đường Bàn Cờ',
    ),
  ];

  @override
  Future<TripLifecycle> context(String accountId, String tripId) async => value;

  @override
  Future<TripLifecycle> transition(
    String accountId,
    String tripId, {
    required bool start,
  }) async {
    transitions++;
    if (pending != null) await pending!.future;
    if (failure != null) throw failure!;
    status = start ? 'ongoing' : 'completed';
    return value;
  }
}

Future<void> _mount(
  WidgetTester tester,
  _Api api, {
  bool schedule = false,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        porterOperationsAccountProvider.overrideWithValue(_key.accountId),
        tripOperationsApiProvider.overrideWithValue(api),
        ...trackingOverrides(),
      ],
      child: MaterialApp(
        home: schedule
            ? const PorterTripsScreen()
            : const Scaffold(body: TripLifecyclePanel(tripKey: _key)),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _confirm(WidgetTester tester, String label) async {
  await tester.tap(find.text(label));
  await tester.pumpAndSettle();
  await tester.tap(find.widgetWithText(FilledButton, label));
  await tester.pump();
}

void main() {
  testWidgets('cancel confirmation performs no operation', (tester) async {
    final api = _Api();
    await _mount(tester, api);
    await tester.tap(find.text('Bắt đầu chuyến đi'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Quay lại'));
    await tester.pumpAndSettle();
    expect(api.transitions, 0);
    expect(find.text('Chờ khởi hành'), findsOneWidget);
  });

  testWidgets(
    'start then end refreshes server state, displays actual times and hides terminal action',
    (tester) async {
      final api = _Api();
      await _mount(tester, api);
      await _confirm(tester, 'Bắt đầu chuyến đi');
      await tester.pumpAndSettle();
      expect(find.text('Kết thúc chuyến đi'), findsOneWidget);
      expect(find.textContaining('Bắt đầu thực tế:'), findsOneWidget);
      await _confirm(tester, 'Kết thúc chuyến đi');
      await tester.pumpAndSettle();
      expect(find.text('Đã kết thúc'), findsOneWidget);
      expect(find.textContaining('Kết thúc thực tế:'), findsOneWidget);
      expect(find.text('Bắt đầu chuyến đi'), findsNothing);
      expect(find.text('Kết thúc chuyến đi'), findsNothing);
      expect(api.transitions, 2);
      expect(find.textContaining(_key.tripId), findsNothing);
    },
  );

  testWidgets('blocked departure has an explanation and cannot be tapped', (
    tester,
  ) async {
    final api = _Api()..block = 'TRIP_START_TOO_EARLY';
    await _mount(tester, api);
    expect(find.text('Chưa đến giờ khởi hành dự kiến.'), findsOneWidget);
    await tester.tap(find.text('Bắt đầu chuyến đi'));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsNothing);
    expect(api.transitions, 0);
  });

  testWidgets('in-flight transition disables repeated taps', (tester) async {
    final api = _Api()..pending = Completer<void>();
    await _mount(tester, api);
    await _confirm(tester, 'Bắt đầu chuyến đi');
    await tester.pump(const Duration(milliseconds: 300));
    expect(api.transitions, 1);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    api.pending!.complete();
    await tester.pumpAndSettle();
    expect(api.transitions, 1);
  });

  testWidgets(
    'network failure keeps published state and shows Vietnamese error',
    (tester) async {
      final api = _Api()
        ..failure = ApiException(
          'Connection reset by peer',
          kind: ApiExceptionKind.network,
        );
      await _mount(tester, api);
      await _confirm(tester, 'Bắt đầu chuyến đi');
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Cần kết nối mạng để xác nhận.'),
        findsOneWidget,
      );
      expect(find.text('Chờ khởi hành'), findsOneWidget);
      expect(find.textContaining('Connection reset'), findsNothing);
      expect(find.text('Kết thúc chuyến đi'), findsNothing);
    },
  );

  testWidgets(
    'the trip tab shows assigned Trip details and lifecycle actions inline',
    (tester) async {
      final api = _Api();
      await _mount(tester, api, schedule: true);
      expect(find.textContaining('Đi bộ ven rừng Sơn Trà'), findsWidgets);
      expect(find.text('Trekking Sơn Trà – Bãi Bắc'), findsNothing);
      expect(find.text('Xem chuyến đi'), findsNothing);
      expect(find.text('Bắt đầu chuyến đi'), findsOneWidget);
      expect(find.textContaining(_key.tripId), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  test('never exposes raw API error messages', () {
    expect(
      lifecycleError(ApiException('SQL error', statusCode: 500)),
      isNot(contains('SQL')),
    );
    expect(
      lifecycleError(ApiException('Forbidden', statusCode: 403)),
      contains('không còn được phân công'),
    );
    expect(
      lifecycleError(
        ApiException(
          'Conflict',
          statusCode: 409,
          errorData: {'code': 'TRIP_WEATHER_PAUSED'},
        ),
      ),
      'Chuyến đang tạm dừng do thời tiết.',
    );
  });
}
