import { useEffect, useRef } from "react";
import { type Socket, io } from "socket.io-client";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

function socketBaseUrl(): string {
	return API_BASE_URL.replace(/\/api\/?$/, "");
}

export interface TripAvailabilityEvent {
	eventId: string;
	tripId: string;
	seatsTaken: number;
	capacityMax: number | null;
	remainingSeats: number | null;
	updatedAt: string;
}

export interface UseTripAvailabilityRealtimeOptions {
	tripId?: string | null;
	onAvailabilityUpdated?: (event: TripAvailabilityEvent) => void;
}

/**
 * CTMS-083 — BR-264: Keep displayed Trip capacity synchronized with authoritative
 * booking-state changes in real time. Deduplicates duplicate events (PB AC-4) and
 * prevents out-of-order stale events from regressing authoritative display.
 */
export function useTripAvailabilityRealtime({
	tripId,
	onAvailabilityUpdated,
}: UseTripAvailabilityRealtimeOptions = {}) {
	const onUpdateRef = useRef(onAvailabilityUpdated);
	const seenEventIdsRef = useRef<Set<string>>(new Set());
	const lastUpdatedAtRef = useRef<number>(0);

	useEffect(() => {
		onUpdateRef.current = onAvailabilityUpdated;
	}, [onAvailabilityUpdated]);

	useEffect(() => {
		if (!tripId) return;

		let socket: Socket | undefined;
		const timer = window.setTimeout(() => {
			socket = io(socketBaseUrl(), { transports: ["websocket"] });

			socket.on("trip.availability.updated", (payload: TripAvailabilityEvent) => {
				if (!payload || payload.tripId !== tripId) return;

				// PB AC-4: Ignore duplicate events
				if (payload.eventId && seenEventIdsRef.current.has(payload.eventId)) {
					return;
				}
				if (payload.eventId) {
					seenEventIdsRef.current.add(payload.eventId);
					if (seenEventIdsRef.current.size > 200) {
						// Keep cache bounded
						const firstKey = seenEventIdsRef.current.values().next().value;
						if (firstKey) seenEventIdsRef.current.delete(firstKey);
					}
				}

				// Monotonic ordering protection: ignore stale event arriving after a newer event
				const eventTimestamp = new Date(payload.updatedAt).getTime();
				if (
					Number.isFinite(eventTimestamp) &&
					lastUpdatedAtRef.current > 0 &&
					eventTimestamp < lastUpdatedAtRef.current
				) {
					return;
				}
				if (Number.isFinite(eventTimestamp)) {
					lastUpdatedAtRef.current = eventTimestamp;
				}

				onUpdateRef.current?.(payload);
			});
		}, 0);

		return () => {
			window.clearTimeout(timer);
			socket?.disconnect();
		};
	}, [tripId]);
}
