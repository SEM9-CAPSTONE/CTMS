import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { adminUserAccountsService } from "../services/admin-user-accounts.service";
import type { UserAccountDetail, UserAccountSummary } from "../types";
import { AdminUserAccountsPage } from "./AdminUserAccountsPage";

vi.mock("../services/admin-user-accounts.service", () => ({
	adminUserAccountsService: {
		getCurrentUser: vi.fn(),
		getUsers: vi.fn(),
		getUser: vi.fn(),
		lockUser: vi.fn(),
		unlockUser: vi.fn(),
	},
}));

const admin: UserAccountSummary = {
	id: "admin-1",
	email: "admin@ctms.local",
	phone: null,
	fullName: "CTMS Admin",
	role: "admin",
	status: "active",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};
const camper: UserAccountSummary = {
	id: "user-1",
	email: "camper@example.com",
	phone: "+84912345678",
	fullName: "Nguyen Camper",
	role: "camper",
	status: "active",
	createdAt: "2026-01-02T00:00:00.000Z",
	updatedAt: "2026-01-02T00:00:00.000Z",
};
const detail: UserAccountDetail = {
	...camper,
	dateOfBirth: "1995-04-12",
	gender: "male",
	address: "Da Lat",
	bio: "Weekend trekker",
};

describe("AdminUserAccountsPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(adminUserAccountsService.getCurrentUser).mockResolvedValue({
			id: admin.id,
			role: "admin",
			status: "active",
		});
		vi.mocked(adminUserAccountsService.getUsers).mockResolvedValue({
			items: [admin, camper],
			pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
		});
	});

	it("renders accounts and disables self-lock", async () => {
		render(<AdminUserAccountsPage />);

		expect(await screen.findByText("Nguyen Camper")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "User Accounts" })).toHaveAttribute(
			"aria-current",
			"page"
		);
		expect(screen.getByRole("button", { name: /Audit Logs/ })).toBeDisabled();
		expect(screen.getByRole("button", { name: /Content Reports/ })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Khóa CTMS Admin" })).toBeDisabled();
		expect(screen.getByText(/Tổng cộng/)).toHaveTextContent("2");
	});

	it("submits search and filter parameters", async () => {
		const user = userEvent.setup();
		render(<AdminUserAccountsPage />);
		await screen.findByText("Nguyen Camper");

		await user.type(
			screen.getByPlaceholderText("Tên, email hoặc số điện thoại"),
			"camper@example.com"
		);
		await user.selectOptions(screen.getByLabelText("Lọc theo vai trò"), "camper");
		await user.click(screen.getByRole("button", { name: "Tìm kiếm" }));

		await waitFor(() =>
			expect(adminUserAccountsService.getUsers).toHaveBeenLastCalledWith(
				expect.objectContaining({ search: "camper@example.com", role: "camper", page: 1 })
			)
		);
	});

	it("loads and displays account details", async () => {
		const user = userEvent.setup();
		vi.mocked(adminUserAccountsService.getUser).mockResolvedValue(detail);
		render(<AdminUserAccountsPage />);
		await user.click(await screen.findByRole("button", { name: "Xem Nguyen Camper" }));

		expect(await screen.findByRole("dialog", { name: "Chi tiết tài khoản" })).toBeInTheDocument();
		expect(screen.getByText("Weekend trekker")).toBeInTheDocument();
		expect(adminUserAccountsService.getUser).toHaveBeenCalledWith(camper.id);
	});

	it("locks an account with an optional audit reason", async () => {
		const user = userEvent.setup();
		vi.mocked(adminUserAccountsService.lockUser).mockResolvedValue({
			...detail,
			status: "suspended",
		});
		render(<AdminUserAccountsPage />);
		await user.click(await screen.findByRole("button", { name: "Khóa Nguyen Camper" }));
		await user.type(screen.getByPlaceholderText("Nhập lý do cho audit log"), "Security review");
		await user.click(screen.getByRole("button", { name: "Xác nhận khóa" }));

		await waitFor(() =>
			expect(adminUserAccountsService.lockUser).toHaveBeenCalledWith(camper.id, {
				reason: "Security review",
			})
		);
		expect(await screen.findByText("Đã khóa tài khoản thành công.")).toBeInTheDocument();
	});

	it("preserves the entered reason when the backend reports a conflict", async () => {
		const user = userEvent.setup();
		vi.mocked(adminUserAccountsService.lockUser).mockRejectedValue(
			new HttpError("Conflict", 409, { statusCode: 409 })
		);
		render(<AdminUserAccountsPage />);
		await user.click(await screen.findByRole("button", { name: "Khóa Nguyen Camper" }));
		const reason = screen.getByPlaceholderText("Nhập lý do cho audit log");
		await user.type(reason, "Keep this reason");
		await user.click(screen.getByRole("button", { name: "Xác nhận khóa" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(/trạng thái tài khoản đã thay đổi/i);
		expect(reason).toHaveValue("Keep this reason");
	});

	it("shows an empty state", async () => {
		vi.mocked(adminUserAccountsService.getUsers).mockResolvedValue({
			items: [],
			pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
		});
		render(<AdminUserAccountsPage />);
		expect(await screen.findByText("Không tìm thấy tài khoản phù hợp")).toBeInTheDocument();
	});
});
