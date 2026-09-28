import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	InitializeBookingMembersRequest,
	InitializeBookingMembersResponse,
	ResolveBookingMemberCandidateRequest,
	ResolveBookingMemberCandidateResponse,
} from "../types";

export const bookingMembersService = {
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
