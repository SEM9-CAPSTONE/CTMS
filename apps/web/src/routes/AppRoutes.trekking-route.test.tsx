import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "./AppRoutes";

vi.mock("../features/role-landing/pages/RoleLandingPage", () => ({
	RoleLandingPage: ({
		onCreateTrekkingRoute,
		onViewTrekkingRoutes,
	}: {
		onCreateTrekkingRoute?: (campsiteId?: string) => void;
		onViewTrekkingRoutes?: (campsiteId: string) => void;
	}) => (
		<>
			<button
				type="button"
				onClick={() => onCreateTrekkingRoute?.("11111111-1111-4111-8111-111111111111")}
			>
				Create route for owned campsite
			</button>
			<button
				type="button"
				onClick={() => onViewTrekkingRoutes?.("11111111-1111-4111-8111-111111111111")}
			>
				View routes for owned campsite
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

describe("AppRoutes campsite route creation navigation", () => {
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

	it("navigates to create route with the campsiteId query parameter", async () => {
		render(<AppRoutes />);
		await userEvent.click(screen.getByRole("button", { name: "Create route for owned campsite" }));

		expect(window.location.pathname).toBe("/host/trekking-routes/create");
		expect(window.location.search).toBe("?campsiteId=11111111-1111-4111-8111-111111111111");
		expect(screen.getByText("Create Trekking Route Page")).toBeInTheDocument();
	});

	it("navigates to the route list with the campsiteId query parameter", async () => {
		render(<AppRoutes />);
		await userEvent.click(screen.getByRole("button", { name: "View routes for owned campsite" }));

		expect(window.location.pathname).toBe("/host/trekking-routes");
		expect(window.location.search).toBe("?campsiteId=11111111-1111-4111-8111-111111111111");
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
