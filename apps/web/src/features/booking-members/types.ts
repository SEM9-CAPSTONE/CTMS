export interface ResolveBookingMemberCandidateRequest {
	email: string;
}

export interface ResolveBookingMemberCandidateResponse {
	userId: string;
	email: string;
}

export interface InitializeBookingMembersRequest {
	members: Array<{ userId: string }>;
}

export type BookingMemberStatus = "registered" | "removed" | "joined" | "no_show" | "left";

export interface BookingMemberResponse {
	id: string;
	userId: string | null;
	isPrimary: boolean;
	memberStatus: BookingMemberStatus;
	createdAt: string;
	updatedAt: string;
}

export interface InitializeBookingMembersResponse {
	bookingId: string;
	members: BookingMemberResponse[];
}

export interface BookingMembersError {
	status?: number;
	message: string;
	isConflict: boolean;
	canRetry: boolean;
	fieldErrors: Record<string, string>;
}
