import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "./AppRoutes";

vi.mock("../features/trekking-routes/pages/CreateTrekkingRoutePage", () => ({
	CreateTrekkingRoutePage: () => <div>Create Trekking Route Page</div>,
}));
vi.mock("../features/trekking-routes/pages/TrekkingRoutesPage", () => ({
	TrekkingRoutesPage: () => <div>Trekking Routes Page</div>,
}));

describe("AppRoutes trekking route navigation", () => {
	beforeEach(() => {
		localStorage.clear();
		localStorage.setItem(
			"authUser",
			JSON.stringify({
				id: "host-id",
				email: "host@example.com",
				phone: null,
				role: "host",
				roles: ["host"],
				status: "active",
				createdAt: "2026-08-25T00:00:00.000Z",
			})
		);
		window.history.replaceState({}, "", "/dashboard");
	});

	it("navigates to create route", async () => {
		render(<AppRoutes />);
		expect(screen.getByRole("button", { name: "Quản lý tuyến trekking" })).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Tạo tuyến trekking" }));

		expect(window.location.pathname).toBe("/host/trekking-routes/create");
		expect(window.location.search).toBe("");
		expect(screen.getByText("Create Trekking Route Page")).toBeInTheDocument();
	});

	it("navigates to the route list", async () => {
		render(<AppRoutes />);
		expect(screen.getByRole("button", { name: "Tạo tuyến trekking" })).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Quản lý tuyến trekking" }));

		expect(window.location.pathname).toBe("/host/trekking-routes");
		expect(window.location.search).toBe("");
		expect(screen.getByText("Trekking Routes Page")).toBeInTheDocument();
	});

	it.each(["camper", "porter", "admin"])(
		"does not expose Host Route actions on the %s dashboard",
		(role) => {
			localStorage.setItem(
				"authUser",
				JSON.stringify({
					id: `${role}-id`,
					email: `${role}@example.com`,
					phone: null,
					role,
					roles: [role],
					status: "active",
					createdAt: "2026-08-25T00:00:00.000Z",
				})
			);

			render(<AppRoutes />);

			expect(screen.queryByRole("button", { name: "Tạo tuyến trekking" })).not.toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: "Quản lý tuyến trekking" })
			).not.toBeInTheDocument();
		}
	);

	it("keeps the existing Admin user-management action intact", async () => {
		localStorage.setItem(
			"authUser",
			JSON.stringify({
				id: "admin-id",
				email: "admin@example.com",
				phone: null,
				role: "admin",
				roles: ["admin"],
				status: "active",
				createdAt: "2026-08-25T00:00:00.000Z",
			})
		);

		render(<AppRoutes />);
		await userEvent.click(screen.getByRole("button", { name: "Quản lý user" }));

		expect(window.location.pathname).toBe("/admin/users");
	});

	it.each(["camper", "porter"])("prevents %s from mounting the Host Route page", (role) => {
		localStorage.setItem(
			"authUser",
			JSON.stringify({
				id: `${role}-id`,
				email: `${role}@example.com`,
				phone: null,
				role,
				roles: [role],
				status: "active",
				createdAt: "2026-08-25T00:00:00.000Z",
			})
		);
		window.history.replaceState({}, "", "/host/trekking-routes");

		render(<AppRoutes />);

		expect(screen.queryByText("Trekking Routes Page")).not.toBeInTheDocument();
		expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Truy cập bị từ chối");
	});
});
