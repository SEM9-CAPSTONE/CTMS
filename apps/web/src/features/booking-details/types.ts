export type BookingStatus =
	| "pending_payment"
	| "pending_reconfirmation"
	| "confirmed"
	| "cancelled"
	| "expired"
	| "completed";

export type BookingPaymentStatus = "not_required" | "unpaid" | "paid";

export type BookingMemberStatus = "registered" | "removed" | "joined" | "no_show" | "left";

export interface BookingTripPresentation {
	id: string;
	currentTitle: string;
	routeId: string;
	currentRouteName: string;
}

export interface BookingDetailsMember {
	id: string;
	userId: string | null;
	email: string | null;
	isPrimary: boolean;
	memberStatus: BookingMemberStatus;
	createdAt: string;
	updatedAt: string;
}

export interface BookingEquipmentItemDetails {
	id: string;
	itemType: "equipment";
	equipmentCatalogItemId: string;
	quantity: number;
	unitPrice: string;
	rentalDays: number;
	totalPrice: string;
	createdAt: string;
	presentation: { currentName: string } | null;
}

export interface BookingDetails {
	id: string;
	tripId: string;
	userId: string;
	numPeople: number | null;
	status: BookingStatus | null;
	paymentStatus: BookingPaymentStatus | null;
	holdExpiresAt: string | null;
	tripStartsAtSnapshot: string | null;
	tripEndsAtSnapshot: string | null;
	basePrice: string | null;
	totalAmount: string | null;
	cancellationPolicySnapshot: Record<string, unknown> | null;
	createdAt: string;
	tripPresentation: BookingTripPresentation | null;
	members: BookingDetailsMember[];
	equipmentItems: BookingEquipmentItemDetails[];
}

export type BookingDetailsErrorKind =
	| "unauthenticated"
	| "forbidden"
	| "not_found"
	| "invalid_reference"
	| "retryable"
	| "unexpected";

export interface BookingDetailsError {
	kind: BookingDetailsErrorKind;
	message: string;
	canRetry: boolean;
}
