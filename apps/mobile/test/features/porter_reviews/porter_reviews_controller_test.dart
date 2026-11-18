import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/features/auth/application/auth_controller.dart';
import 'package:mobile/features/auth/domain/auth_user.dart';
import 'package:mobile/features/auth/domain/user_role.dart';
import 'package:mobile/features/porter_reviews/application/porter_reviews_controller.dart';
import 'package:mobile/features/porter_reviews/domain/porter_review_models.dart';
import 'package:mobile/features/porter_reviews/porter_review_strings.dart';
import 'porter_review_fakes.dart';

class MutableAuth extends AuthController {
  @override
  Future<AuthUser?> build() async => const AuthUser(
    id: 'account-a',
    email: 'camper@ctms.local',
    role: UserRole.camper,
  );
  void changeAccount() {
    state = const AsyncData(
      AuthUser(
        id: 'account-b',
        email: 'another@example.test',
        role: UserRole.camper,
      ),
    );
  }
}

void main() {
  Future<PorterReviewsController> setup(FakePorterApi api) async {
    final controller = PorterReviewsController(api);
    addTearDown(() {
      if (!api.disposed) controller.dispose();
    });
    await Future<void>.delayed(Duration.zero);
    await controller.selectTrip('booking-a', 'Khám phá bán đảo Sơn Trà');
    return controller;
  }

  test('normalizes comments and uses authoritative saved revision', () async {
    final api = FakePorterApi()
      ..snapshot = reviewContext(saved: true, revision: 3);
    final c = await setup(api);
    c.edit();
    c.setRating(5);
    c.setComment('  Cảm ơn người hỗ trợ 😊  ');
    expect(await c.submit(), PorterSubmission.saved);
    expect(api.sentRevision, 3);
    expect(api.sentComment, 'Cảm ơn người hỗ trợ 😊');
    expect(c.draft!.editing, isFalse);
  });
  test(
    'cannot submit unchanged reviews or double-submit a pending write',
    () async {
      final api = FakePorterApi()..snapshot = reviewContext(saved: true);
      final c = await setup(api);
      c.edit();
      expect(await c.submit(), PorterSubmission.ignored);
      c.setRating(5);
      api.writePending = Completer<void>();
      final first = c.submit();
      expect(c.saving, isTrue);
      expect(await c.submit(), PorterSubmission.ignored);
      api.writePending!.complete();
      await first;
      expect(api.writes, 1);
    },
  );
  test(
    'retained review name and edit permission do not depend on assignment list',
    () async {
      final api = FakePorterApi()
        ..snapshot = reviewContext(saved: true, assigned: false);
      final c = await setup(api);
      expect(c.context!.eligible, isFalse);
      expect(c.selected!.name, 'Nguyễn Minh Sơn');
      expect(c.canEditSelected, isTrue);
      c.edit();
      c.setRating(5);
      expect(await c.submit(), PorterSubmission.saved);
    },
  );
  test(
    'stale revision preserves draft and requires explicit comparison before resubmission',
    () async {
      final api = FakePorterApi()..snapshot = reviewContext(saved: true);
      final c = await setup(api);
      c.edit();
      c.setComment('Bản nháp chưa gửi');
      api.onWrite = () => api.snapshot = reviewContext(
        saved: true,
        revision: 2,
        comment: 'Nội dung mới từ phiên khác',
      );
      api.writeFailure = ApiException(
        'conflict',
        statusCode: 409,
        errorData: {'code': 'STALE_REVISION'},
      );
      expect(await c.submit(), PorterSubmission.conflict);
      expect(c.draft!.comment, 'Bản nháp chưa gửi');
      expect(c.selected!.saved!.comment, 'Nội dung mới từ phiên khác');
      expect(c.canSubmit, isFalse);
      c.keepDraft();
      expect(c.canSubmit, isTrue);
      api.writeFailure = null;
      api.onWrite = null;
      await c.submit();
      expect(api.sentRevision, 2);
    },
  );
  test(
    'duplicate loads the existing review without discarding the in-memory draft',
    () async {
      final api = FakePorterApi();
      final c = await setup(api);
      c.setRating(5);
      c.setComment('Nháp ban đầu');
      api.onWrite = () => api.snapshot = reviewContext(
        saved: true,
        comment: 'Đã gửi ở phiên khác',
      );
      api.writeFailure = ApiException(
        'duplicate',
        statusCode: 409,
        errorData: {'code': 'DUPLICATE_REVIEW'},
      );
      expect(await c.submit(), PorterSubmission.duplicate);
      expect(c.draft!.editing, isFalse);
      expect(c.draft!.comment, 'Nháp ban đầu');
      expect(c.selected!.saved!.comment, 'Đã gửi ở phiên khác');
    },
  );
  test(
    'expired response moves to read-only instead of treating it as a revision conflict',
    () async {
      final api = FakePorterApi();
      final c = await setup(api);
      c.setRating(5);
      api.onWrite = () => api.snapshot = reviewContext(expired: true);
      api.writeFailure = ApiException(
        'expired',
        statusCode: 409,
        errorData: {'code': 'WINDOW_EXPIRED'},
      );
      expect(await c.submit(), PorterSubmission.failed);
      expect(c.serverClosed, isTrue);
      expect(c.canSubmit, isFalse);
      expect(c.draft!.conflict, isFalse);
    },
  );
  test(
    'lost response checks context and confirms a committed create without sending again',
    () async {
      final api = FakePorterApi();
      final c = await setup(api);
      c.setRating(5);
      c.setComment('Hỗ trợ tốt');
      api.onWrite = () => api.snapshot = reviewContext(
        saved: true,
        rating: 5,
        comment: 'Hỗ trợ tốt',
      );
      api.writeFailure = ApiException(
        'timeout',
        kind: ApiExceptionKind.timeout,
      );
      expect(await c.submit(), PorterSubmission.saved);
      expect(api.writes, 1);
      expect(c.actionMessage, PorterReviewStrings.confirmedLater);
      expect(await c.submit(), PorterSubmission.ignored);
    },
  );
  test(
    'unknown write outcome locks retries until context is successfully reloaded',
    () async {
      final api = FakePorterApi();
      final c = await setup(api);
      c.setRating(5);
      api.writeFailure = ApiException(
        'offline',
        kind: ApiExceptionKind.network,
      );
      api.contextFailure = ApiException(
        'offline',
        kind: ApiExceptionKind.network,
      );
      await c.submit();
      expect(c.stale, isTrue);
      expect(c.canSubmit, isFalse);
      expect(api.writes, 1);
      api.contextFailure = null;
      await c.refreshContext();
      expect(c.canSubmit, isTrue);
      expect(api.writes, 1);
      expect(c.draft!.rating, 5);
    },
  );
  test(
    'disposes old account draft and ignores an in-flight response',
    () async {
      final api = FakePorterApi();
      final c = await setup(api);
      c.setRating(5);
      c.setComment('Nội dung riêng tư');
      api.contextPending = Completer<PorterReviewContext>();
      final loading = c.refreshContext();
      c.dispose();
      api.contextPending!.complete(reviewContext(saved: true));
      await loading;
      expect(c.context, isNull);
      expect(c.draft, isNull);
      expect(c.bookingId, isNull);
    },
  );
  test(
    'actual account provider replacement clears drafts and rejects the old suspended response',
    () async {
      final auth = MutableAuth();
      final firstApi = FakePorterApi();
      final secondApi = FakePorterApi();
      final container = ProviderContainer(
        overrides: [
          authControllerProvider.overrideWith(() => auth),
          porterReviewsApiProvider.overrideWith(
            (ref, account) => account == 'account-a' ? firstApi : secondApi,
          ),
        ],
      );
      addTearDown(container.dispose);
      await container.read(authControllerProvider.future);
      final keepAlive = container.listen(porterReviewsProvider, (_, _) {});
      addTearDown(keepAlive.close);
      final first = container.read(porterReviewsProvider)!;
      await first.selectTrip('booking-a', 'Khám phá bán đảo Sơn Trà');
      first.setComment('Nháp của tài khoản trước');
      firstApi.contextPending = Completer<PorterReviewContext>();
      final pending = first.refreshContext();
      auth.changeAccount();
      await container.pump();
      final second = container.read(porterReviewsProvider)!;
      expect(identical(first, second), isFalse);
      expect(firstApi.disposed, isTrue);
      await second.selectTrip('booking-a', 'Khám phá bán đảo Sơn Trà');
      expect(second.draft!.comment, isEmpty);
      firstApi.contextPending!.complete(
        reviewContext(saved: true, comment: 'Không được hiển thị'),
      );
      await pending;
      expect(second.draft!.comment, isEmpty);
      expect(first.context, isNull);
    },
  );
  test('keeps separate drafts per booking and Porter', () async {
    final api = FakePorterApi();
    final c = await setup(api);
    c.setComment('Chuyến thứ nhất');
    await c.selectTrip('booking-b', 'Trekking đèo Hải Vân');
    expect(c.draft!.comment, isEmpty);
    c.setComment('Chuyến thứ hai');
    await c.selectTrip('booking-a', 'Khám phá bán đảo Sơn Trà');
    expect(c.draft!.comment, 'Chuyến thứ nhất');
  });
  for (final text in ['😊' * 2001, '☀️' * 1001, 'a\u0301' * 1001]) {
    test(
      'rejects overlong Unicode comment without contacting server: ${text.runes.length}',
      () async {
        final api = FakePorterApi();
        final c = await setup(api);
        c.setRating(5);
        c.setComment(text);
        expect(await c.submit(), PorterSubmission.failed);
        expect(api.writes, 0);
      },
    );
  }
  testWidgets(
    'display countdown expiry asks backend again but does not revoke server permission locally',
    (tester) async {
      final api = FakePorterApi()
        ..snapshot = reviewContext(
          deadline: serverTime.add(const Duration(seconds: 1)),
        );
      var elapsed = Duration.zero;
      final c = PorterReviewsController(api, elapsedForDisplay: () => elapsed);
      await c.selectTrip('booking-a', 'Khám phá bán đảo Sơn Trà');
      c.setRating(5);
      elapsed = const Duration(seconds: 2);
      await tester.pump(const Duration(seconds: 2));
      await tester.pump();
      expect(api.reads, 2);
      expect(c.canSubmit, isTrue);
      api.snapshot = reviewContext(expired: true);
      await c.refreshContext();
      expect(c.canSubmit, isFalse);
      c.dispose();
    },
  );
}
