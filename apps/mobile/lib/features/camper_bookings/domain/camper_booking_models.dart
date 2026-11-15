/// Camper Booking, payment, bank account and refund models (leader follow-up:
/// Camper books a Trip, rents equipment, pays and asks for a refund on mobile).
/// Field names follow the API DTOs in services/api/src/modules/bookings and
/// services/api/src/modules/profiles/dto.
library;

double parseMoney(Object? value) => switch (value) {
  final num number => number.toDouble(),
  final String text => double.tryParse(text) ?? 0,
  _ => 0,
};

DateTime? _date(Object? value) =>
    value is String && value.isNotEmpty ? DateTime.tryParse(value) : null;

/// Equipment the Trip's Host rents out (`GET /equipment-catalog/for-trip/:tripId`).
class RentableEquipment {
  const RentableEquipment({
    required this.id,
    required this.name,
    required this.category,
    required this.quantityTotal,
    required this.rentalPricePerDay,
  });

  factory RentableEquipment.fromJson(Map<String, Object?> json) => RentableEquipment(
    id: json['id'] as String,
    name: json['name'] as String,
    category: (json['category'] as String?) ?? '',
    quantityTotal: (json['quantityTotal'] as num?)?.toInt() ?? 0,
    rentalPricePerDay: parseMoney(json['rentalPricePerDay']),
  );

  final String id;
  final String name;
  final String category;
  final int quantityTotal;
  final double rentalPricePerDay;
}

/// One rented item on a Booking.
class BookedEquipment {
  const BookedEquipment({
    required this.equipmentCatalogItemId,
    required this.name,
    required this.quantity,
    required this.rentalDays,
    required this.totalPrice,
  });

  factory BookedEquipment.fromJson(Map<String, Object?> json) {
    final presentation = json['presentation'];
    final name = presentation is Map ? presentation['currentName'] as String? : null;
    return BookedEquipment(
      equipmentCatalogItemId: json['equipmentCatalogItemId'] as String,
      name: name ?? 'Thiết bị thuê',
      quantity: (json['quantity'] as num?)?.toInt() ?? 0,
      rentalDays: (json['rentalDays'] as num?)?.toInt() ?? 1,
      totalPrice: parseMoney(json['totalPrice']),
    );
  }

  final String equipmentCatalogItemId;
  final String name;
  final int quantity;
  final int rentalDays;
  final double totalPrice;
}

/// A Booking as returned by `POST /bookings`, `PUT /bookings/:id/items`
/// (`booking`), `GET /bookings/:id` and `POST /bookings/:id/sync-payment`.
class CamperBooking {
  const CamperBooking({
    required this.id,
    required this.tripId,
    required this.numPeople,
    required this.status,
    required this.paymentStatus,
    required this.holdExpiresAt,
    required this.basePrice,
    required this.totalAmount,
    this.equipment = const [],
  });

  factory CamperBooking.fromJson(Map<String, Object?> json) => CamperBooking(
    id: json['id'] as String,
    tripId: json['tripId'] as String,
    numPeople: (json['numPeople'] as num?)?.toInt() ?? 1,
    status: (json['status'] as String?) ?? '',
    paymentStatus: (json['paymentStatus'] as String?) ?? '',
    holdExpiresAt: _date(json['holdExpiresAt']),
    basePrice: parseMoney(json['basePrice']),
    totalAmount: parseMoney(json['totalAmount']),
    equipment: [
      for (final item in (json['equipmentItems'] as List<Object?>? ?? const []))
        BookedEquipment.fromJson(item as Map<String, Object?>),
    ],
  );

  final String id;
  final String tripId;
  final int numPeople;
  final String status;
  final String paymentStatus;
  final DateTime? holdExpiresAt;
  final double basePrice;
  final double totalAmount;
  final List<BookedEquipment> equipment;

  bool get awaitingPayment => status == 'pending_payment' && paymentStatus == 'unpaid';
  bool get isPaid => paymentStatus == 'paid';
}

/// Result of `POST /bookings/:id/pay`.
class PaymentStart {
  const PaymentStart({
    required this.paymentStatus,
    required this.bookingStatus,
    required this.bookingPaymentStatus,
    required this.checkoutUrl,
  });

  factory PaymentStart.fromJson(Map<String, Object?> json) => PaymentStart(
    paymentStatus: (json['paymentStatus'] as String?) ?? '',
    bookingStatus: (json['bookingStatus'] as String?) ?? '',
    bookingPaymentStatus: (json['bookingPaymentStatus'] as String?) ?? '',
    checkoutUrl: json['checkoutUrl'] as String?,
  );

  final String paymentStatus;
  final String bookingStatus;
  final String bookingPaymentStatus;
  final String? checkoutUrl;

  bool get isPaid => bookingPaymentStatus == 'paid' || paymentStatus == 'succeeded';
}

/// A receiving bank account (`/profiles/me/bank-accounts`).
class BankAccount {
  const BankAccount({
    required this.id,
    required this.bankName,
    required this.accountNumber,
    required this.accountHolderName,
    required this.isDefault,
  });

  factory BankAccount.fromJson(Map<String, Object?> json) => BankAccount(
    id: json['id'] as String,
    bankName: json['bankName'] as String,
    accountNumber: json['accountNumber'] as String,
    accountHolderName: json['accountHolderName'] as String,
    isDefault: json['isDefault'] as bool? ?? false,
  );

  final String id;
  final String bankName;
  final String accountNumber;
  final String accountHolderName;
  final bool isDefault;

  /// `•••• 6789`, so the full number is not shown in lists.
  String get maskedNumber => accountNumber.length <= 4
      ? accountNumber
      : '•••• ${accountNumber.substring(accountNumber.length - 4)}';
}

class RefundRecord {
  const RefundRecord({
    required this.id,
    required this.amount,
    required this.status,
    required this.reviewStatus,
    required this.reason,
    required this.note,
    required this.failureReason,
    required this.createdAt,
  });

  factory RefundRecord.fromJson(Map<String, Object?> json) => RefundRecord(
    id: json['id'] as String,
    amount: parseMoney(json['amount']),
    status: (json['status'] as String?) ?? '',
    reviewStatus: json['reviewStatus'] as String?,
    reason: json['reason'] as String?,
    note: json['note'] as String?,
    failureReason: json['failureReason'] as String?,
    createdAt: _date(json['createdAt']) ?? DateTime.now(),
  );

  final String id;
  final double amount;
  final String status;
  final String? reviewStatus;
  final String? reason;
  final String? note;
  final String? failureReason;
  final DateTime createdAt;
}

/// `GET /bookings/:id/refunds`.
class RefundInfo {
  const RefundInfo({
    required this.isEligible,
    required this.ineligibleReason,
    required this.origin,
    required this.deadline,
    required this.windowExpired,
    required this.windowDescription,
    required this.totalRefunded,
    required this.remainingRefundable,
    required this.refunds,
    required this.settlementBlocked,
  });

  factory RefundInfo.fromJson(Map<String, Object?> json) {
    final window = json['applicableWindow'];
    return RefundInfo(
      isEligible: json['isEligible'] as bool? ?? false,
      ineligibleReason: json['ineligibleReason'] as String?,
      origin: json['origin'] as String?,
      deadline: window is Map ? _date(window['deadline']) : null,
      windowExpired: window is Map && window['isExpired'] == true,
      windowDescription: window is Map ? window['description'] as String? : null,
      totalRefunded: parseMoney(json['totalRefundedAmount']),
      remainingRefundable: parseMoney(json['remainingRefundableAmount']),
      refunds: [
        for (final item in (json['refunds'] as List<Object?>? ?? const []))
          RefundRecord.fromJson(item as Map<String, Object?>),
      ],
      settlementBlocked: json['settlementBlocked'] as bool? ?? false,
    );
  }

  final bool isEligible;
  final String? ineligibleReason;
  final String? origin;
  final DateTime? deadline;
  final bool windowExpired;
  final String? windowDescription;
  final double totalRefunded;
  final double remainingRefundable;
  final List<RefundRecord> refunds;
  final bool settlementBlocked;

  RefundRecord? get pending {
    for (final refund in refunds) {
      if (refund.status == 'pending') return refund;
    }
    return null;
  }

  /// Same rule as the web RefundStatusCard.
  bool get canRequest => isEligible && pending == null && remainingRefundable > 0;
  bool get fullyRefunded => totalRefunded > 0 && remainingRefundable <= 0 && pending == null;
}
