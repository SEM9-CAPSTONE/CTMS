import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import { mapCreateRouteError, useCreateTrekkingRoute } from "./useCreateTrekkingRoute";

vi.mock("../services/trekking-routes.service", () => ({
	trekkingRoutesService: { create: vi.fn() },
}));

const payload = {
	name: "Ridge",
	geometry: {
		type: "LineString" as const,
		coordinates: [
			[108.45, 11.94],
			[108.46, 11.95],
		] as [number, number][],
	},
	difficulty: "easy" as const,
	expectedDurationMinutes: 90,
};

describe("useCreateTrekkingRoute", () => {
	beforeEach(() => vi.clearAllMocks());
	it("prevents duplicate submissions", async () => {
		let resolve!: (value: never) => void;
		vi.mocked(trekkingRoutesService.create).mockImplementation(
			() =>
				new Promise((done) => {
					resolve = done;
				})
		);
		const { result } = renderHook(() => useCreateTrekkingRoute());
		let first!: Promise<unknown>;
		await act(async () => {
			first = result.current.submit(payload);
			const second = await result.current.submit(payload);
			expect(second).toBeNull();
			resolve({ id: "route" } as never);
			await first;
		});
		expect(trekkingRoutesService.create).toHaveBeenCalledTimes(1);
	});

	it.each([401, 403, 404, 409, 422])("maps API status %s", (status) => {
		expect(mapCreateRouteError(new HttpError("failure", status, {}))).toEqual(
			expect.objectContaining({ status })
		);
	});
	it("maps the server duration minimum to a localized field message", () => {
		expect(
			mapCreateRouteError(
				new HttpError("invalid", 422, { code: "ROUTE_DURATION_TOO_SHORT", minimumMinutes: 265 })
			)
		).toEqual({
			status: 422,
			message: "Thời lượng di chuyển phải từ 265 phút.",
			minimumMinutes: 265,
			canRetry: false,
		});
	});

	it("keeps the last payload available for retry after failure", async () => {
		vi.mocked(trekkingRoutesService.create)
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce({ id: "route" } as never);
		const { result } = renderHook(() => useCreateTrekkingRoute());
		await act(async () => {
			await result.current.submit(payload);
		});
		expect(result.current.error).not.toBeNull();
		await act(async () => {
			await result.current.retry();
		});
		expect(trekkingRoutesService.create).toHaveBeenNthCalledWith(2, payload);
	});
});
