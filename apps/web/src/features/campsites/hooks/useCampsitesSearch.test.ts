import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { campsitesService } from "../services/campsites.service";
import { useCampsitesSearch } from "./useCampsitesSearch";

vi.mock("../services/campsites.service", () => ({
	campsitesService: { search: vi.fn() },
}));

const mockedSearch = vi.mocked(campsitesService.search);

describe("useCampsitesSearch", () => {
	beforeEach(() => {
		mockedSearch.mockReset();
		mockedSearch.mockResolvedValue({
			items: [],
			pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
		});
	});

	it("fires an initial search with page/limit defaults and no status field at all", async () => {
		const { result } = renderHook(() => useCampsitesSearch());

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		expect(mockedSearch).toHaveBeenCalledTimes(1);
		const calledWith = mockedSearch.mock.calls[0][0];
		expect(calledWith).toEqual({ page: 1, limit: 20 });
		expect("status" in calledWith).toBe(false);
	});

	it("submitFilters builds params from input state, dropping empty/invalid values", async () => {
		const { result } = renderHook(() => useCampsitesSearch());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => {
			result.current.setProvinceInput("  Lam Dong  ");
			result.current.setAmenitiesInput("wifi, bbq ,, ");
			result.current.setMinPriceInput("100");
			result.current.setMaxPriceInput("not-a-number");
		});
		act(() => {
			result.current.submitFilters();
		});

		await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(2));
		const calledWith = mockedSearch.mock.calls[1][0];
		expect(calledWith).toEqual({
			province: "Lam Dong",
			amenities: ["wifi", "bbq"],
			minPrice: 100,
			maxPrice: undefined,
			page: 1,
			limit: 20,
		});
	});

	it("resetFilters clears input state and re-searches with no filters", async () => {
		const { result } = renderHook(() => useCampsitesSearch());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => {
			result.current.setProvinceInput("Lam Dong");
		});
		act(() => {
			result.current.submitFilters();
		});
		await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(2));

		act(() => {
			result.current.resetFilters();
		});
		await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(3));

		expect(result.current.provinceInput).toBe("");
		expect(mockedSearch).toHaveBeenNthCalledWith(3, { page: 1, limit: 20 });
	});

	it("setPage keeps page-only changes and does not touch filters", async () => {
		const { result } = renderHook(() => useCampsitesSearch());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => {
			result.current.setProvinceInput("Lam Dong");
		});
		act(() => {
			result.current.submitFilters();
		});
		await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(2));

		act(() => {
			result.current.setPage(2);
		});
		await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(3));
		expect(mockedSearch).toHaveBeenNthCalledWith(3, { province: "Lam Dong", page: 2, limit: 20 });
	});

	it("BR-241: a second submitFilters()/setPage() call while a request is in flight is a no-op", async () => {
		let resolveFirst!: (value: Awaited<ReturnType<typeof campsitesService.search>>) => void;
		mockedSearch.mockReset();
		mockedSearch.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveFirst = resolve;
				})
		);

		const { result } = renderHook(() => useCampsitesSearch());
		expect(result.current.isLoading).toBe(true);

		// Fires while the first (initial) request is still pending.
		act(() => {
			result.current.submitFilters();
			result.current.setPage(2);
		});
		expect(mockedSearch).toHaveBeenCalledTimes(1); // still just the initial call

		mockedSearch.mockResolvedValue({
			items: [],
			pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
		});
		act(() => {
			resolveFirst({ items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
		});
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		// Guard released after completion; no queued call fired automatically.
		expect(mockedSearch).toHaveBeenCalledTimes(1);
	});

	it("maps a 401 error via mapCampsitesError, distinct from a 422", async () => {
		mockedSearch.mockRejectedValueOnce(new HttpError("Authentication required", 401, {}));
		const { result } = renderHook(() => useCampsitesSearch());
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.errorMessage).toBe(
			"Phiên đăng nhập đã hết hạn hoặc tài khoản không còn hoạt động. Vui lòng đăng nhập lại."
		);

		mockedSearch.mockRejectedValueOnce(
			new HttpError("Unprocessable Entity", 422, {
				message: [{ field: "minPrice", errors: ["bad"] }],
			})
		);
		act(() => {
			result.current.reload();
		});
		await waitFor(() =>
			expect(result.current.errorMessage).toBe(
				"Bộ lọc tìm kiếm không hợp lệ. Vui lòng kiểm tra lại."
			)
		);
	});

	it("a successful reload after an error clears errorMessage", async () => {
		mockedSearch.mockRejectedValueOnce(new HttpError("Insufficient permission", 403, {}));
		const { result } = renderHook(() => useCampsitesSearch());
		await waitFor(() => expect(result.current.errorMessage).not.toBeNull());

		mockedSearch.mockResolvedValueOnce({
			items: [],
			pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
		});
		act(() => {
			result.current.reload();
		});
		await waitFor(() => expect(result.current.errorMessage).toBeNull());
	});
});
