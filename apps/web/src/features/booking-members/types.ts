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

export type RosterBookingStatus =
	| "pending_payment"
	| "pending_reconfirmation"
	| "confirmed"
	| "cancelled"
	| "expired"
	| "completed";

export type RosterTripStatus =
	| "draft"
	| "pending_approval"
	| "published"
	| "ongoing"
	| "completed"
	| "cancelled";

export interface TripRosterMember {
	memberId: string;
	bookingId: string;
	userId: string | null;
	displayName: string | null;
	email: string | null;
	isPrimary: boolean;
	memberStatus: BookingMemberStatus;
	bookingStatus: RosterBookingStatus | null;
	checkedInAt: string | null;
	noShowAt: string | null;
	leftAt: string | null;
}

export interface TripMemberRosterResponse {
	tripId: string;
	status: RosterTripStatus;
	startsAt: string;
	members: TripRosterMember[];
}

export interface UpdateBookingMemberStatusRequest {
	status: "joined" | "no_show";
}

export interface UpdateBookingMemberStatusResponse extends BookingMemberResponse {
	bookingId: string;
	checkedInAt: string | null;
	noShowAt: string | null;
	leftAt: string | null;
	statusUpdatedBy: string | null;
}

export interface MemberStatusError {
	kind: "unauthenticated" | "forbidden" | "not_found" | "conflict" | "validation" | "retryable";
	status?: number;
	message: string;
	canRetry: boolean;
}

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
