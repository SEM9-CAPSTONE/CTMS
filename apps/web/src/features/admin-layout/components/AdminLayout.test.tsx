import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminLayout } from "./AdminLayout";

vi.mock("../../../shared/components/Collapse", () => ({
	Collapse: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../../shared/components/HomeLink", () => ({
	HomeLink: ({ children, className }: { children: React.ReactNode; className?: string }) => (
		<a href="/" className={className}>
			{children}
		</a>
	),
}));

vi.mock("../../auth/utils/tokenStorage", () => ({
	getStoredAuthUser: vi.fn(() => ({
		id: "admin-1",
		fullName: "Quản trị viên hệ thống",
		email: "admin@ctms.local",
		phone: "0900000000",
		role: "admin",
	})),
}));

vi.mock("../../camper-profile/services/camper-profile.service", () => ({
	camperProfileService: {
		getProfile: vi.fn().mockResolvedValue({
			id: "admin-1",
			fullName: "Quản trị viên hệ thống",
			email: "admin@ctms.local",
			phone: "0900000000",
			avatarUrl: "https://example.com/admin.png",
		}),
	},
}));

describe("AdminLayout & AdminSidebar Profile Display", () => {
	it("renders logged in admin user information with Admin badge", async () => {
		render(
			<AdminLayout activeItem="user-accounts">
				<div>Admin Content</div>
			</AdminLayout>
		);

		await waitFor(
			() => {
				expect(screen.getAllByText("Quản trị viên hệ thống").length).toBeGreaterThan(0);
			},
			{ timeout: 5000 }
		);
		expect(screen.getAllByText("admin@ctms.local").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Admin").length).toBeGreaterThan(0);
	});
});
