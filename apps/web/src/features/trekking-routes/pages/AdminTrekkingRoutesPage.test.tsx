import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminTrekkingRouteReview, PaginatedAdminRouteReviews } from "../types";

const route: AdminTrekkingRouteReview = {
	id: "route-1",
	name: "Pine Ridge",
	description: "Review route",
	geometry: {
		type: "LineString",
		coordinates: [
			[108.4, 11.9],
			[108.5, 12],
		],
	},
	lengthMeters: 1450,
	difficulty: "hard",
	expectedDurationMinutes: 120,
	status: "pending_approval",
	createdAt: "2026-08-28T00:00:00.000Z",
	updatedAt: "2026-08-28T00:00:00.000Z",
	checkpoints: [
		{
			id: "checkpoint-1",
			routeId: "route-1",
			name: "Trail start",
			location: { type: "Point", coordinates: [108.4, 11.9] },
			radiusMeters: 25,
			type: "start",
			expectedArrivalOffset: 0,
			instructions: "Meet the guide",
			nearbyWaterOrShelter: true,
			routePosition: 0,
			createdAt: "2026-08-28T00:00:00.000Z",
			updatedAt: "2026-08-28T00:00:00.000Z",
		},
	],
	dangerZones: [],
	reviewOutcome: "pending",
	reviewedAt: null,
};

function paginated(
	items: AdminTrekkingRouteReview[],
	page = 1,
	totalPages = items.length > 0 ? 1 : 0
): PaginatedAdminRouteReviews {
	return {
		items,
		pagination: { page, limit: 20, total: totalPages > 1 ? 21 : items.length, totalPages },
	};
}

interface SetupOptions {
	list?: AdminTrekkingRouteReview[];
	totalPages?: number;
	listError?: Error;
	listErrorOnce?: Error;
	deferredList?: Promise<PaginatedAdminRouteReviews>;
	reviewResult?: AdminTrekkingRouteReview | null;
	reviewError?: Error;
	deferredReview?: Promise<AdminTrekkingRouteReview>;
}

async function setup(options: SetupOptions = {}) {
	vi.resetModules();
	const listAdminReviews = vi.fn();
	if (options.deferredList) {
		listAdminReviews.mockReturnValue(options.deferredList);
	} else if (options.listErrorOnce) {
		listAdminReviews
			.mockRejectedValueOnce(options.listErrorOnce)
			.mockResolvedValue(paginated(options.list ?? [route], 1, options.totalPages));
	} else if (options.listError) {
		listAdminReviews.mockRejectedValue(options.listError);
	} else {
		listAdminReviews.mockResolvedValue(paginated(options.list ?? [route], 1, options.totalPages));
	}
	const review = options.deferredReview
		? vi.fn().mockReturnValue(options.deferredReview)
		: options.reviewError
			? vi.fn().mockRejectedValue(options.reviewError)
			: vi.fn().mockResolvedValue(options.reviewResult ?? { ...route, status: "active" });
	vi.doMock("../services/trekking-routes.service", () => ({
		trekkingRoutesService: { listAdminReviews, review },
	}));
	vi.doMock("../components/RouteGeometryPreview", () => ({
		RouteGeometryPreview: ({ geometry }: { geometry: { coordinates: unknown[] } }) => (
			<div data-testid="route-geometry-preview">{geometry.coordinates.length} vertices</div>
		),
	}));
	const { act, fireEvent, render, screen, waitFor, within } = await import(
		"@testing-library/react"
	);
	const userEvent = (await import("@testing-library/user-event")).default;
	const { AdminTrekkingRoutesPage } = await import("./AdminTrekkingRoutesPage");
	const { ToastProvider } = await import("../../../shared/components");
	render(
		<ToastProvider>
			<AdminTrekkingRoutesPage />
		</ToastProvider>
	);
	return {
		act,
		fireEvent,
		screen,
		waitFor,
		within,
		user: userEvent.setup(),
		listAdminReviews,
		review,
	};
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.doUnmock("../services/trekking-routes.service");
	vi.doUnmock("../components/RouteGeometryPreview");
});

describe("AdminTrekkingRoutesPage", () => {
	it("renders the pending-review loading state", async () => {
		let resolveList!: (items: PaginatedAdminRouteReviews) => void;
		const deferredList = new Promise<PaginatedAdminRouteReviews>((resolve) => {
			resolveList = resolve;
		});
		const test = await setup({ deferredList });

		expect(test.screen.getByTestId("route-reviews-loading")).toBeInTheDocument();
		await test.act(async () => resolveList(paginated([route])));
		expect((await test.screen.findAllByText("Pine Ridge")).length).toBeGreaterThan(0);
	});

	it("reviews route geometry, difficulty and status without a checkpoint step", async () => {
		const { screen } = await setup();
		expect((await screen.findAllByText("Pine Ridge")).length).toBeGreaterThan(0);
		expect(screen.getAllByText("hard").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Chờ duyệt").length).toBeGreaterThan(0);
		expect(screen.getByTestId("route-geometry-preview")).toHaveTextContent("2 vertices");
		expect(screen.queryByText("Trail start")).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Chờ duyệt" })).toHaveAttribute(
			"aria-pressed",
			"true"
		);
		expect(screen.getByRole("button", { name: "Đã phê duyệt" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Trả về chỉnh sửa" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Tất cả" })).toBeInTheDocument();
	});

	it("renders the empty and error states", async () => {
		const empty = await setup({ list: [] });
		expect(await empty.screen.findByTestId("route-reviews-empty")).toBeInTheDocument();

		const failed = await setup({ listError: new Error("offline") });
		expect(await failed.screen.findByRole("alert")).toHaveTextContent("Không thể kết nối");
	});

	it("retries a list error and recovers authoritative pending data", async () => {
		const test = await setup({ listErrorOnce: new Error("offline") });
		const alert = await test.screen.findByRole("alert");

		await test.user.click(test.within(alert).getByRole("button"));

		expect((await test.screen.findAllByText("Pine Ridge")).length).toBeGreaterThan(0);
		expect(test.listAdminReviews).toHaveBeenCalledTimes(2);
	});

	it("approves once and reloads authoritative pending data", async () => {
		const test = await setup();
		test.listAdminReviews.mockResolvedValueOnce(paginated([]));
		await test.user.click(await test.screen.findByRole("button", { name: "Ra quyết định" }));
		const confirm = test.screen.getByRole("button", { name: "Xác nhận quyết định" });
		await test.user.dblClick(confirm);
		await test.waitFor(() => expect(test.review).toHaveBeenCalledTimes(1));
		expect(test.review).toHaveBeenCalledWith("route-1", { action: "approve", reason: undefined });
		expect(await test.screen.findByText(/Đã phê duyệt và kích hoạt/)).toBeInTheDocument();
		expect(test.listAdminReviews).toHaveBeenCalledTimes(2);
	});

	it("requires a decline reason and accepts the 255-character boundary", async () => {
		const test = await setup({ reviewResult: { ...route, status: "draft" } });
		await test.user.click(await test.screen.findByRole("button", { name: "Ra quyết định" }));
		await test.user.click(test.screen.getByRole("button", { name: "Từ chối và trả về bản nháp" }));
		await test.user.click(test.screen.getByRole("button", { name: "Xác nhận quyết định" }));
		expect(
			await test.screen.findByText("Lý do là bắt buộc cho quyết định này.")
		).toBeInTheDocument();
		expect(test.review).not.toHaveBeenCalled();

		test.fireEvent.change(test.screen.getByLabelText("Lý do *"), {
			target: { value: "x".repeat(255) },
		});
		await test.user.click(test.screen.getByRole("button", { name: "Xác nhận quyết định" }));
		await test.waitFor(() =>
			expect(test.review).toHaveBeenCalledWith("route-1", {
				action: "decline",
				reason: "x".repeat(255),
			})
		);
	});

	it("preserves the reason when a stale decision fails", async () => {
		const test = await setup({ reviewError: new Error("stale") });
		await test.user.click(await test.screen.findByRole("button", { name: "Ra quyết định" }));
		await test.user.click(test.screen.getByRole("button", { name: "Từ chối và trả về bản nháp" }));
		const reason = test.screen.getByLabelText("Lý do *");
		await test.user.type(reason, "Keep this reason");
		await test.user.click(test.screen.getByRole("button", { name: "Xác nhận quyết định" }));
		expect(await test.screen.findByRole("alert")).toHaveTextContent("Không thể kết nối");
		expect(reason).toHaveValue("Keep this reason");
	});

	it("keeps operational closure out of the approval workflow", async () => {
		const test = await setup();
		await test.user.click(await test.screen.findByRole("button", { name: "Ra quyết định" }));

		expect(test.screen.getByRole("button", { name: "Phê duyệt" })).toBeInTheDocument();
		expect(
			test.screen.getByRole("button", { name: "Từ chối và trả về bản nháp" })
		).toBeInTheDocument();
		expect(
			test.screen.queryByRole("button", { name: "Không được vận hành" })
		).not.toBeInTheDocument();
	});

	it("maps filters to the API and resets pagination to page one", async () => {
		const test = await setup({ totalPages: 2 });
		await test.screen.findAllByText("Pine Ridge");

		await test.user.click(test.screen.getByRole("button", { name: "Tiếp theo" }));
		await test.waitFor(() =>
			expect(test.listAdminReviews).toHaveBeenCalledWith({
				reviewOutcome: "pending",
				page: 2,
				limit: 20,
			})
		);

		await test.user.click(test.screen.getByRole("button", { name: "Đã phê duyệt" }));
		await test.waitFor(() =>
			expect(test.listAdminReviews).toHaveBeenCalledWith({
				reviewOutcome: "approved",
				page: 1,
				limit: 20,
			})
		);
	});

	it("renders historical approved Routes as read-only with their current status", async () => {
		const approvedRoute: AdminTrekkingRouteReview = {
			...route,
			status: "closed",
			reviewOutcome: "approved",
			reviewedAt: "2026-08-29T00:00:00.000Z",
		};
		const test = await setup({ list: [approvedRoute] });

		await test.screen.findAllByText("Pine Ridge");
		expect(test.screen.getByText("Chỉ xem")).toBeInTheDocument();
		expect(test.screen.queryByRole("button", { name: "Ra quyết định" })).not.toBeInTheDocument();
		expect(test.screen.getAllByText("Đã phê duyệt").length).toBeGreaterThan(0);
		expect(test.screen.getAllByText("Đã đóng").length).toBeGreaterThan(0);
	});
});
