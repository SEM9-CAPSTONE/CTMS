import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import { checkpointCreateError, useCreateRouteCheckpoint } from "./useCreateRouteCheckpoint";

vi.mock("../services/trekking-routes.service", () => ({
	trekkingRoutesService: { createCheckpoint: vi.fn() },
}));

const payload = {
	name: "Rest",
	location: { type: "Point" as const, coordinates: [108.46, 11.94] as [number, number] },
	radiusMeters: 30,
	type: "rest" as const,
	expectedArrivalOffset: 45,
	instructions: "Rest here",
	nearbyWaterOrShelter: false,
};

describe("useCreateRouteCheckpoint", () => {
	beforeEach(() => vi.clearAllMocks());

	it("reloads the authoritative GET collection after a successful POST", async () => {
		const reload = vi.fn().mockResolvedValue(undefined);
		vi.mocked(trekkingRoutesService.createCheckpoint).mockResolvedValue({
			id: "checkpoint",
		} as never);
		const { result } = renderHook(() => useCreateRouteCheckpoint("route-id", reload));
		await act(async () => {
			await result.current.submit(payload);
		});
		expect(trekkingRoutesService.createCheckpoint).toHaveBeenCalledWith("route-id", payload);
		expect(reload).toHaveBeenCalledTimes(1);
	});

	it("keeps failure local and does not reload", async () => {
		const reload = vi.fn();
		vi.mocked(trekkingRoutesService.createCheckpoint).mockRejectedValue(
			new HttpError("far", 422, {})
		);
		const { result } = renderHook(() => useCreateRouteCheckpoint("route-id", reload));
		await act(async () => {
			await result.current.submit(payload);
		});
		expect(result.current.error).toContain("50 mét");
		expect(reload).not.toHaveBeenCalled();
	});

	it("prevents duplicate in-flight submissions", async () => {
		let resolve!: (value: never) => void;
		vi.mocked(trekkingRoutesService.createCheckpoint).mockReturnValue(
			new Promise((done) => {
				resolve = done;
			})
		);
		const { result } = renderHook(() => useCreateRouteCheckpoint("route-id", vi.fn()));
		await act(async () => {
			const first = result.current.submit(payload);
			await expect(result.current.submit(payload)).resolves.toBeNull();
			resolve({ id: "checkpoint" } as never);
			await first;
		});
		expect(trekkingRoutesService.createCheckpoint).toHaveBeenCalledTimes(1);
	});

	it.each([401, 403, 404, 409, 422])("maps status %s to an actionable message", (status) => {
		expect(checkpointCreateError(new HttpError("failure", status, {}))).not.toBe("");
	});

	it("maps a non-draft conflict to the lifecycle-specific message", () => {
		expect(checkpointCreateError(new HttpError("conflict", 409, {}))).toContain("trạng thái nháp");
	});

	it("preserves structured backend field validation detail", () => {
		const error = new HttpError("invalid", 422, {
			message: [{ field: "location", errors: ["location must be selected"] }],
		});
		expect(checkpointCreateError(error)).toBe("location must be selected");
	});
});
