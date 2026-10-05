import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	InitializeBookingMembersRequest,
	InitializeBookingMembersResponse,
	ResolveBookingMemberCandidateRequest,
	ResolveBookingMemberCandidateResponse,
	TripMemberRosterResponse,
	UpdateBookingMemberStatusRequest,
	UpdateBookingMemberStatusResponse,
} from "../types";

export const bookingMembersService = {
	getTripRoster: (tripId: string): Promise<TripMemberRosterResponse> =>
		httpClient.get<TripMemberRosterResponse>(API_ENDPOINTS.TRIPS.MEMBERS(tripId)),

	updateStatus: (
		tripId: string,
		bookingId: string,
		memberId: string,
		input: UpdateBookingMemberStatusRequest
	): Promise<UpdateBookingMemberStatusResponse> =>
		httpClient.patch<UpdateBookingMemberStatusResponse>(
			API_ENDPOINTS.TRIPS.MEMBER_STATUS(tripId, bookingId, memberId),
			input
		),

	resolveCandidate: (
		bookingId: string,
		input: ResolveBookingMemberCandidateRequest
	): Promise<ResolveBookingMemberCandidateResponse> =>
		httpClient.post<ResolveBookingMemberCandidateResponse>(
			API_ENDPOINTS.BOOKINGS.MEMBER_CANDIDATE_RESOLVE(bookingId),
			input
		),

	initialize: (
		bookingId: string,
		input: InitializeBookingMembersRequest,
		idempotencyKey: string
	): Promise<InitializeBookingMembersResponse> =>
		httpClient.post<InitializeBookingMembersResponse>(
			API_ENDPOINTS.BOOKINGS.MEMBERS(bookingId),
			input,
			{ headers: { "Idempotency-Key": idempotencyKey } }
		),
};
