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

const updateDraft = {
	isSubmitting: false,
	error: null,
	updatedTrip: null,
	submit: vi.fn(),
	retry: vi.fn(),
	reset: vi.fn(),
};

const tripDetail = {
	trip: null,
	isLoading: false,
	error: null,
	isNotFound: false,
	retry: vi.fn(),
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
		vi.doMock("../hooks/useUpdateTripDraft", () => ({
			useUpdateTripDraft: () => updateDraft,
		}));
		vi.doMock("../hooks/useTripDetail", () => ({ useTripDetail: () => tripDetail }));
		vi.doMock("../schema/create-trip.schema", () => ({
			toCreateTripFormValues: vi.fn(() => ({})),
		}));
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
		vi.doMock("../hooks/useUpdateTripDraft", () => ({
			useUpdateTripDraft: () => updateDraft,
		}));
		vi.doMock("../hooks/useTripDetail", () => ({ useTripDetail: () => tripDetail }));
		vi.doMock("../schema/create-trip.schema", () => ({
			toCreateTripFormValues: vi.fn(() => ({})),
		}));
		vi.doMock("../../trekking-routes/hooks/useTrekkingRoutes", () => ({
			useTrekkingRoutes: () => routes,
		}));
		vi.doMock("../components/ConfigureTripWaypointsPanel", () => ({
			ConfigureTripWaypointsPanel: () => <div data-testid="configure-waypoints-panel" />,
		}));
		const { CreateTripPage } = await import("./CreateTripPage");

		render(<CreateTripPage />);

		expect(screen.getByRole("heading", { name: "Lịch trình chuyến đi" })).toBeVisible();
		expect(screen.getByTestId("configure-waypoints-panel")).toBeVisible();
	});

	it("renders edit form for an existing draft Trip", async () => {
		vi.resetModules();
		vi.doMock("../hooks/useCreateTrip", () => ({ useCreateTrip: () => creation }));
		vi.doMock("../hooks/useUpdateTripDraft", () => ({
			useUpdateTripDraft: () => updateDraft,
		}));
		vi.doMock("../hooks/useTripDetail", () => ({
			useTripDetail: () => ({
				...tripDetail,
				trip: {
					id: "trip-1",
					routeId: "active",
					title: "Draft trip",
					status: "draft",
				},
			}),
		}));
		vi.doMock("../schema/create-trip.schema", () => ({
			toCreateTripFormValues: vi.fn(() => ({ title: "Draft trip" })),
		}));
		vi.doMock("../../trekking-routes/hooks/useTrekkingRoutes", () => ({
			useTrekkingRoutes: () => routes,
		}));
		vi.doMock("../components/CreateTripForm", () => ({
			CreateTripForm: ({ submitLabel }: { submitLabel: string }) => (
				<div data-testid="trip-form">{submitLabel}</div>
			),
		}));
		vi.doMock("../components/ConfigureTripWaypointsPanel", () => ({
			ConfigureTripWaypointsPanel: () => <div data-testid="configure-waypoints-panel" />,
		}));
		const { CreateTripPage } = await import("./CreateTripPage");

		render(<CreateTripPage editTripId="trip-1" />);

		expect(screen.getByText("Thông tin chuyến đi")).toBeVisible();
		expect(screen.getByTestId("trip-form")).toHaveTextContent("Bước tiếp theo");
	});
});
