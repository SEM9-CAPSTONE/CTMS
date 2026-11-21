import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/auth/application/auth_controller.dart';
import 'package:mobile/features/porter_reviews/application/porter_reviews_controller.dart';
import 'package:mobile/features/porter_reviews/porter_review_strings.dart';
import 'package:mobile/features/porter_reviews/presentation/porter_reviews_screen.dart';

void main() {
  const password = String.fromEnvironment('CTMS390_CAMPER_PASSWORD');
  if (!const bool.fromEnvironment('CTMS390_EVIDENCE')) {
    test(
      'Android review evidence is opt-in',
      () {},
      skip: 'Requires a local backend and main seed --porter-reviews-only',
    );
    return;
  }
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('shows real completed participations and resolves a stale edit', (
    tester,
  ) async {
    final container = ProviderContainer(
      overrides: [
        tokenStorageProvider.overrideWithValue(
          TokenStorage(
            const FlutterSecureStorage(
              aOptions: AndroidOptions(storageNamespace: 'ctms390-evidence'),
            ),
          ),
        ),
      ],
    );
    addTearDown(container.dispose);
    await tester.runAsync(() async {
      await container.read(authControllerProvider.future);
      await container
          .read(authControllerProvider.notifier)
          .login(identifier: 'camper@ctms.local', password: password);
    });
    final account = container.read(authControllerProvider).requireValue;
    expect(account, isNotNull);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light(),
          home: const PorterReviewsScreen(),
        ),
      ),
    );

    Future<void> visible(Finder finder) async {
      for (
        var attempt = 0;
        attempt < 80 && finder.evaluate().isEmpty;
        attempt++
      ) {
        await tester.pump(const Duration(milliseconds: 200));
      }
      expect(finder, findsWidgets);
      await tester.ensureVisible(finder.first);
      await tester.pumpAndSettle();
    }

    Future<void> capture(String name) async {
      await tester.pumpAndSettle();
      await binding.takeScreenshot(name);
    }

    Future<void> openTrip(String title) async {
      final trip = find.text(title);
      await visible(trip);
      await tester.tap(trip);
      await visible(find.text('Nguyễn Minh Sơn'));
    }

    await visible(find.text('Trekking Sơn Trà – Đón bình minh'));
    await binding.convertFlutterSurfaceToImage();
    await capture('01-chon-chuyen');
    await openTrip('Trekking Sơn Trà – Đón bình minh');
    expect(find.byType(DropdownButtonFormField<String>), findsNothing);
    await visible(find.text(PorterReviewStrings.ratingLabel));
    final send = find.widgetWithText(ElevatedButton, PorterReviewStrings.save);
    expect(tester.widget<ElevatedButton>(send).onPressed, isNull);
    await capture('02-chon-nguoi-ho-tro');
    await tester.tap(find.text(PorterReviewStrings.changeTrip));
    await openTrip('Trekking Sơn Trà – Đỉnh Bàn Cờ');
    await visible(find.text(PorterReviewStrings.expired));
    expect(find.text(PorterReviewStrings.edit), findsNothing);
    await capture('03-het-han');

    await tester.tap(find.text(PorterReviewStrings.changeTrip));
    await openTrip('Trekking Sơn Trà – Lối mòn ven biển');
    await visible(find.text(PorterReviewStrings.assignmentRemoved));
    await capture('04-da-go-phan-cong');

    final controller = container.read(porterReviewsProvider)!;
    final current = controller.selected!.saved!;
    final localComment =
        current.comment == 'Anh Sơn hỗ trợ cả đoàn qua đoạn đường trơn.'
        ? 'Anh Sơn hướng dẫn cả đoàn qua đoạn dốc.'
        : 'Anh Sơn hỗ trợ cả đoàn qua đoạn đường trơn.';
    final edit = find.text(PorterReviewStrings.edit);
    await visible(edit);
    await tester.tap(edit);
    await tester.pump();
    await tester.enterText(
      find.byKey(const ValueKey('porter-review-comment')),
      localComment,
    );
    FocusManager.instance.primaryFocus?.unfocus();
    await tester.pump();
    // A real write from a second client state advances the server revision.
    final api = container.read(porterReviewsApiProvider(account!.id));
    final serverRating = current.rating == 5 ? 4 : 5;
    await tester.runAsync(
      () => api.write(
        bookingId: controller.bookingId!,
        porterId: current.porterId,
        reviewId: current.id,
        expectedRevision: current.revision,
        rating: serverRating,
        comment: current.comment,
      ),
    );
    final save = find.text(PorterReviewStrings.saveEdit);
    await visible(save);
    await tester.tap(save);
    await visible(find.text(PorterReviewStrings.currentSaved));
    expect(controller.draft!.conflict, isTrue);
    expect(controller.selected!.saved!.rating, serverRating);
    expect(controller.draft!.rating, current.rating);
    expect(controller.draft!.comment, localComment);
    expect(find.text(PorterReviewStrings.conflict), findsOneWidget);
    FocusManager.instance.primaryFocus?.unfocus();
    await capture('05-xung-dot-phien-ban');
    final keepDraft = find.text(PorterReviewStrings.keepDraft);
    await visible(keepDraft);
    await tester.tap(keepDraft);
    expect(controller.draft!.baseRevision, current.revision + 1);
    await visible(save);
    await tester.tap(save);
    await visible(find.text(PorterReviewStrings.saved));
    expect(controller.selected!.saved!.revision, current.revision + 2);
    expect(controller.selected!.saved!.rating, current.rating);
    expect(controller.selected!.saved!.comment, localComment);
    debugPrint(
      'CTMS-390: saved=$serverRating stars, draft=${current.rating} stars. '
      'Conflict revision=${current.revision + 1}, '
      'saved revision=${controller.selected!.saved!.revision}.',
    );
    await visible(find.text(localComment));
    await capture('06-da-luu-ban-nhap');
  });
}
