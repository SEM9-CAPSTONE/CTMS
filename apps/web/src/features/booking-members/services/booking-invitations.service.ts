import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { BookingMemberStatus } from "../types";

export type BookingMemberInvitationStatus =
	| "pending"
	| "accepted"
	| "declined"
	| "revoked"
	| "expired";

export interface BookingInvitationItem {
	id: string;
	bookingId: string;
	invitedEmail: string;
	invitedUserFullName: string | null;
	hasAccount: boolean;
	status: BookingMemberInvitationStatus;
	token: string;
	invitePath: string;
	inviteUrl: string | null;
	expiresAt: string;
	respondedAt: string | null;
	createdAt: string;
}

export interface BookingRosterMemberItem {
	id: string;
	userId: string | null;
	email: string | null;
	fullName: string | null;
	isPrimary: boolean;
	memberStatus: BookingMemberStatus;
	createdAt: string;
}

export interface BookingMembersWorkspace {
	bookingId: string;
	numPeople: number;
	activeMemberCount: number;
	pendingInvitationCount: number;
	remainingSlots: number;
	canManage: boolean;
	members: BookingRosterMemberItem[];
	invitations: BookingInvitationItem[];
}

export interface CreateBookingMemberInvitationResponse {
	invitation: BookingInvitationItem;
	emailSent: boolean;
	workspace: BookingMembersWorkspace;
}

export interface PublicBookingInvitation {
	id: string;
	bookingId: string;
	tripId: string;
	tripTitle: string;
	routeName: string | null;
	tripStartsAt: string;
	tripEndsAt: string;
	inviterName: string;
	invitedEmail: string;
	hasAccount: boolean;
	status: BookingMemberInvitationStatus;
	canRespond: boolean;
	unavailableReason: string | null;
	expiresAt: string;
}

export interface MyPendingBookingInvitation {
	id: string;
	token: string;
	bookingId: string;
	tripId: string;
	tripTitle: string;
	routeName: string | null;
	tripStartsAt: string;
	tripEndsAt: string;
	inviterName: string;
	invitedEmail: string;
	expiresAt: string;
	createdAt: string;
}

export interface RespondBookingInvitationResponse {
	id: string;
	bookingId: string;
	tripId: string;
	status: BookingMemberInvitationStatus;
}

export const bookingInvitationsService = {
	getWorkspace: (bookingId: string): Promise<BookingMembersWorkspace> =>
		httpClient.get<BookingMembersWorkspace>(API_ENDPOINTS.BOOKINGS.INVITATIONS(bookingId)),

	createInvitation: (
		bookingId: string,
		email: string
	): Promise<CreateBookingMemberInvitationResponse> =>
		httpClient.post<CreateBookingMemberInvitationResponse>(
			API_ENDPOINTS.BOOKINGS.INVITATIONS(bookingId),
			{ email }
		),

	revokeInvitation: (bookingId: string, invitationId: string): Promise<BookingMembersWorkspace> =>
		httpClient.delete<BookingMembersWorkspace>(
			API_ENDPOINTS.BOOKINGS.INVITATION(bookingId, invitationId)
		),

	removeMember: (bookingId: string, memberId: string): Promise<BookingMembersWorkspace> =>
		httpClient.delete<BookingMembersWorkspace>(API_ENDPOINTS.BOOKINGS.MEMBER(bookingId, memberId)),

	listMyPending: (): Promise<MyPendingBookingInvitation[]> =>
		httpClient.get<MyPendingBookingInvitation[]>(API_ENDPOINTS.BOOKING_INVITATIONS.MINE),

	getPublicByToken: (token: string): Promise<PublicBookingInvitation> =>
		httpClient.get<PublicBookingInvitation>(API_ENDPOINTS.BOOKING_INVITATIONS.BY_TOKEN(token)),

	accept: (token: string): Promise<RespondBookingInvitationResponse> =>
		httpClient.post<RespondBookingInvitationResponse>(
			API_ENDPOINTS.BOOKING_INVITATIONS.ACCEPT(token)
		),

	decline: (token: string): Promise<RespondBookingInvitationResponse> =>
		httpClient.post<RespondBookingInvitationResponse>(
			API_ENDPOINTS.BOOKING_INVITATIONS.DECLINE(token)
		),
};
