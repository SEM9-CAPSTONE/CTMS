import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const creation = {
	isSubmitting: false,
	error: null,
	createdTrip: null,
	submit: vi.fn(),
	retry: vi.fn(),
	reset: vi.fn(),
};

const routes = {
	items: [
		{ id: "active", status: "active", name: "Active route" },
		{ id: "draft", status: "draft", name: "Draft route" },
	],
	isLoading: false,
	error: "",
	retry: vi.fn(),
};

describe("CreateTripPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	async function renderPage() {
		vi.resetModules();
		vi.doMock("../hooks/useCreateTrip", () => ({ useCreateTrip: () => creation }));
		vi.doMock("../../trekking-routes/hooks/useTrekkingRoutes", () => ({
			useTrekkingRoutes: () => routes,
		}));
		vi.doMock("../components/CreateTripForm", () => ({
			CreateTripForm: ({ activeRoutes }: { activeRoutes: Array<{ status: string }> }) => (
				<div data-testid="trip-form">{activeRoutes.map((route) => route.status).join(",")}</div>
			),
		}));
		vi.doMock("../components/ConfigureTripWaypointsPanel", () => ({
			ConfigureTripWaypointsPanel: () => <div data-testid="configure-waypoints-panel" />,
		}));
		const { CreateTripPage } = await import("./CreateTripPage");
		render(<CreateTripPage />);
	}

	it("renders the create form for the intended Host flow using approved routes only", async () => {
		await renderPage();
		expect(screen.getByTestId("trip-form")).toHaveTextContent("active");
		expect(screen.getByTestId("trip-form")).not.toHaveTextContent("draft");
	});

	it("renders authoritative server state after success", async () => {
		vi.resetModules();
		vi.doMock("../hooks/useCreateTrip", () => ({
			useCreateTrip: () => ({
				...creation,
				createdTrip: {
					id: "trip-1",
					title: "Bidoup",
					status: "draft",
					seatsTaken: 0,
					durationNights: 0,
				},
			}),
		}));
		vi.doMock("../../trekking-routes/hooks/useTrekkingRoutes", () => ({
			useTrekkingRoutes: () => routes,
		}));
		vi.doMock("../components/ConfigureTripWaypointsPanel", () => ({
			ConfigureTripWaypointsPanel: () => <div data-testid="configure-waypoints-panel" />,
		}));
		const { CreateTripPage } = await import("./CreateTripPage");

		render(<CreateTripPage />);

		expect(screen.getByTestId("server-trip-status")).toHaveTextContent("draft");
		expect(screen.getByTestId("server-seats-taken")).toHaveTextContent("0");
		expect(screen.getByTestId("configure-waypoints-panel")).toBeVisible();
	});
});
