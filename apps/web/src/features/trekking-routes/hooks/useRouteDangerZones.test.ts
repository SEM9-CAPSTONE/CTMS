import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import type { RouteDangerZone } from "../types";
import { dangerZoneListError, useRouteDangerZones } from "./useRouteDangerZones";

function zone(id: string): RouteDangerZone {
	return {
		id,
		routeId: "route-id",
		geometry: { type: "Point", coordinates: [108.46, 11.94] },
		radiusMeters: 30,
		description: "Loose rock",
		severity: "medium",
		createdAt: "2026-09-04T00:00:00.000Z",
		updatedAt: "2026-09-04T00:00:00.000Z",
	};
}

describe("useRouteDangerZones", () => {
	afterEach(() => vi.restoreAllMocks());

	it("exposes loading and authoritative success data", async () => {
		let resolve!: (items: RouteDangerZone[]) => void;
		vi.spyOn(trekkingRoutesService, "listRouteDangerZones").mockReturnValue(
			new Promise((done) => {
				resolve = done;
			})
		);
		const { result } = renderHook(() => useRouteDangerZones("route-one"));
		expect(result.current.isLoading).toBe(true);
		await act(async () => resolve([zone("zone-one")]));
		expect(result.current.items.map((item) => item.id)).toEqual(["zone-one"]);
	});

	it("supports retry after an error", async () => {
		vi.spyOn(trekkingRoutesService, "listRouteDangerZones")
			.mockRejectedValueOnce(new HttpError("failure", 403, {}))
			.mockResolvedValueOnce([zone("recovered")]);
		const { result } = renderHook(() => useRouteDangerZones("route-one"));
		await waitFor(() => expect(result.current.error).toContain("không có quyền"));
		await act(async () => result.current.reload());
		expect(result.current.items[0]?.id).toBe("recovered");
	});

	it("ignores a stale response after the selected Route changes", async () => {
		let resolveFirst!: (items: RouteDangerZone[]) => void;
		vi.spyOn(trekkingRoutesService, "listRouteDangerZones")
			.mockReturnValueOnce(
				new Promise((done) => {
					resolveFirst = done;
				})
			)
			.mockResolvedValueOnce([zone("route-two-zone")]);
		const { result, rerender } = renderHook(({ routeId }) => useRouteDangerZones(routeId), {
			initialProps: { routeId: "route-one" },
		});
		rerender({ routeId: "route-two" });
		await waitFor(() => expect(result.current.items[0]?.id).toBe("route-two-zone"));
		await act(async () => resolveFirst([zone("stale-zone")]));
		expect(result.current.items[0]?.id).toBe("route-two-zone");
	});

	it.each([401, 403, 404])("maps list status %s", (status) => {
		expect(dangerZoneListError(new HttpError("failure", status, {}))).not.toBe("");
	});
});
