import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../../core/api";
import { RoleLandingPage } from "../../role-landing/pages/RoleLandingPage";
import { adminModerationService } from "../services/admin-moderation.service";
import { AdminLayout } from "./AdminLayout";

describe("AdminLayout", () => {
	beforeEach(() => {
		localStorage.clear();
		window.history.replaceState({}, "", "/admin/users");
		vi.mocked(adminModerationService.getCounts).mockResolvedValue({
			trips: 4,
			trekkingRoutes: 2,
			porterVerifications: 0,
			contentReports: 1,
		});
	});

	it("keeps the admin account and sign-out action accessible", async () => {
		const user = userEvent.setup();
		render(
			<AdminLayout activeItem="user-accounts" onLogout={vi.fn()}>
				<div>Admin Content</div>
			</AdminLayout>
		);
		expect(await screen.findByText("Quản trị viên hệ thống")).toBeVisible();
		await user.click(screen.getByRole("button", { name: "Tài khoản quản trị" }));
		expect(screen.getByText("admin@ctms.local")).toBeVisible();
		expect(screen.getByRole("button", { name: "Đăng xuất" })).toBeVisible();
	});

	it("shows the moderation total and keeps per-item counts in the collapsed flyout", async () => {
		const user = userEvent.setup();
		const { unmount } = render(
			<AdminLayout activeItem="trip-review">
				<div>Admin Content</div>
			</AdminLayout>
		);
		const total = await screen.findByRole("button", { name: /Kiểm duyệt 7 mục chờ xử lý/ });
		expect(screen.getAllByRole("navigation", { name: "Điều hướng quản trị" })).toHaveLength(1);
		expect(total).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByRole("link", { name: /Duyệt chuyến đi 4 mục chờ xử lý/ })).toHaveAttribute(
			"aria-current",
			"page"
		);
		expect(screen.getByRole("link", { name: "Duyệt hồ sơ Porter" })).toBeVisible();

		await user.click(screen.getByRole("button", { name: "Thu gọn thanh điều hướng" }));
		const collapsedGroup = screen.getByRole("button", { name: /Kiểm duyệt 7 mục chờ xử lý/ });
		expect(collapsedGroup).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("link", { name: /Báo cáo từ người dùng/ })).toBeNull();
		await user.click(collapsedGroup);
		const panel = document.getElementById(collapsedGroup.getAttribute("aria-controls") ?? "");
		if (!panel) throw new Error("Missing moderation flyout");
		expect(
			within(panel).getByRole("link", { name: /Báo cáo từ người dùng 1 mục chờ xử lý/ })
		).toHaveAttribute("href", "/admin/content-reports");
		await user.keyboard("{Escape}");
		expect(collapsedGroup).toHaveFocus();
		expect(collapsedGroup).toHaveAttribute("aria-expanded", "false");

		unmount();
		render(
			<AdminLayout activeItem="content-reports">
				<div>Admin Content</div>
			</AdminLayout>
		);
		expect(screen.getByRole("button", { name: "Mở rộng thanh điều hướng" })).toBeVisible();
	});

	it("lets admin groups open and close independently across sidebar collapse", async () => {
		const user = userEvent.setup();
		render(
			<AdminLayout activeItem="user-accounts">
				<div>Admin Content</div>
			</AdminLayout>
		);

		const users = screen.getByRole("button", { name: "Người dùng" });
		const finance = screen.getByRole("button", { name: "Tài chính" });
		const system = screen.getByRole("button", { name: "Hệ thống" });
		expect(users).toHaveAttribute("aria-expanded", "true");

		await user.click(finance);
		await user.click(system);
		expect(users).toHaveAttribute("aria-expanded", "true");
		expect(finance).toHaveAttribute("aria-expanded", "true");
		expect(system).toHaveAttribute("aria-expanded", "true");

		await user.click(users);
		expect(users).toHaveAttribute("aria-expanded", "false");
		expect(finance).toHaveAttribute("aria-expanded", "true");
		expect(system).toHaveAttribute("aria-expanded", "true");

		await user.click(screen.getByRole("button", { name: "Thu gọn thanh điều hướng" }));
		await user.click(screen.getByRole("button", { name: "Mở rộng thanh điều hướng" }));
		expect(users).toHaveAttribute("aria-expanded", "false");
		expect(finance).toHaveAttribute("aria-expanded", "true");
		expect(system).toHaveAttribute("aria-expanded", "true");
	});

	it("uses the same admin sidebar when navigating to the dashboard", async () => {
		const user = userEvent.setup();
		const { rerender } = render(
			<AdminLayout activeItem="user-accounts">
				<div>Admin Content</div>
			</AdminLayout>
		);
		await user.click(screen.getByRole("button", { name: "Thu gọn thanh điều hướng" }));
		await user.click(screen.getByRole("link", { name: "Tổng quan" }));
		expect(window.location.pathname).toBe("/dashboard");
		expect(window.history.state).toMatchObject({ activeRole: "admin" });

		rerender(
			<RoleLandingPage
				user={{
					id: "admin-1",
					email: "admin@ctms.local",
					phone: null,
					role: "camper",
					roles: ["camper", "admin"],
					status: "active",
					createdAt: "2026-01-01T00:00:00Z",
				}}
				roles={["camper", "admin"]}
				onBackHome={vi.fn()}
			/>
		);
		const sidebar = screen.getByRole("navigation", { name: "Điều hướng quản trị" });
		expect(screen.getAllByRole("complementary")).toHaveLength(1);
		expect(within(sidebar).getByRole("link", { name: "Tổng quan" })).toHaveAttribute(
			"aria-current",
			"page"
		);
		expect(screen.getByRole("button", { name: "Mở rộng thanh điều hướng" })).toBeVisible();
		expect(screen.getByRole("heading", { name: "Trung tâm quản trị" })).toBeVisible();
		expect(screen.getByText("Coming soon")).toBeVisible();
		expect(screen.queryByText("Seed accounts")).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Tài khoản quản trị" }));
		await user.click(screen.getByRole("button", { name: "Camper" }));
		expect(window.history.state).toMatchObject({ activeRole: "camper" });
		expect(screen.queryByRole("navigation", { name: "Điều hướng quản trị" })).toBeNull();
	});

	it("hides the total when all queues are empty", async () => {
		const client = new QueryClient();
		client.setQueryData(queryKeys.adminModeration.counts("admin-1"), {
			trips: 0,
			trekkingRoutes: 0,
			porterVerifications: 0,
			contentReports: 0,
		});
		render(
			<QueryClientProvider client={client}>
				<AdminLayout activeItem="trip-review">
					<div>Admin Content</div>
				</AdminLayout>
			</QueryClientProvider>
		);
		expect(await screen.findByRole("button", { name: "Kiểm duyệt" })).toHaveAttribute(
			"aria-expanded",
			"true"
		);
		expect(screen.getByRole("link", { name: "Duyệt chuyến đi" })).toBeVisible();
	});

	it("directs to /admin/reports/performance when clicking Quản trị CTMS branding", async () => {
		render(
			<AdminLayout activeItem="user-accounts">
				<div>Admin Content</div>
			</AdminLayout>
		);

		const brandLink = screen.getByRole("link", { name: "Về trang Báo cáo hiệu suất" });
		expect(brandLink).toHaveAttribute("href", "/admin/reports/performance");

		fireEvent.click(brandLink);
		expect(window.location.pathname).toBe("/admin/reports/performance");
	});
});
