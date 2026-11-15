import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../domain/camper_booking_models.dart';

/// A fresh `Idempotency-Key` for one Booking create / pay / refund attempt.
/// Allowed characters follow the API (`^[A-Za-z0-9._:-]+$`, max 128).
String newIdempotencyKey(String scope) {
  final random = Random.secure();
  final suffix = List.generate(16, (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
  return 'ctms-mobile:$scope:$suffix';
}

abstract interface class CamperBookingsApi {
  Future<List<RentableEquipment>> equipmentForTrip(String tripId);
  Future<CamperBooking> createBooking({
    required String tripId,
    required int numPeople,
    required String idempotencyKey,
  });
  Future<CamperBooking> syncItems(String bookingId, Map<String, int> quantities);
  Future<CamperBooking> fetchBooking(String bookingId);
  Future<PaymentStart> pay(String bookingId, {required String idempotencyKey});
  Future<CamperBooking> syncPayment(String bookingId);

  Future<List<BankAccount>> bankAccounts();
  Future<BankAccount> addBankAccount({
    required String bankName,
    required String accountNumber,
    required String accountHolderName,
    required bool isDefault,
  });
  Future<void> deleteBankAccount(String id);
  Future<void> setDefaultBankAccount(String id);

  Future<RefundInfo> refundInfo(String bookingId);
  Future<void> requestRefund(
    String bookingId, {
    required String reason,
    required double amount,
    required String? origin,
    required BankAccount account,
    required String idempotencyKey,
  });
}

class HttpCamperBookingsApi implements CamperBookingsApi {
  const HttpCamperBookingsApi(this._client);

  final ApiClient _client;
  static const _endpoints = ApiEndpoints.bookings;

  @override
  Future<List<RentableEquipment>> equipmentForTrip(String tripId) async {
    final response = await _client.get<List<Object?>>(_endpoints.equipmentForTrip(tripId));
    return [
      for (final item in response.data ?? const <Object?>[])
        RentableEquipment.fromJson(item as Map<String, Object?>),
    ];
  }

  @override
  Future<CamperBooking> createBooking({
    required String tripId,
    required int numPeople,
    required String idempotencyKey,
  }) async {
    final response = await _client.post<Map<String, Object?>>(
      _endpoints.create,
      data: {'tripId': tripId, 'numPeople': numPeople},
      headers: {'Idempotency-Key': idempotencyKey},
    );
    return CamperBooking.fromJson(response.data!);
  }

  @override
  Future<CamperBooking> syncItems(String bookingId, Map<String, int> quantities) async {
    final response = await _client.put<Map<String, Object?>>(
      _endpoints.items(bookingId),
      data: {
        'items': [
          for (final entry in quantities.entries)
            if (entry.value > 0) {'equipmentCatalogItemId': entry.key, 'quantity': entry.value},
        ],
      },
    );
    return CamperBooking.fromJson(response.data!['booking'] as Map<String, Object?>);
  }

  @override
  Future<CamperBooking> fetchBooking(String bookingId) async {
    final response = await _client.get<Map<String, Object?>>(_endpoints.getById(bookingId));
    return CamperBooking.fromJson(response.data!);
  }

  @override
  Future<PaymentStart> pay(String bookingId, {required String idempotencyKey}) async {
    final response = await _client.post<Map<String, Object?>>(
      _endpoints.pay(bookingId),
      data: {'method': 'vietqr'},
      headers: {'Idempotency-Key': idempotencyKey},
    );
    return PaymentStart.fromJson(response.data!);
  }

  @override
  Future<CamperBooking> syncPayment(String bookingId) async {
    final response = await _client.post<Map<String, Object?>>(_endpoints.syncPayment(bookingId));
    return CamperBooking.fromJson(response.data!);
  }

  @override
  Future<List<BankAccount>> bankAccounts() async {
    final response = await _client.get<List<Object?>>(_endpoints.bankAccounts);
    return [
      for (final item in response.data ?? const <Object?>[])
        BankAccount.fromJson(item as Map<String, Object?>),
    ];
  }

  @override
  Future<BankAccount> addBankAccount({
    required String bankName,
    required String accountNumber,
    required String accountHolderName,
    required bool isDefault,
  }) async {
    final response = await _client.post<Map<String, Object?>>(
      _endpoints.bankAccounts,
      data: {
        'bankName': bankName,
        'accountNumber': accountNumber,
        'accountHolderName': accountHolderName,
        'isDefault': isDefault,
      },
    );
    return BankAccount.fromJson(response.data!);
  }

  @override
  Future<void> deleteBankAccount(String id) => _client.delete<Object?>(_endpoints.bankAccount(id));

  @override
  Future<void> setDefaultBankAccount(String id) =>
      _client.patch<Object?>(_endpoints.defaultBankAccount(id));

  @override
  Future<RefundInfo> refundInfo(String bookingId) async {
    final response = await _client.get<Map<String, Object?>>(_endpoints.refunds(bookingId));
    return RefundInfo.fromJson(response.data!);
  }

  @override
  Future<void> requestRefund(
    String bookingId, {
    required String reason,
    required double amount,
    required String? origin,
    required BankAccount account,
    required String idempotencyKey,
  }) => _client.post<Object?>(
    _endpoints.refunds(bookingId),
    data: {
      'reason': reason,
      // Whole đồng, the same as the web form (full remaining amount).
      'amount': amount.floor().toString(),
      'origin': ?origin,
      'bankName': account.bankName,
      'accountNumber': account.accountNumber,
      'accountHolderName': account.accountHolderName.trim().toUpperCase(),
    },
    headers: {'Idempotency-Key': idempotencyKey},
  );
}

final camperBookingsApiProvider = Provider<CamperBookingsApi>(
  (ref) => HttpCamperBookingsApi(ref.watch(apiClientProvider)),
);

final bankAccountsProvider = FutureProvider.autoDispose<List<BankAccount>>(
  (ref) => ref.watch(camperBookingsApiProvider).bankAccounts(),
);

final rentableEquipmentProvider = FutureProvider.autoDispose.family<List<RentableEquipment>, String>(
  (ref, tripId) => ref.watch(camperBookingsApiProvider).equipmentForTrip(tripId),
);

final camperBookingProvider = FutureProvider.autoDispose.family<CamperBooking, String>(
  (ref, bookingId) => ref.watch(camperBookingsApiProvider).fetchBooking(bookingId),
);

final refundInfoProvider = FutureProvider.autoDispose.family<RefundInfo, String>(
  (ref, bookingId) => ref.watch(camperBookingsApiProvider).refundInfo(bookingId),
);
