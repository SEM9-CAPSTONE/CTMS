import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "./AppRoutes";

vi.mock("../features/role-landing/pages/RoleLandingPage", () => ({
	RoleLandingPage: ({
		onCreateTrekkingRoute,
		onViewTrekkingRoutes,
	}: {
		onCreateTrekkingRoute?: () => void;
		onViewTrekkingRoutes?: () => void;
	}) => (
		<>
			<button type="button" onClick={() => onCreateTrekkingRoute?.()}>
				Create route
			</button>
			<button type="button" onClick={() => onViewTrekkingRoutes?.()}>
				View routes
			</button>
		</>
	),
}));

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
		await userEvent.click(screen.getByRole("button", { name: "Create route" }));

		expect(window.location.pathname).toBe("/host/trekking-routes/create");
		expect(window.location.search).toBe("");
		expect(screen.getByText("Create Trekking Route Page")).toBeInTheDocument();
	});

	it("navigates to the route list", async () => {
		render(<AppRoutes />);
		await userEvent.click(screen.getByRole("button", { name: "View routes" }));

		expect(window.location.pathname).toBe("/host/trekking-routes");
		expect(window.location.search).toBe("");
		expect(screen.getByText("Trekking Routes Page")).toBeInTheDocument();
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
