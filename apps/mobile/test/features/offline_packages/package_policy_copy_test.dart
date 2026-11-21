import 'package:flutter_test/flutter_test.dart';
import 'package:timezone/timezone.dart' as tz;
import 'package:mobile/features/offline_packages/presentation/package_policy_copy.dart';

void main() {
  const codes = [
    'PACKAGE_TRIP_MISMATCH',
    'PACKAGE_HASH_MISMATCH',
    'PACKAGE_ARTIFACT_UNAVAILABLE',
    'PACKAGE_UPDATE_REQUIRED',
    'PACKAGE_VERSION_LOCKED',
    'PACKAGE_TRIP_NOT_PUBLISHED',
    'DEPARTURE_RESPONSIBLE_PORTER_REQUIRED',
    'PACKAGE_ACTIVATION_REQUIRED',
    'PACKAGE_DEPARTURE_NOT_READY',
    'SOURCE_FRESHNESS_UNAVAILABLE',
    'PACKAGE_SOURCE_EXPIRED',
    'NO_REQUIRED_PACKAGE',
    'PACKAGE_DEPARTURE_READY',
  ];
  for (final code in codes) {
    test('$code has Vietnamese copy without a raw API code', () {
      expect(packageReasonLabels.containsKey(code), isTrue);
      expect(packageReasonLabel(code), isNot(contains(code)));
      expect(
        packageReasonLabel(code),
        isNot(matches(RegExp(r'[A-Z]+_[A-Z_]+'))),
      );
      expect(packageReasonLabel(code), contains(RegExp(r'[à-ỹ]')));
    });
  }
  test('unknown codes never leak into the fallback', () {
    expect(
      packageReasonLabel('FUTURE_REASON_CODE'),
      'Chưa thể khởi hành, vui lòng liên hệ chủ chuyến.',
    );
    expect(packageReasonLabel(null), packageReasonLabel('FUTURE_REASON_CODE'));
  });
  test(
    'Vietnam IANA timezone is explicit and does not follow local timezone',
    () {
      expect(packageTime('2026-11-12T03:00:59Z'), '12/11/2026 10:00');
      final previous = tz.local;
      tz.setLocalLocation(tz.getLocation('America/Los_Angeles'));
      try {
        expect(packageTime('2026-11-12T03:00:59Z'), '12/11/2026 10:00');
        expect(
          packageTime('2026-11-12T10:00:59+07:00', timeOnly: true),
          '10:00',
        );
        expect(packageTime('RAW_INVALID_TIMESTAMP'), 'Chưa xác định');
      } finally {
        tz.setLocalLocation(previous);
      }
    },
  );
}
