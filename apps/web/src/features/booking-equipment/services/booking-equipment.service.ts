import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	AddBookingItemInput,
	AddBookingItemResult,
	BookingItem,
	TripEquipmentOption,
} from "../types";

export const bookingEquipmentService = {
	listForTrip: (tripId: string): Promise<TripEquipmentOption[]> =>
		httpClient.get<TripEquipmentOption[]>(API_ENDPOINTS.EQUIPMENT_CATALOG.FOR_TRIP(tripId)),
	addItem: (
		bookingId: string,
		input: AddBookingItemInput,
		idempotencyKey: string
	): Promise<AddBookingItemResult> =>
		httpClient.post<AddBookingItemResult>(API_ENDPOINTS.BOOKINGS.ITEMS(bookingId), input, {
			headers: { "Idempotency-Key": idempotencyKey },
		}),
	addBookingItem: (
		bookingId: string,
		input: AddBookingItemInput,
		idempotencyKey?: string
	): Promise<AddBookingItemResult> =>
		bookingEquipmentService.addItem(
			bookingId,
			input,
			idempotencyKey ??
				(typeof crypto !== "undefined" && crypto.randomUUID
					? crypto.randomUUID()
					: `${Date.now()}-${Math.random()}`)
		),
	listItems: (bookingId: string): Promise<BookingItem[]> =>
		httpClient.get<BookingItem[]>(API_ENDPOINTS.BOOKINGS.ITEMS(bookingId)),
};
