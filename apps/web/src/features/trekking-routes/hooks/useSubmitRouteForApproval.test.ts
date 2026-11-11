import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import { mapRouteSubmissionError, useSubmitRouteForApproval } from "./useSubmitRouteForApproval";

let submitForApproval: ReturnType<typeof vi.spyOn>;

describe("useSubmitRouteForApproval", () => {
	beforeEach(() => {
		submitForApproval = vi.spyOn(trekkingRoutesService, "submitForApproval");
	});

	afterEach(() => vi.restoreAllMocks());

	it("submits once and reloads authoritative route data before resolving", async () => {
		const updated = { id: "route-id", status: "pending_approval" };
		submitForApproval.mockResolvedValue(updated);
		const onReload = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() => useSubmitRouteForApproval(onReload));

		let response: unknown;
		await act(async () => {
			response = await result.current.submit("route-id");
		});

		expect(response).toBe(updated);
		expect(submitForApproval).toHaveBeenCalledWith("route-id");
		expect(onReload).toHaveBeenCalledTimes(1);
	});

	it("prevents duplicate submission while the first request is pending", async () => {
		let resolve!: (value: unknown) => void;
		submitForApproval.mockReturnValue(
			new Promise((done) => {
				resolve = done;
			})
		);
		const onReload = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() => useSubmitRouteForApproval(onReload));
		let first!: Promise<unknown>;

		act(() => {
			first = result.current.submit("route-id");
		});
		expect(result.current.isSubmitting).toBe(true);
		expect(await result.current.submit("route-id")).toBeNull();
		expect(submitForApproval).toHaveBeenCalledTimes(1);

		resolve({ id: "route-id", status: "pending_approval" });
		await act(async () => first);
		await waitFor(() => expect(result.current.isSubmitting).toBe(false));
	});

	it.each([401, 403, 404, 409, 422])("maps backend status %s", (status) => {
		expect(mapRouteSubmissionError(new HttpError("failure", status, {}))).toEqual(
			expect.objectContaining({ status, message: expect.any(String) })
		);
	});

	it("surfaces structured 422 details translated into Vietnamese", () => {
		const error = new HttpError("invalid", 422, {
			message: [{ field: "checkpoints", errors: ["exactly one finish checkpoint is required"] }],
		});
		expect(mapRouteSubmissionError(error).message).toBe("Tuyến phải có đúng một điểm kết thúc.");
	});

	it("translates known backend validation errors into clear Vietnamese", () => {
		const error = new HttpError("invalid", 422, {
			message: [
				{ field: "checkpoints", errors: ["stored route checkpoints are invalid"] },
				{ field: "checkpoints", errors: ["route must have exactly one start checkpoint"] },
			],
		});
		expect(mapRouteSubmissionError(error).message).toBe(
			"Dữ liệu các vị trí trên tuyến không hợp lệ. Tuyến phải có đúng một điểm bắt đầu."
		);
	});

	it("reloads the route list after a 404 response", async () => {
		submitForApproval.mockRejectedValue(new HttpError("missing", 404, {}));
		const onReload = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() => useSubmitRouteForApproval(onReload));

		await act(async () => {
			await result.current.submit("missing-route");
		});

		expect(onReload).toHaveBeenCalledTimes(1);
		expect(result.current.error?.status).toBe(404);
	});
});
