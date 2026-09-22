import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { ConfigureTripWaypointsInput } from "../types";
import {
	mapConfigureTripWaypointsError,
	useConfigureTripWaypoints,
} from "./useConfigureTripWaypoints";

vi.mock("../services/trips.service", () => ({
	tripsService: { configureWaypoints: vi.fn() },
}));

const tripId = "33333333-3333-4333-8333-333333333333";
const payload: ConfigureTripWaypointsInput = {
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

describe("useConfigureTripWaypoints", () => {
	beforeEach(() => vi.clearAllMocks());

	it("prevents duplicate submissions while configure request is running", async () => {
		let resolve!: (value: never) => void;
		vi.mocked(tripsService.configureWaypoints).mockImplementation(
			() =>
				new Promise((done) => {
					resolve = done;
				})
		);

		const { result } = renderHook(() => useConfigureTripWaypoints(tripId));
		let first!: Promise<unknown>;

		await act(async () => {
			first = result.current.submit(payload);
			const second = await result.current.submit(payload);
			expect(second).toBeNull();
			resolve({ id: tripId, status: "pending_approval" } as never);
			await first;
		});

		expect(tripsService.configureWaypoints).toHaveBeenCalledTimes(1);
		expect(tripsService.configureWaypoints).toHaveBeenCalledWith(tripId, payload);
	});

	it.each([401, 403, 404, 409, 422])("maps API status %s", (status) => {
		expect(mapConfigureTripWaypointsError(new HttpError("failure", status, {}))).toEqual(
			expect.objectContaining({ status })
		);
	});

	it("maps backend field errors for the waypoint form", () => {
		const error = mapConfigureTripWaypointsError(
			new HttpError("invalid", 422, {
				message: [
					{
						field: "waypoints.0.sequenceOrder",
						errors: ["sequenceOrder must be unique within the Trip"],
					},
				],
			})
		);

		expect(error.fieldErrors).toEqual({
			"waypoints.0.sequenceOrder": "sequenceOrder must be unique within the Trip",
		});
	});

	it("keeps the last payload available for retry after a recoverable failure", async () => {
		vi.mocked(tripsService.configureWaypoints)
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce({ id: tripId, status: "pending_approval" } as never);

		const { result } = renderHook(() => useConfigureTripWaypoints(tripId));

		await act(async () => {
			await result.current.submit(payload);
		});
		expect(result.current.error).not.toBeNull();

		await act(async () => {
			await result.current.retry();
		});

		expect(tripsService.configureWaypoints).toHaveBeenNthCalledWith(2, tripId, payload);
	});
});
