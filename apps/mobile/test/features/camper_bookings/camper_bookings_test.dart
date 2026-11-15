import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/camper/domain/published_trip.dart';
import 'package:mobile/features/camper_bookings/data/camper_bookings_api.dart';
import 'package:mobile/features/camper_bookings/domain/camper_booking_models.dart';
import 'package:mobile/features/camper_bookings/presentation/bank_accounts_screen.dart';
import 'package:mobile/features/camper_bookings/presentation/book_trip_screen.dart';
import 'package:mobile/features/camper_bookings/presentation/booking_order_panel.dart';
import 'package:mobile/features/camper_bookings/presentation/booking_payment_section.dart';
import 'package:mobile/features/camper_bookings/presentation/camper_booking_format.dart';

const tripId = '71717171-7171-4717-8717-717171717171';
const bookingId = 'b7b7b7b7-7171-4717-8717-717171717171';
const tentId = 'e1e1e1e1-7171-4717-8717-717171717171';
final startsAt = DateTime.utc(2026, 12, 20, 1);

PublishedTrip trip({int? seats = 5}) => PublishedTrip(
  id: tripId,
  title: 'Tà Năng – Phan Dũng',
  description: null,
  difficulty: 'moderate',
  startsAt: startsAt,
  endsAt: startsAt.add(const Duration(hours: 30)),
  bookingDeadline: startsAt.subtract(const Duration(days: 3)),
  durationNights: 1,
  pricePerPerson: 1500000,
  remainingSeats: seats,
  isBookable: true,
);

CamperBooking booking({
  String status = 'pending_payment',
  String paymentStatus = 'unpaid',
  double total = 3000000,
  List<Map<String, Object?>> equipment = const [],
}) => CamperBooking.fromJson({
  'id': bookingId,
  'tripId': tripId,
  'numPeople': 2,
  'status': status,
  'paymentStatus': paymentStatus,
  'holdExpiresAt': startsAt.subtract(const Duration(days: 20)).toIso8601String(),
  'basePrice': '3000000.00',
  'totalAmount': total.toStringAsFixed(2),
  'equipmentItems': equipment,
});

BankAccount account(String id, {bool isDefault = false}) => BankAccount.fromJson({
  'id': id,
  'bankName': 'Vietcombank',
  'accountNumber': '0123456789$id',
  'accountHolderName': 'NGUYEN VAN A',
  'isDefault': isDefault,
});

RefundInfo makeRefundInfo({
  bool eligible = true,
  String? origin = 'camper_cancellation',
  List<Map<String, Object?>> refunds = const [],
  String remaining = '1500000.00',
}) => RefundInfo.fromJson({
  'bookingId': bookingId,
  'isEligible': eligible,
  'origin': origin,
  'applicableWindow': {
    'deadline': startsAt.toIso8601String(),
    'isExpired': false,
    'description': 'Trước giờ khởi hành',
  },
  'totalRefundedAmount': '0.00',
  'remainingRefundableAmount': remaining,
  'refunds': refunds,
  'settlementBlocked': false,
  'awaitingResolution': false,
});

class FakeApi implements CamperBookingsApi {
  final calls = <String>[];
  List<RentableEquipment> equipment = [
    RentableEquipment.fromJson({
      'id': tentId,
      'name': 'Lều 2 người',
      'category': 'tent',
      'quantityTotal': 3,
      'rentalPricePerDay': 100000,
    }),
  ];
  CamperBooking current = booking();
  PaymentStart payResult = PaymentStart.fromJson({
    'paymentStatus': 'pending',
    'bookingStatus': 'pending_payment',
    'bookingPaymentStatus': 'unpaid',
    'checkoutUrl': 'https://pay.payos.vn/web/abc',
  });
  bool paidOnSync = true;
  Object? createError;
  List<BankAccount> accounts = [account('1', isDefault: true), account('2')];
  RefundInfo refund = makeRefundInfo();
  Map<String, Object?>? refundRequest;
  Map<String, int>? syncedItems;
  Map<String, Object?>? addedAccount;

  @override
  Future<List<RentableEquipment>> equipmentForTrip(String tripId) async => equipment;

  @override
  Future<CamperBooking> createBooking({
    required String tripId,
    required int numPeople,
    required String idempotencyKey,
  }) async {
    calls.add('create:$numPeople:${idempotencyKey.startsWith('ctms-mobile:booking:')}');
    if (createError != null) throw createError!;
    return current;
  }

  @override
  Future<CamperBooking> syncItems(String bookingId, Map<String, int> quantities) async {
    syncedItems = Map.of(quantities);
    current = booking(
      total: 3300000,
      equipment: [
        {
          'equipmentCatalogItemId': tentId,
          'quantity': 1,
          'rentalDays': 2,
          'totalPrice': '200000.00',
          'presentation': {'currentName': 'Lều 2 người'},
        },
      ],
    );
    return current;
  }

  @override
  Future<CamperBooking> fetchBooking(String bookingId) async {
    calls.add('fetch');
    return current;
  }

  @override
  Future<PaymentStart> pay(String bookingId, {required String idempotencyKey}) async {
    calls.add('pay');
    return payResult;
  }

  @override
  Future<CamperBooking> syncPayment(String bookingId) async {
    calls.add('sync');
    return paidOnSync ? booking(status: 'confirmed', paymentStatus: 'paid') : current;
  }

  @override
  Future<List<BankAccount>> bankAccounts() async => accounts;

  @override
  Future<BankAccount> addBankAccount({
    required String bankName,
    required String accountNumber,
    required String accountHolderName,
    required bool isDefault,
  }) async {
    addedAccount = {
      'bankName': bankName,
      'accountNumber': accountNumber,
      'accountHolderName': accountHolderName,
      'isDefault': isDefault,
    };
    final created = account('3', isDefault: isDefault);
    accounts = [...accounts, created];
    return created;
  }

  @override
  Future<void> deleteBankAccount(String id) async {
    calls.add('delete:$id');
    accounts = accounts.where((item) => item.id != id).toList();
  }

  @override
  Future<void> setDefaultBankAccount(String id) async => calls.add('default:$id');

  @override
  Future<RefundInfo> refundInfo(String bookingId) async => refund;

  @override
  Future<void> requestRefund(
    String bookingId, {
    required String reason,
    required double amount,
    required String? origin,
    required BankAccount account,
    required String idempotencyKey,
  }) async {
    refundRequest = {'reason': reason, 'amount': amount, 'origin': origin, 'account': account.id};
  }
}

Future<List<Uri>> pumpApp(WidgetTester tester, FakeApi api, Widget home) async {
  final opened = <Uri>[];
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 2.0;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        camperBookingsApiProvider.overrideWithValue(api),
        paymentPageLauncherProvider.overrideWithValue((uri) async {
          opened.add(uri);
          return true;
        }),
      ],
      child: MaterialApp(theme: AppTheme.light(), home: home),
    ),
  );
  await tester.pumpAndSettle();
  return opened;
}

Future<void> tapText(WidgetTester tester, String text) async {
  final finder = find.text(text);
  await tester.ensureVisible(finder.first);
  await tester.tap(finder.first);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('books a Trip with equipment, opens PayOS and confirms the payment', (tester) async {
    final api = FakeApi();
    final opened = await pumpApp(tester, api, BookTripScreen(trip: trip()));

    expect(find.text('Còn 5 chỗ'), findsOneWidget);
    await tester.tap(find.byTooltip('Tăng số người'));
    await tester.pumpAndSettle();
    expect(find.text('3.000.000 đ'), findsOneWidget);
    await tapText(tester, 'Tiếp tục');
    expect(api.calls, contains('create:2:true'));

    expect(find.text('Lều 2 người'), findsOneWidget);
    expect(find.textContaining('tính 2 ngày'), findsOneWidget);
    await tester.tap(find.byTooltip('Tăng Lều 2 người'));
    await tester.pumpAndSettle();
    expect(find.text('200.000 đ'), findsOneWidget);
    await tapText(tester, 'Tiếp tục');
    expect(api.syncedItems, {tentId: 1});

    expect(find.text('Xác nhận đơn đặt chỗ'), findsOneWidget);
    expect(find.textContaining('Lều 2 người × 1 · 2 ngày'), findsOneWidget);
    expect(find.text('3.300.000 đ'), findsOneWidget);

    await tapText(tester, 'Thanh toán qua PayOS');
    expect(opened, [Uri.parse('https://pay.payos.vn/web/abc')]);
    expect(find.text('Hoàn tất thanh toán trên trang PayOS'), findsOneWidget);

    await tapText(tester, 'Tôi đã thanh toán');
    expect(find.text('Đặt chỗ thành công'), findsOneWidget);
  });

  testWidgets('skips the equipment save when nothing is rented', (tester) async {
    final api = FakeApi();
    await pumpApp(tester, api, BookTripScreen(trip: trip()));
    await tapText(tester, 'Tiếp tục');
    await tapText(tester, 'Tiếp tục');
    expect(api.syncedItems, isNull);
    expect(find.text('Thanh toán qua PayOS'), findsOneWidget);
  });

  testWidgets('shows a Vietnamese error when the Trip is no longer bookable', (tester) async {
    final api = FakeApi()
      ..createError = ApiException('Trip is not bookable', statusCode: 409, kind: ApiExceptionKind.response);
    await pumpApp(tester, api, BookTripScreen(trip: trip(seats: 1)));
    expect(find.byTooltip('Tăng số người'), findsOneWidget);
    await tapText(tester, 'Tiếp tục');
    expect(find.text('Chuyến đi đã hết chỗ hoặc đã đóng đăng ký.'), findsOneWidget);
    expect(find.text('Số người tham gia'), findsOneWidget);
  });

  testWidgets('order tab: unpaid Booking keeps asking until the payment arrives', (tester) async {
    final api = FakeApi()
      ..paidOnSync = false
      ..refund = makeRefundInfo(origin: null, eligible: false);
    await pumpApp(tester, api, const Scaffold(body: SingleChildScrollView(child: BookingOrderPanel(bookingId: bookingId))));

    expect(find.text('Thanh toán đơn đặt chỗ'), findsOneWidget);
    await tapText(tester, 'Thanh toán qua PayOS');
    await tapText(tester, 'Tôi đã thanh toán');
    expect(find.textContaining('Chưa nhận được thanh toán'), findsOneWidget);
    expect(find.text('Thông tin hoàn tiền'), findsNothing);
  });

  testWidgets('order tab: cancelled Booking sends a refund to the default bank account', (tester) async {
    final api = FakeApi()..current = booking(status: 'cancelled', paymentStatus: 'paid');
    await pumpApp(tester, api, const Scaffold(body: SingleChildScrollView(child: BookingOrderPanel(bookingId: bookingId))));

    expect(find.text('Thanh toán đơn đặt chỗ'), findsNothing);
    expect(find.text('Hoàn tiền sau khi hủy đặt chỗ'), findsOneWidget);
    await tapText(tester, 'Yêu cầu nhận tiền hoàn');

    await tapText(tester, 'Gửi yêu cầu');
    expect(find.text('Lý do phải có ít nhất 5 ký tự'), findsOneWidget);
    expect(api.refundRequest, isNull);

    await tester.enterText(find.byType(TextField).first, 'Tôi bận việc gia đình nên huỷ chuyến.');
    await tapText(tester, 'Gửi yêu cầu');
    expect(api.refundRequest, {
      'reason': 'Tôi bận việc gia đình nên huỷ chuyến.',
      'amount': 1500000.0,
      'origin': 'camper_cancellation',
      'account': '1',
    });
    expect(find.text('Đã gửi yêu cầu hoàn tiền. Vui lòng chờ xét duyệt.'), findsOneWidget);
  });

  testWidgets('order tab: a pending refund shows its status and no new request', (tester) async {
    final api = FakeApi()
      ..current = booking(status: 'cancelled', paymentStatus: 'paid')
      ..refund = makeRefundInfo(
        refunds: [
          {
            'id': 'r-1',
            'amount': '1500000.00',
            'status': 'pending',
            'reviewStatus': 'pending_review',
            'createdAt': startsAt.toIso8601String(),
          },
        ],
      );
    await pumpApp(tester, api, const Scaffold(body: SingleChildScrollView(child: BookingOrderPanel(bookingId: bookingId))));
    expect(find.text('Chờ duyệt'), findsWidgets);
    expect(find.text('Yêu cầu nhận tiền hoàn'), findsNothing);
  });

  testWidgets('order tab: confirmed Booking without a refund case shows no refund card', (tester) async {
    final api = FakeApi()
      ..current = booking(status: 'confirmed', paymentStatus: 'paid')
      ..refund = makeRefundInfo(origin: null, eligible: false);
    await pumpApp(tester, api, const Scaffold(body: SingleChildScrollView(child: BookingOrderPanel(bookingId: bookingId))));
    expect(find.byType(Card), findsNothing);
    expect(find.text('Thông tin hoàn tiền'), findsNothing);
    expect(find.text('Thanh toán đơn đặt chỗ'), findsNothing);
  });

  testWidgets('bank accounts: list, set default, delete and add with validation', (tester) async {
    final api = FakeApi();
    await pumpApp(tester, api, const BankAccountsScreen());

    expect(find.text('Mặc định'), findsOneWidget);
    await tapText(tester, 'Đặt mặc định');
    expect(api.calls, contains('default:2'));

    await tester.tap(find.text('Xoá').last);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Xoá').last);
    await tester.pumpAndSettle();
    expect(api.calls, contains('delete:2'));

    await tapText(tester, 'Thêm tài khoản');
    await tapText(tester, 'Lưu tài khoản');
    expect(find.text('Vui lòng chọn ngân hàng'), findsOneWidget);

    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('BIDV').last);
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Số tài khoản *'), '12 34');
    await tester.enterText(find.widgetWithText(TextFormField, 'Tên chủ tài khoản *'), 'Nguyễn Văn Đức');
    await tapText(tester, 'Lưu tài khoản');
    expect(find.text('Số tài khoản chỉ gồm chữ và số, không có khoảng trắng'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextFormField, 'Số tài khoản *'), '1234567890');
    await tapText(tester, 'Lưu tài khoản');
    expect(api.addedAccount, {
      'bankName': 'BIDV',
      'accountNumber': '1234567890',
      'accountHolderName': 'NGUYEN VAN DUC',
      'isDefault': true,
    });
    expect(find.text('Đã thêm tài khoản ngân hàng.'), findsOneWidget);
  });

  test('helpers', () {
    expect(normalizeAccountHolderName('  trần   thị Ánh  '), 'TRAN THI ANH');
    expect(rentalDaysFor(startsAt, startsAt.add(const Duration(hours: 30))), 2);
    expect(rentalDaysFor(startsAt, startsAt), 1);
    expect(account('9').maskedNumber, '•••• 7899');
    expect(
      bookingErrorText(
        ApiException('Tài khoản ngân hàng này đã được liên kết', statusCode: 409, kind: ApiExceptionKind.response),
      ),
      'Tài khoản ngân hàng này đã được liên kết',
    );
    expect(newIdempotencyKey('pay:x'), matches(RegExp(r'^[A-Za-z0-9._:-]{1,128}$')));
  });
}
