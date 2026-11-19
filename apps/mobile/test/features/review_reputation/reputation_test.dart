import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/features/auth/application/auth_controller.dart';
import 'package:mobile/features/auth/domain/auth_user.dart';
import 'package:mobile/features/auth/domain/user_role.dart';
import 'package:mobile/features/camper/data/camper_explore_api.dart';
import 'package:mobile/features/camper/domain/published_trip.dart';
import 'package:mobile/features/porter_reviews/domain/porter_review_models.dart';
import 'package:mobile/features/review_reputation/host_reputation_panel.dart';
import 'package:mobile/features/review_reputation/reputation_summary.dart';
import 'package:mobile/features/review_reputation/review_reputation.dart';

class Auth extends AuthController {
  @override
  Future<AuthUser?> build() async => const AuthUser(
    id: 'a',
    email: 'camper@ctms.local',
    role: UserRole.camper,
  );
  void switchAccount() {
    state = const AsyncData(
      AuthUser(id: 'b', email: 'another@example.test', role: UserRole.camper),
    );
  }
}

PublishedTrip trip({ReviewReputation? rating, String? account = 'a'}) =>
    PublishedTrip(
      id: 'trip',
      title: 'Khám phá bán đảo Sơn Trà',
      description: null,
      difficulty: 'easy',
      startsAt: DateTime.utc(2026),
      endsAt: DateTime.utc(2026),
      bookingDeadline: DateTime.utc(2026),
      durationNights: 0,
      pricePerPerson: 0,
      remainingSeats: 10,
      isBookable: true,
      hostName: 'Nguyễn Thị Mai',
      hostReputation: rating,
      loadedForAccount: account,
    );

void main() {
  test(
    'decimal half-up presentation and count, including exactly one vote',
    () {
      expect(const ReviewReputation(4.25, 12).label, '4,3/5 · 12 đánh giá');
      expect(const ReviewReputation(4.35, 12).label, '4,4/5 · 12 đánh giá');
      expect(const ReviewReputation(5, 1).label, '5,0/5 · 1 đánh giá');
      expect(const ReviewReputation(null, 0).semantics, 'Chưa có đánh giá');
      expect(
        ReviewReputation.fromJson({'ratingAverage': null, 'ratingCount': 1}),
        isNull,
      );
      expect(ReviewReputation.fromJson(null), isNull);
    },
  );
  testWidgets(
    'one accessible label, absent block and large text do not overflow',
    (tester) async {
      final semantics = tester.ensureSemantics();
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 260,
              child: MediaQuery(
                data: MediaQueryData(textScaler: TextScaler.linear(2)),
                child: ReputationSummary(value: ReviewReputation(4.25, 12)),
              ),
            ),
          ),
        ),
      );
      expect(
        find.bySemanticsLabel('Điểm uy tín 4,3 trên 5, 12 đánh giá'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const MaterialApp(home: ReputationSummary()));
      expect(find.byType(Row), findsNothing);
      semantics.dispose();
    },
  );
  test(
    'retained reviews read reputation only from the authoritative review block',
    () {
      final base = <String, Object?>{
        'serverTime': '2026-11-18T03:00:00Z',
        'expiresAt': null,
        'eligible': false,
        'reason': null,
        'porters': <Object?>[],
        'reviews': [
          <String, Object?>{
            'id': 'review',
            'porterId': 'porter',
            'porterName': 'Nguyễn Minh Sơn',
            'rating': 4,
            'comment': null,
            'revision': 1,
            'canEdit': false,
            'moderationStatus': 'visible',
            'editExpiresAt': '2026-11-18T03:00:00Z',
            'reputation': {'ratingAverage': 4.25, 'ratingCount': 12},
          },
        ],
      };
      expect(
        PorterReviewContext.fromJson(
          base,
        ).porters.single.reputation!.ratingCount,
        12,
      );
      final saved = (base['reviews'] as List).single as Map<String, Object?>;
      saved.remove('reputation');
      expect(
        PorterReviewContext.fromJson(base).porters.single.reputation,
        isNull,
      );
    },
  );
  for (final status in [null, 503, 401, 403, 404]) {
    testWidgets('refresh status $status retains only transport failures', (
      tester,
    ) async {
      var fail = false;
      final container = ProviderContainer(
        overrides: [
          authControllerProvider.overrideWith(Auth.new),
          publishedTripDetailsProvider.overrideWith((ref, id) async {
            if (fail) throw ApiException('failure', statusCode: status);
            return trip(rating: const ReviewReputation(4.25, 12));
          }),
        ],
      );
      addTearDown(container.dispose);
      await container.read(authControllerProvider.future);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(
            home: Scaffold(body: HostReputationPanel(tripId: 'trip')),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('4,3/5 · 12 đánh giá'), findsOneWidget);
      fail = true;
      container.invalidate(publishedTripDetailsProvider('trip'));
      await tester.pumpAndSettle();
      final denied = [401, 403, 404].contains(status);
      expect(
        find.text('4,3/5 · 12 đánh giá'),
        denied ? findsNothing : findsOneWidget,
      );
      expect(
        find.text(
          denied ? ReputationStrings.unavailable : ReputationStrings.stale,
        ),
        findsOneWidget,
      );
      if (!denied) {
        fail = false;
        await tester.tap(find.text(ReputationStrings.retry));
        await tester.pumpAndSettle();
        expect(find.text('4,3/5 · 12 đánh giá'), findsOneWidget);
        expect(find.text(ReputationStrings.stale), findsNothing);
      }
    });
  }
  testWidgets(
    'a new account cannot see a cached or late snapshot for the former viewer',
    (tester) async {
      final pending = Completer<PublishedTrip>();
      final container = ProviderContainer(
        overrides: [
          authControllerProvider.overrideWith(Auth.new),
          publishedTripDetailsProvider.overrideWith((ref, id) {
            final account = ref.watch(authControllerProvider).valueOrNull?.id;
            if (account == 'a') return pending.future;
            return Future.value(
              trip(account: 'b', rating: const ReviewReputation(null, 0)),
            );
          }),
        ],
      );
      addTearDown(container.dispose);
      await container.read(authControllerProvider.future);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(
            home: Scaffold(body: HostReputationPanel(tripId: 'trip')),
          ),
        ),
      );
      await tester.pump();
      (container.read(authControllerProvider.notifier) as Auth).switchAccount();
      await tester.pumpAndSettle();
      pending.complete(trip(rating: const ReviewReputation(5, 1)));
      await tester.pumpAndSettle();
      expect(find.text('5,0/5 · 1 đánh giá'), findsNothing);
      expect(find.text(ReputationStrings.empty), findsOneWidget);
    },
  );
}
