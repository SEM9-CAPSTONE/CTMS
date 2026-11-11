import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import { checkpointUpdateError, useUpdateRouteCheckpoint } from "./useUpdateRouteCheckpoint";

vi.mock("../services/trekking-routes.service", () => ({
	trekkingRoutesService: { updateCheckpoint: vi.fn() },
}));

const payload = {
	name: "Điểm bắt đầu",
	location: { type: "Point" as const, coordinates: [108.46, 11.94] as [number, number] },
	radiusMeters: 30,
	type: "start" as const,
	expectedArrivalOffset: 0,
	instructions: "Bắt đầu tại đây",
	nearbyWaterOrShelter: false,
};

describe("useUpdateRouteCheckpoint", () => {
	beforeEach(() => vi.clearAllMocks());

	it("PATCHes the checkpoint and reloads the authoritative collection before resolving", async () => {
		const events: string[] = [];
		const reload = vi.fn(async () => {
			events.push("reload");
		});
		vi.mocked(trekkingRoutesService.updateCheckpoint).mockImplementation(async () => {
			events.push("patch");
			return { id: "checkpoint-id" } as never;
		});
		const { result } = renderHook(() => useUpdateRouteCheckpoint("route-id", reload));
		let updated: unknown;
		await act(async () => {
			updated = await result.current.submit("checkpoint-id", payload);
			events.push("resolved");
		});
		expect(trekkingRoutesService.updateCheckpoint).toHaveBeenCalledWith(
			"route-id",
			"checkpoint-id",
			payload
		);
		expect(reload).toHaveBeenCalledTimes(1);
		expect(events).toEqual(["patch", "reload", "resolved"]);
		expect(updated).toEqual({ id: "checkpoint-id" });
	});

	it("keeps failure local and does not reload", async () => {
		const reload = vi.fn();
		vi.mocked(trekkingRoutesService.updateCheckpoint).mockRejectedValue(
			new HttpError("far", 422, {})
		);
		const { result } = renderHook(() => useUpdateRouteCheckpoint("route-id", reload));
		await act(async () => {
			await result.current.submit("checkpoint-id", payload);
		});
		expect(result.current.error).toContain("50 mét");
		expect(reload).not.toHaveBeenCalled();
	});

	it("prevents duplicate in-flight updates", async () => {
		let resolve!: (value: never) => void;
		vi.mocked(trekkingRoutesService.updateCheckpoint).mockReturnValue(
			new Promise((done) => {
				resolve = done;
			})
		);
		const { result } = renderHook(() => useUpdateRouteCheckpoint("route-id", vi.fn()));
		await act(async () => {
			const first = result.current.submit("checkpoint-id", payload);
			await expect(result.current.submit("checkpoint-id", payload)).resolves.toBeNull();
			resolve({ id: "checkpoint-id" } as never);
			await first;
		});
		expect(trekkingRoutesService.updateCheckpoint).toHaveBeenCalledTimes(1);
	});

	it.each([401, 403, 404, 409, 422])("maps update status %s to feedback", (status) => {
		expect(checkpointUpdateError(new HttpError("failure", status, {}))).not.toBe("");
	});

	it("preserves structured backend validation detail", () => {
		const error = new HttpError("invalid", 422, {
			message: [{ field: "location", errors: ["location must be selected"] }],
		});
		expect(checkpointUpdateError(error)).toBe("location must be selected");
	});
});
