import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { CreateTripWaypointInput } from "../types";
import {
	mapConfigureTripWaypointsError,
	useConfigureTripWaypoints,
} from "./useConfigureTripWaypoints";

vi.mock("../services/trips.service", () => ({
	tripsService: {
		createWaypoint: vi.fn(),
		updateWaypoint: vi.fn(),
		deleteWaypoint: vi.fn(),
		submitForApproval: vi.fn(),
	},
}));

const tripId = "33333333-3333-4333-8333-333333333333";
const waypointId = "44444444-4444-4444-8444-444444444444";
const waypoint: CreateTripWaypointInput = {
	type: "rest",
	name: "Lunch",
	location: { type: "Point", coordinates: [108.23, 16.05] },
	plannedAt: "2026-10-01T05:00:00.000Z",
	metadata: { routeOrder: "0.4" },
};
const savedTrip = { id: tripId, status: "draft", waypoints: [] } as never;

describe("useConfigureTripWaypoints", () => {
	beforeEach(() => vi.clearAllMocks());

	it("creates a new waypoint and updates an existing one", async () => {
		vi.mocked(tripsService.createWaypoint).mockResolvedValue(savedTrip);
		vi.mocked(tripsService.updateWaypoint).mockResolvedValue(savedTrip);
		const { result } = renderHook(() => useConfigureTripWaypoints(tripId));

		await act(async () => {
			await result.current.saveWaypoint(null, waypoint);
			await result.current.saveWaypoint(waypointId, waypoint);
		});

		expect(tripsService.createWaypoint).toHaveBeenCalledWith(tripId, waypoint);
		expect(tripsService.updateWaypoint).toHaveBeenCalledWith(tripId, waypointId, waypoint);
		expect(result.current.configuredTrip).toBe(savedTrip);
	});

	it("deletes a waypoint and submits the stored waypoints for approval", async () => {
		vi.mocked(tripsService.deleteWaypoint).mockResolvedValue(savedTrip);
		vi.mocked(tripsService.submitForApproval).mockResolvedValue({
			id: tripId,
			status: "pending_approval",
		} as never);
		const { result } = renderHook(() => useConfigureTripWaypoints(tripId));

		await act(async () => {
			await result.current.deleteWaypoint(waypointId);
			await result.current.submit();
		});

		expect(tripsService.deleteWaypoint).toHaveBeenCalledWith(tripId, waypointId);
		expect(tripsService.submitForApproval).toHaveBeenCalledWith(tripId, {});
		expect(result.current.configuredTrip).toMatchObject({ status: "pending_approval" });
	});

	it("passes the Red weather acknowledgement to the submission", async () => {
		vi.mocked(tripsService.submitForApproval).mockResolvedValue({
			id: tripId,
			status: "pending_approval",
		} as never);
		const { result } = renderHook(() => useConfigureTripWaypoints(tripId));

		await act(async () => {
			await result.current.submit({ acknowledgeWeatherRisk: true });
		});

		expect(tripsService.submitForApproval).toHaveBeenCalledWith(tripId, {
			acknowledgeWeatherRisk: true,
		});
	});

	it("prevents duplicate requests while one is running", async () => {
		let resolve!: (value: never) => void;
		vi.mocked(tripsService.submitForApproval).mockImplementation(
			() =>
				new Promise((done) => {
					resolve = done;
				})
		);
		const { result } = renderHook(() => useConfigureTripWaypoints(tripId));

		await act(async () => {
			const first = result.current.submit();
			expect(await result.current.saveWaypoint(null, waypoint)).toBeNull();
			resolve(savedTrip);
			await first;
		});

		expect(tripsService.submitForApproval).toHaveBeenCalledTimes(1);
		expect(tripsService.createWaypoint).not.toHaveBeenCalled();
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
						field: "waypoints.0.plannedAt",
						errors: ["plannedAt must be unique within the Trip"],
					},
				],
			})
		);

		expect(error.fieldErrors).toEqual({
			"waypoints.0.plannedAt": "plannedAt must be unique within the Trip",
		});
	});

	it("retries the last failed action", async () => {
		vi.mocked(tripsService.createWaypoint)
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce(savedTrip);
		const { result } = renderHook(() => useConfigureTripWaypoints(tripId));

		await act(async () => {
			await result.current.saveWaypoint(null, waypoint);
		});
		expect(result.current.error).not.toBeNull();

		await act(async () => {
			await result.current.retry();
		});

		expect(tripsService.createWaypoint).toHaveBeenCalledTimes(2);
		expect(result.current.error).toBeNull();
	});
});
