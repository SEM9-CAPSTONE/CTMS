import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import type { CreateRouteDangerZoneInput, RouteDangerZone } from "../types";
import { dangerZoneCreateError, useCreateRouteDangerZone } from "./useCreateRouteDangerZone";

const payload: CreateRouteDangerZoneInput = {
	geometry: { type: "Point", coordinates: [108.46, 11.94] },
	radiusMeters: 30,
	description: "Loose rock",
	severity: "high",
};

const created: RouteDangerZone = {
	id: "zone-id",
	routeId: "route-id",
	...payload,
	createdAt: "2026-09-04T00:00:00.000Z",
	updatedAt: "2026-09-04T00:00:00.000Z",
};

describe("useCreateRouteDangerZone", () => {
	afterEach(() => vi.restoreAllMocks());

	it("posts once and reloads authoritative hazards only after success", async () => {
		vi.spyOn(trekkingRoutesService, "createRouteDangerZone").mockResolvedValue(created);
		const reload = vi.fn().mockResolvedValue(undefined);
		const onConflict = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() => useCreateRouteDangerZone("route-id", reload, onConflict));
		await act(async () => expect(result.current.submit(payload)).resolves.toEqual(created));
		expect(trekkingRoutesService.createRouteDangerZone).toHaveBeenCalledWith("route-id", payload);
		expect(reload).toHaveBeenCalledTimes(1);
		expect(onConflict).not.toHaveBeenCalled();
	});

	it("preserves failure state, skips hazard reload, and refreshes Route only for 409", async () => {
		vi.spyOn(trekkingRoutesService, "createRouteDangerZone").mockRejectedValue(
			new HttpError("conflict", 409, {})
		);
		const reload = vi.fn();
		const onConflict = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() => useCreateRouteDangerZone("route-id", reload, onConflict));
		await act(async () => expect(result.current.submit(payload)).resolves.toBeNull());
		expect(result.current.error).toContain("trạng thái nháp");
		expect(reload).not.toHaveBeenCalled();
		expect(onConflict).toHaveBeenCalledTimes(1);
	});

	it("prevents duplicate in-flight submissions", async () => {
		let resolve!: (zone: RouteDangerZone) => void;
		vi.spyOn(trekkingRoutesService, "createRouteDangerZone").mockReturnValue(
			new Promise((done) => {
				resolve = done;
			})
		);
		const { result } = renderHook(() => useCreateRouteDangerZone("route-id", vi.fn(), vi.fn()));
		await act(async () => {
			const first = result.current.submit(payload);
			await expect(result.current.submit(payload)).resolves.toBeNull();
			resolve(created);
			await first;
		});
		expect(trekkingRoutesService.createRouteDangerZone).toHaveBeenCalledTimes(1);
	});

	it.each([401, 403, 404, 409, 422])("maps mutation status %s", (status) => {
		expect(dangerZoneCreateError(new HttpError("failure", status, {}))).not.toBe("");
	});

	it("extracts structured backend validation details", () => {
		const error = new HttpError("invalid", 422, {
			message: [{ field: "geometry", errors: ["geometry must be valid"] }],
		});
		expect(dangerZoneCreateError(error)).toBe("geometry must be valid");
	});
});
