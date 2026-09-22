import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { CreateTripInput } from "../types";
import { mapCreateTripError, useCreateTrip } from "./useCreateTrip";

vi.mock("../services/trips.service", () => ({
	tripsService: {
		create: vi.fn(),
		search: vi.fn(),
		getById: vi.fn(),
	},
}));

const payload: CreateTripInput = {
	routeId: "11111111-1111-4111-8111-111111111111",
	title: "Bidoup draft",
	tripType: "day_trip",
	startsAt: "2026-10-01T02:00:00.000Z",
	endsAt: "2026-10-01T10:00:00.000Z",
	meetingPoint: { type: "Point", coordinates: [108.22, 16.04] },
	bookingDeadline: "2026-09-30T02:00:00.000Z",
	capacityMin: 2,
	capacityMax: 12,
	pricePerPerson: 0,
	waypoints: [
		{
			type: "start",
			name: "Trailhead",
			location: { type: "Point", coordinates: [108.22, 16.04] },
			dayNumber: 1,
			sequenceOrder: 1,
		},
		{
			type: "finish",
			name: "Exit",
			location: { type: "Point", coordinates: [108.25, 16.06] },
			dayNumber: 1,
			sequenceOrder: 2,
		},
	],
};

describe("useCreateTrip", () => {
	beforeEach(() => vi.clearAllMocks());

	it("prevents duplicate submissions while a request is running", async () => {
		let resolve!: (value: never) => void;
		vi.mocked(tripsService.create).mockImplementation(
			() =>
				new Promise((done) => {
					resolve = done;
				})
		);

		const { result } = renderHook(() => useCreateTrip());
		let first!: Promise<unknown>;

		await act(async () => {
			first = result.current.submit(payload);
			const second = await result.current.submit(payload);
			expect(second).toBeNull();
			resolve({ id: "trip" } as never);
			await first;
		});

		expect(tripsService.create).toHaveBeenCalledTimes(1);
	});

	it.each([401, 403, 404, 409, 422])("maps API status %s", (status) => {
		expect(mapCreateTripError(new HttpError("failure", status, {}))).toEqual(
			expect.objectContaining({ status })
		);
	});

	it("maps backend 422 field errors for the form", () => {
		const error = mapCreateTripError(
			new HttpError("invalid", 422, {
				message: [
					{ field: "bookingDeadline", errors: ["bookingDeadline must be before startsAt"] },
				],
			})
		);

		expect(error.fieldErrors).toEqual({
			bookingDeadline: "bookingDeadline must be before startsAt",
		});
	});

	it("keeps the last payload available for retry after a recoverable failure", async () => {
		vi.mocked(tripsService.create)
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce({ id: "trip" } as never);

		const { result } = renderHook(() => useCreateTrip());

		await act(async () => {
			await result.current.submit(payload);
		});
		expect(result.current.error).not.toBeNull();

		await act(async () => {
			await result.current.retry();
		});

		expect(tripsService.create).toHaveBeenNthCalledWith(2, payload);
	});
});
