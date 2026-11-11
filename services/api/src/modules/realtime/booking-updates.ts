import { createHash } from "node:crypto";
import type { BookingUpdatedPayload, EventsGateway } from "./events.gateway";

/**
 * Deterministic UUID (version-5 layout) for an occurrence, so processing the same business change
 * twice (webhook retry, manual sync) yields the same event id and therefore no duplicate realtime
 * record and no duplicate push (CTMS-090, BR-195).
 */
export function stableEventId(...parts: string[]): string {
	const hex = createHash("sha256").update(parts.join("|")).digest("hex");
	const variant = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * CTMS-090: tells each Booking owner that their Booking changed state. Call only after the
 * transaction committed (BR-194); `occurrence` distinguishes repeated changes of the same kind
 * (for example two reschedules) while keeping retries of one change identical.
 */
export function publishBookingUpdates(
	gateway: EventsGateway | undefined,
	status: BookingUpdatedPayload["status"],
	trip: { id: string; title: string },
	bookings: ReadonlyArray<{ id: string; userId: string }>,
	occurrence = "",
	at: Date = new Date()
): void {
	if (!gateway) return;
	for (const booking of bookings) {
		try {
			gateway.emitBookingUpdated(booking.userId, {
				eventId: stableEventId("booking.updated", status, booking.id, occurrence),
				bookingId: booking.id,
				tripId: trip.id,
				tripTitle: trip.title,
				status,
				updatedAt: at.toISOString(),
			});
		} catch {
			// Notification side effects never affect the committed business result (BR-194).
		}
	}
}
