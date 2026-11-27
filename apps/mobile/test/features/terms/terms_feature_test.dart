import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/features/terms/application/terms_providers.dart';
import 'package:mobile/features/terms/domain/terms_models.dart';
import 'package:mobile/features/terms/presentation/terms_screen.dart';
import 'package:mobile/features/terms/presentation/widgets/terms_reconsent_dialog.dart';

const _sectionTitles = [
  'Quy định chung',
  'Tài khoản và vai trò',
  'Đặt chỗ và thanh toán',
  'Hủy chuyến',
  'Hoạt động trekking',
  'Host và Porter',
  'Bản đồ và dữ liệu thời tiết',
  'Trợ lý sinh tồn AI',
  'SOS và tình huống khẩn cấp',
  'Dữ liệu người dùng',
  'Vi phạm và xử lý tài khoản',
  'Thay đổi điều khoản',
];

TermsVersionDetail _sampleTerms({
  String version = '1.0',
  String effectiveDate = '2026-11-27',
  bool isActive = true,
}) {
  return TermsVersionDetail(
    id: 'terms-$version',
    version: version,
    title: 'Điều khoản và Điều kiện sử dụng CTMS',
    summary: 'Phiên bản $version gồm 12 mục.',
    effectiveDate: effectiveDate,
    isActive: isActive,
    requiresReconsent: true,
    publishedAt: '2026-11-27T00:00:00.000Z',
    sections: List.generate(
      12,
      (index) => TermsSection(
        number: index + 1,
        slug: 'section-${index + 1}',
        title: _sectionTitles[index],
        subsections: [
          TermsSubsection(
            code: '${index + 1}.1',
            title: 'Chi tiết mục ${index + 1}',
            body: 'Nội dung mục ${index + 1}: ${_sectionTitles[index]}.',
          ),
        ],
      ),
    ),
  );
}

void main() {
  group('TermsScreen', () {
    testWidgets(
      'displays version, effective date, and all 12 expandable/collapsible sections',
      (tester) async {
        final v1 = _sampleTerms();

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              currentTermsProvider.overrideWith((ref) async => v1),
            ],
            child: const MaterialApp(home: TermsScreen()),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Phiên bản: v1.0'), findsOneWidget);
        expect(find.text('Hiệu lực: 27/11/2026'), findsOneWidget);
        expect(find.text('Lịch sử phiên bản'), findsNothing);

        // Section 1 is expanded by default
        expect(find.text('1. Quy định chung'), findsOneWidget);
        expect(find.text('1.1. Chi tiết mục 1'), findsOneWidget);

        // Collapse section 1
        await tester.tap(find.byKey(const ValueKey('terms-section-header-1')));
        await tester.pumpAndSettle();
        expect(find.text('1.1. Chi tiết mục 1'), findsNothing);

        // Scroll and verify section 12 exists and expands
        await tester.scrollUntilVisible(
          find.text('12. Thay đổi điều khoản'),
          300,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.ensureVisible(
          find.byKey(const ValueKey('terms-section-header-12')),
        );
        await tester.pumpAndSettle();
        expect(find.text('12. Thay đổi điều khoản'), findsOneWidget);
        await tester.tap(find.byKey(const ValueKey('terms-section-header-12')));
        await tester.pumpAndSettle();
        expect(find.text('12.1. Chi tiết mục 12'), findsOneWidget);
      },
    );
  });

  group('TermsReconsentDialog', () {
    const status = MyTermsStatus(
      currentVersion: '1.1',
      currentTitle: 'Điều khoản và Điều kiện sử dụng CTMS',
      currentEffectiveDate: '2026-12-01',
      requiresReconsent: true,
      acceptedCurrentVersion: false,
      needsReconsent: true,
      acceptanceHistory: [],
    );

    testWidgets('supports "Để sau" without triggering acceptance', (
      tester,
    ) async {
      var deferred = false;
      var accepted = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TermsReconsentDialog(
              status: status,
              loadTerms: () async => _sampleTerms(version: '1.1'),
              onDefer: () => deferred = true,
              onAccept: (v) async {
                accepted = true;
                return AcceptTermsResult(
                  accepted: true,
                  version: v,
                  effectiveDate: '2026-12-01',
                  acceptedAt: '2026-12-02T09:00:00.000Z',
                  alreadyAccepted: false,
                );
              },
              onDone: () {},
            ),
          ),
        ),
      );

      expect(find.text('Cập nhật Điều khoản sử dụng'), findsOneWidget);
      await tester.tap(find.text('Để sau'));
      await tester.pumpAndSettle();

      expect(deferred, isTrue);
      expect(accepted, isFalse);
    });

    testWidgets(
      'supports "Xem và đồng ý", reads new version, confirms and displays version & date',
      (tester) async {
        String? acceptedVersion;
        var doneCalled = false;

        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: TermsReconsentDialog(
                status: status,
                loadTerms: () async => _sampleTerms(
                  version: '1.1',
                  effectiveDate: '2026-12-01',
                ),
                onDefer: () {},
                onAccept: (v) async {
                  acceptedVersion = v;
                  return AcceptTermsResult(
                    accepted: true,
                    version: v,
                    effectiveDate: '2026-12-01',
                    acceptedAt: '2026-12-02T09:00:00.000Z',
                    alreadyAccepted: false,
                  );
                },
                onDone: () => doneCalled = true,
              ),
            ),
          ),
        );

        await tester.tap(find.text('Xem và đồng ý'));
        await tester.pumpAndSettle();

        expect(find.text('1. Quy định chung'), findsOneWidget);

        await tester.tap(find.byType(Checkbox));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Xác nhận đồng ý'));
        await tester.pumpAndSettle();

        expect(acceptedVersion, '1.1');
        expect(find.text('Đã đồng ý điều khoản'), findsOneWidget);
        expect(find.textContaining('v1.1'), findsWidgets);
        expect(find.textContaining('02/12/2026'), findsWidgets);

        await tester.tap(find.text('Tiếp tục sử dụng'));
        await tester.pumpAndSettle();
        expect(doneCalled, isTrue);
      },
    );

    testWidgets(
      'handles 409 TERMS_VERSION_OUTDATED by reloading terms and unchecking box',
      (tester) async {
        var loadCalls = 0;

        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: TermsReconsentDialog(
                status: status,
                loadTerms: () async {
                  loadCalls++;
                  return _sampleTerms(
                    version: loadCalls == 1 ? '1.1' : '1.2',
                    effectiveDate: '2026-12-05',
                  );
                },
                onDefer: () {},
                onAccept: (_) async {
                  throw ApiException(
                    'Conflict',
                    statusCode: 409,
                    errorData: {
                      'statusCode': 409,
                      'code': termsVersionOutdatedCode,
                      'currentVersion': '1.2',
                    },
                    kind: ApiExceptionKind.response,
                  );
                },
                onDone: () {},
              ),
            ),
          ),
        );

        await tester.tap(find.text('Xem và đồng ý'));
        await tester.pumpAndSettle();
        await tester.tap(find.byType(Checkbox));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Xác nhận đồng ý'));
        await tester.pumpAndSettle();

        expect(loadCalls, 2);
        expect(find.textContaining('phiên bản mới hơn'), findsOneWidget);
        final checkbox = tester.widget<Checkbox>(find.byType(Checkbox));
        expect(checkbox.value, isFalse);
      },
    );
  });
}
