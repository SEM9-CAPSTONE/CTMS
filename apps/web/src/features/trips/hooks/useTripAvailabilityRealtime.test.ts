import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type TripAvailabilityEvent,
	useTripAvailabilityRealtime,
} from "./useTripAvailabilityRealtime";

const mocks = vi.hoisted(() => ({
	handlers: new Map<string, (payload?: unknown) => void>(),
	disconnect: vi.fn(),
	connections: vi.fn(),
}));

vi.mock("socket.io-client", () => ({
	io: () => {
		mocks.connections();
		return {
			on: (event: string, handler: (payload?: unknown) => void) => {
				mocks.handlers.set(event, handler);
			},
			disconnect: mocks.disconnect,
		};
	},
}));

describe("CTMS-083: useTripAvailabilityRealtime", () => {
	const tripId = "trip-test-123";

	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		mocks.handlers.clear();
	});

	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it("PB AC-1, AC-2, AC-3: receives live trip availability and invokes callback with seatsTaken & remainingSeats", () => {
		const onUpdate = vi.fn();
		renderHook(() => useTripAvailabilityRealtime({ tripId, onAvailabilityUpdated: onUpdate }));
		act(() => vi.runOnlyPendingTimers());

		const event: TripAvailabilityEvent = {
			eventId: "event-uuid-1",
			tripId,
			seatsTaken: 8,
			capacityMax: 10,
			remainingSeats: 2,
			updatedAt: "2026-11-03T10:00:00.000Z",
		};

		act(() => {
			mocks.handlers.get("trip.availability.updated")?.(event);
		});

		expect(onUpdate).toHaveBeenCalledTimes(1);
		expect(onUpdate).toHaveBeenCalledWith(event);
	});

	it("PB AC-4: ignores duplicate events with the same eventId", () => {
		const onUpdate = vi.fn();
		renderHook(() => useTripAvailabilityRealtime({ tripId, onAvailabilityUpdated: onUpdate }));
		act(() => vi.runOnlyPendingTimers());

		const event: TripAvailabilityEvent = {
			eventId: "duplicate-event-id",
			tripId,
			seatsTaken: 9,
			capacityMax: 10,
			remainingSeats: 1,
			updatedAt: "2026-11-03T10:01:00.000Z",
		};

		// Send twice
		act(() => {
			mocks.handlers.get("trip.availability.updated")?.(event);
			mocks.handlers.get("trip.availability.updated")?.(event);
		});

		// Should only be processed once
		expect(onUpdate).toHaveBeenCalledTimes(1);
	});

	it("Edge Case: ignores older events that arrive out-of-order after a newer event", () => {
		const onUpdate = vi.fn();
		renderHook(() => useTripAvailabilityRealtime({ tripId, onAvailabilityUpdated: onUpdate }));
		act(() => vi.runOnlyPendingTimers());

		const newerEvent: TripAvailabilityEvent = {
			eventId: "event-new",
			tripId,
			seatsTaken: 10,
			capacityMax: 10,
			remainingSeats: 0,
			updatedAt: "2026-11-03T10:05:00.000Z",
		};

		const olderEvent: TripAvailabilityEvent = {
			eventId: "event-old",
			tripId,
			seatsTaken: 8,
			capacityMax: 10,
			remainingSeats: 2,
			updatedAt: "2026-11-03T10:04:00.000Z",
		};

		act(() => {
			mocks.handlers.get("trip.availability.updated")?.(newerEvent);
		});
		expect(onUpdate).toHaveBeenCalledTimes(1);
		expect(onUpdate).toHaveBeenCalledWith(newerEvent);

		// Older event arrives later due to network latency
		act(() => {
			mocks.handlers.get("trip.availability.updated")?.(olderEvent);
		});
		// Must not regress authoritative display
		expect(onUpdate).toHaveBeenCalledTimes(1);
	});

	it("ignores events targeted to other trips", () => {
		const onUpdate = vi.fn();
		renderHook(() => useTripAvailabilityRealtime({ tripId, onAvailabilityUpdated: onUpdate }));
		act(() => vi.runOnlyPendingTimers());

		const otherTripEvent: TripAvailabilityEvent = {
			eventId: "event-other",
			tripId: "different-trip-id",
			seatsTaken: 5,
			capacityMax: 10,
			remainingSeats: 5,
			updatedAt: "2026-11-03T10:00:00.000Z",
		};

		act(() => {
			mocks.handlers.get("trip.availability.updated")?.(otherTripEvent);
		});

		expect(onUpdate).not.toHaveBeenCalled();
	});

	it("disconnects the socket on unmount", () => {
		const { unmount } = renderHook(() =>
			useTripAvailabilityRealtime({ tripId, onAvailabilityUpdated: vi.fn() })
		);
		act(() => vi.runOnlyPendingTimers());

		expect(mocks.connections).toHaveBeenCalledTimes(1);
		unmount();
		expect(mocks.disconnect).toHaveBeenCalledTimes(1);
	});
});
