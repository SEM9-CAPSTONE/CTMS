import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../domain/camper_booking_models.dart';

abstract interface class BookingInvitationsApi {
  Future<BookingMembersWorkspace> bookingMembersWorkspace(String bookingId);
  Future<CreateBookingInvitationResult> inviteBookingMember(String bookingId, String email);
  Future<BookingMembersWorkspace> revokeBookingInvitation(String bookingId, String invitationId);
  Future<BookingMembersWorkspace> removeBookingMember(String bookingId, String memberId);
  Future<List<MyPendingBookingInvitation>> myPendingInvitations();
  Future<void> acceptBookingInvitation(String token);
  Future<void> declineBookingInvitation(String token);
}

class HttpBookingInvitationsApi implements BookingInvitationsApi {
  const HttpBookingInvitationsApi(this._client);

  final ApiClient _client;
  static const _bookings = ApiEndpoints.bookings;
  static const _invitations = ApiEndpoints.bookingInvitations;

  @override
  Future<BookingMembersWorkspace> bookingMembersWorkspace(String bookingId) async {
    final response = await _client.get<Map<String, Object?>>(_bookings.invitations(bookingId));
    return BookingMembersWorkspace.fromJson(response.data!);
  }

  @override
  Future<CreateBookingInvitationResult> inviteBookingMember(String bookingId, String email) async {
    final response = await _client.post<Map<String, Object?>>(
      _bookings.invitations(bookingId),
      data: {'email': email.trim()},
    );
    return CreateBookingInvitationResult.fromJson(response.data!);
  }

  @override
  Future<BookingMembersWorkspace> revokeBookingInvitation(
    String bookingId,
    String invitationId,
  ) async {
    final response = await _client.delete<Map<String, Object?>>(
      _bookings.invitation(bookingId, invitationId),
    );
    return BookingMembersWorkspace.fromJson(response.data!);
  }

  @override
  Future<BookingMembersWorkspace> removeBookingMember(String bookingId, String memberId) async {
    final response = await _client.delete<Map<String, Object?>>(
      _bookings.member(bookingId, memberId),
    );
    return BookingMembersWorkspace.fromJson(response.data!);
  }

  @override
  Future<List<MyPendingBookingInvitation>> myPendingInvitations() async {
    final response = await _client.get<List<Object?>>(_invitations.mine);
    return [
      for (final item in response.data ?? const <Object?>[])
        MyPendingBookingInvitation.fromJson(item as Map<String, Object?>),
    ];
  }

  @override
  Future<void> acceptBookingInvitation(String token) =>
      _client.post<Object?>(_invitations.accept(token));

  @override
  Future<void> declineBookingInvitation(String token) =>
      _client.post<Object?>(_invitations.decline(token));
}

final bookingInvitationsApiProvider = Provider<BookingInvitationsApi>(
  (ref) => HttpBookingInvitationsApi(ref.watch(apiClientProvider)),
);

final bookingMembersWorkspaceProvider =
    FutureProvider.autoDispose.family<BookingMembersWorkspace, String>(
      (ref, bookingId) =>
          ref.watch(bookingInvitationsApiProvider).bookingMembersWorkspace(bookingId),
    );

final myPendingInvitationsProvider = FutureProvider.autoDispose<List<MyPendingBookingInvitation>>(
  (ref) => ref.watch(bookingInvitationsApiProvider).myPendingInvitations(),
);
