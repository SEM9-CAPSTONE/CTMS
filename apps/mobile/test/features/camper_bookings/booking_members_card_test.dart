import 'package:mobile/features/camper_bookings/data/booking_invitations_api.dart';
import 'package:mobile/features/camper_bookings/domain/camper_booking_models.dart';
import 'package:mobile/features/camper_bookings/presentation/booking_members_card.dart';
import 'package:mobile/features/camper_bookings/presentation/pending_invitations_section.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeInvitationsBookingsApi implements BookingInvitationsApi {
  String? invitedEmail;
  String? acceptedToken;

  @override
  Future<BookingMembersWorkspace> bookingMembersWorkspace(String bookingId) async =>
      BookingMembersWorkspace(
        bookingId: bookingId,
        numPeople: 2,
        activeMemberCount: 1,
        pendingInvitationCount: invitedEmail == null ? 0 : 1,
        remainingSlots: invitedEmail == null ? 1 : 0,
        canManage: true,
        members: const [
          BookingMemberItem(
            id: 'member-1',
            userId: 'user-1',
            email: 'owner@ditrek.vn',
            fullName: 'Nguyễn Minh Anh',
            isPrimary: true,
            memberStatus: 'registered',
          ),
        ],
        invitations: invitedEmail == null
            ? const []
            : [
                BookingInvitationItem(
                  id: 'inv-1',
                  bookingId: bookingId,
                  invitedEmail: invitedEmail!,
                  invitedUserFullName: null,
                  hasAccount: false,
                  status: 'pending',
                  token: 'tok-1',
                  invitePath: '/invitations/tok-1',
                  inviteUrl: 'https://ditrek.io.vn/invitations/tok-1',
                ),
              ],
      );

  @override
  Future<CreateBookingInvitationResult> inviteBookingMember(
    String bookingId,
    String email,
  ) async {
    invitedEmail = email;
    final workspace = await bookingMembersWorkspace(bookingId);
    return CreateBookingInvitationResult(
      invitation: workspace.invitations.first,
      emailSent: false,
      workspace: workspace,
    );
  }

  @override
  Future<List<MyPendingBookingInvitation>> myPendingInvitations() async => acceptedToken != null
      ? const []
      : [
          MyPendingBookingInvitation(
            id: 'inv-pending',
            token: 'tok-accept',
            bookingId: 'booking-9',
            tripId: 'trip-9',
            tripTitle: 'Khám phá bán đảo Sơn Trà',
            routeName: 'Tuyến Sơn Trà',
            tripStartsAt: DateTime(2029, 9, 5, 8, 0),
            tripEndsAt: DateTime(2029, 9, 5, 17, 0),
            inviterName: 'Nguyễn Minh Anh',
            invitedEmail: 'ban@ditrek.vn',
          ),
        ];

  @override
  Future<void> acceptBookingInvitation(String token) async {
    acceptedToken = token;
  }

  @override
  Future<void> declineBookingInvitation(String token) async {}

  @override
  Future<BookingMembersWorkspace> removeBookingMember(String bookingId, String memberId) =>
      bookingMembersWorkspace(bookingId);

  @override
  Future<BookingMembersWorkspace> revokeBookingInvitation(
    String bookingId,
    String invitationId,
  ) => bookingMembersWorkspace(bookingId);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  testWidgets('BookingMembersCard renders slots and sends companion email invitation', (
    tester,
  ) async {
    final fakeApi = _FakeInvitationsBookingsApi();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [bookingInvitationsApiProvider.overrideWithValue(fakeApi)],
        child: const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(child: BookingMembersCard(bookingId: 'booking-1')),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Người tham gia (1/2)'), findsOneWidget);
    expect(find.text('Nguyễn Minh Anh'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'ban@ditrek.vn');
    await tester.tap(find.text('Gửi lời mời tham gia'));
    await tester.pumpAndSettle();

    expect(fakeApi.invitedEmail, 'ban@ditrek.vn');
    expect(find.text('ban@ditrek.vn'), findsOneWidget);
    expect(find.text('Sao chép link'), findsOneWidget);
  });

  testWidgets('PendingInvitationsSection displays pending invite and accepts it', (tester) async {
    final fakeApi = _FakeInvitationsBookingsApi();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [bookingInvitationsApiProvider.overrideWithValue(fakeApi)],
        child: const MaterialApp(
          home: Scaffold(body: PendingInvitationsSection()),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Khám phá bán đảo Sơn Trà'), findsOneWidget);
    await tester.tap(find.text('Chấp nhận'));
    await tester.pumpAndSettle();

    expect(fakeApi.acceptedToken, 'tok-accept');
  });
}
