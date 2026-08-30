import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { FIXED_EXPLORE_PROVINCE } from "../hooks/useCampsitesSearch";
import { campsitesService } from "../services/campsites.service";
import type { PaginatedCampsiteSearchResponse } from "../types";
import { SearchCampsitesPage } from "./SearchCampsitesPage";

vi.mock("../services/campsites.service", () => ({
	campsitesService: { search: vi.fn() },
}));

vi.mock("../../camper-profile/services/camper-profile.service", () => ({
	camperProfileService: {
		getProfile: vi.fn(() =>
			Promise.resolve({
				id: "camper-id",
				fullName: "Test Camper",
				avatarUrl: null,
				email: "camper@test.com",
				phone: "0123456789",
			})
		),
	},
}));

const mockedSearch = vi.mocked(campsitesService.search);

const oneItemPage: PaginatedCampsiteSearchResponse = {
	items: [
		{
			id: "1",
			name: "Đà Lạt Pine Camp",
			location: { province: "Lam Dong", latitude: 11.9, longitude: 108.4 },
			coverImage: null,
			activeRoutes: [],
		},
	],
	pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

const emptyPage: PaginatedCampsiteSearchResponse = {
	items: [],
	pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
};

/**
 * CTMS-17-T02. This page is reached only after AppRoleGuard already let the
 * user through (see routes/AppRoutes.test.tsx / Step 5's routing coverage)
 * -- so this suite deliberately does NOT re-test anonymous/wrong-role
 * blocking. It covers the page's own responsibility: loading/error/empty/
 * success rendering, and correctly distinguishing API-level error statuses
 * (401 vs 403 vs 422) that can still occur after the guard has passed
 * (e.g. the session expiring mid-use).
 */
describe("SearchCampsitesPage", () => {
	beforeEach(() => {
		mockedSearch.mockReset();
	});

	it("fires the initial search with page=1, limit=20, province fixed to Đà Nẵng, and nothing else", async () => {
		mockedSearch.mockResolvedValue(emptyPage);
		render(<SearchCampsitesPage />);
		await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(1));
		expect(mockedSearch).toHaveBeenCalledWith({
			province: FIXED_EXPLORE_PROVINCE,
			page: 1,
			limit: 20,
		});
	});

	it("shows the loading state while pending, not a stale success/empty view", async () => {
		let resolveFn!: (value: PaginatedCampsiteSearchResponse) => void;
		mockedSearch.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveFn = resolve;
				})
		);
		render(<SearchCampsitesPage />);
		expect(screen.getByText(/đang tìm kiếm khu cắm trại/i)).toBeInTheDocument();
		expect(screen.queryByText(/không tìm thấy khu cắm trại/i)).not.toBeInTheDocument();
		expect(screen.queryByText("Đà Lạt Pine Camp")).not.toBeInTheDocument();

		resolveFn(oneItemPage);
		await waitFor(() => expect(screen.getByText("Đà Lạt Pine Camp")).toBeInTheDocument());
	});

	it("maps a post-guard 401 (session expired/account deactivated mid-use)", async () => {
		mockedSearch.mockRejectedValue(new HttpError("Authentication required", 401, {}));
		render(<SearchCampsitesPage />);
		await waitFor(() =>
			expect(
				screen.getByText(
					"Phiên đăng nhập đã hết hạn hoặc tài khoản không còn hoạt động. Vui lòng đăng nhập lại."
				)
			).toBeInTheDocument()
		);
	});

	it("maps a post-guard 403 distinctly from 401", async () => {
		mockedSearch.mockRejectedValue(new HttpError("Insufficient permission", 403, {}));
		render(<SearchCampsitesPage />);
		await waitFor(() =>
			expect(screen.getByText("Bạn không có quyền tìm kiếm khu cắm trại.")).toBeInTheDocument()
		);
	});

	it("maps a 422 (invalid filter value) distinctly from 401/403", async () => {
		mockedSearch.mockRejectedValue(
			new HttpError("Unprocessable Entity", 422, {
				message: [{ field: "minPrice", errors: ["bad"] }],
			})
		);
		render(<SearchCampsitesPage />);
		await waitFor(() =>
			expect(
				screen.getByText("Bộ lọc tìm kiếm không hợp lệ. Vui lòng kiểm tra lại.")
			).toBeInTheDocument()
		);
	});

	it("distinguishes empty-result from error -- different copy, not conflated", async () => {
		mockedSearch.mockResolvedValue(emptyPage);
		const { unmount } = render(<SearchCampsitesPage />);
		await waitFor(() =>
			expect(screen.getByText(/không tìm thấy khu cắm trại phù hợp/i)).toBeInTheDocument()
		);
		expect(screen.queryByText(/không thể tải danh sách/i)).not.toBeInTheDocument();
		unmount();

		mockedSearch.mockRejectedValue(new HttpError("boom", 500, {}));
		render(<SearchCampsitesPage />);
		await waitFor(() => expect(screen.getByText(/không thể tải danh sách/i)).toBeInTheDocument());
		expect(screen.queryByText(/không tìm thấy khu cắm trại phù hợp/i)).not.toBeInTheDocument();
	});

	it("renders result cards and pagination matching real backend data", async () => {
		mockedSearch.mockResolvedValue({
			items: [oneItemPage.items[0]],
			pagination: { page: 1, limit: 20, total: 37, totalPages: 2 },
		});
		render(<SearchCampsitesPage />);
		await waitFor(() => expect(screen.getByText("Đà Lạt Pine Camp")).toBeInTheDocument());
		expect(screen.getByText("Lam Dong")).toBeInTheDocument();
		expect(screen.getByText("37")).toBeInTheDocument();
		expect(screen.getByText(/trang 1 \/ 2/i)).toBeInTheDocument();
	});

	it("submitting a filter fires exactly one additional search (no duplicate beyond the hook's own guard)", async () => {
		mockedSearch.mockResolvedValue(emptyPage);
		render(<SearchCampsitesPage />);
		await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(1));

		fireEvent.change(screen.getByLabelText("Tiện ích"), { target: { value: "wifi" } });
		fireEvent.click(screen.getByRole("button", { name: /tìm kiếm/i }));

		await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(2));
		expect(mockedSearch).toHaveBeenNthCalledWith(2, {
			province: FIXED_EXPLORE_PROVINCE,
			amenities: ["wifi"],
			page: 1,
			limit: 20,
		});
	});

	it("clicking Reset after a filter re-searches with province still fixed and no other filters", async () => {
		mockedSearch.mockResolvedValue(emptyPage);
		render(<SearchCampsitesPage />);
		await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(1));

		fireEvent.change(screen.getByLabelText("Tiện ích"), { target: { value: "wifi" } });
		fireEvent.click(screen.getByRole("button", { name: /tìm kiếm/i }));
		await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(2));

		fireEvent.click(screen.getByRole("button", { name: /đặt lại/i }));
		await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(3));
		expect(mockedSearch).toHaveBeenNthCalledWith(3, {
			province: FIXED_EXPLORE_PROVINCE,
			page: 1,
			limit: 20,
		});
		expect((screen.getByLabelText("Tiện ích") as HTMLInputElement).value).toBe("");
	});

	it("paginating preserves the currently-submitted filters", async () => {
		mockedSearch.mockResolvedValue({
			items: [oneItemPage.items[0]],
			pagination: { page: 1, limit: 20, total: 40, totalPages: 2 },
		});
		render(<SearchCampsitesPage />);
		await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(1));

		fireEvent.change(screen.getByLabelText("Tiện ích"), { target: { value: "wifi" } });
		fireEvent.click(screen.getByRole("button", { name: /tìm kiếm/i }));
		await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(2));

		mockedSearch.mockResolvedValue({
			items: [oneItemPage.items[0]],
			pagination: { page: 2, limit: 20, total: 40, totalPages: 2 },
		});
		fireEvent.click(screen.getByLabelText("Trang sau"));

		await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(3));
		expect(mockedSearch).toHaveBeenNthCalledWith(3, {
			province: FIXED_EXPLORE_PROVINCE,
			amenities: ["wifi"],
			page: 2,
			limit: 20,
		});
	});

	it("makes no calls beyond what the hook issues -- exactly 1 call per user action, none on its own", async () => {
		mockedSearch.mockResolvedValue(emptyPage);
		render(<SearchCampsitesPage />);
		await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(1));
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(mockedSearch).toHaveBeenCalledTimes(1);
	});

	it("the error banner's Retry button re-issues the same search", async () => {
		mockedSearch.mockRejectedValueOnce(new HttpError("boom", 500, {}));
		render(<SearchCampsitesPage />);
		await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(1));

		mockedSearch.mockResolvedValueOnce(emptyPage);
		fireEvent.click(screen.getByRole("button", { name: /thử lại/i }));
		await waitFor(() => expect(mockedSearch).toHaveBeenCalledTimes(2));
		expect(mockedSearch).toHaveBeenNthCalledWith(2, {
			province: FIXED_EXPLORE_PROVINCE,
			page: 1,
			limit: 20,
		});
	});
});
