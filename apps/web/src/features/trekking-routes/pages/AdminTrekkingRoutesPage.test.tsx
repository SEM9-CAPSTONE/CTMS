import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminTrekkingRouteReview } from "../types";

const route: AdminTrekkingRouteReview = {
	id: "route-1",
	campsiteId: "campsite-1",
	campsiteName: "Pine Camp",
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
};

interface SetupOptions {
	list?: AdminTrekkingRouteReview[];
	listError?: Error;
	listErrorOnce?: Error;
	deferredList?: Promise<AdminTrekkingRouteReview[]>;
	reviewResult?: AdminTrekkingRouteReview | null;
	reviewError?: Error;
	deferredReview?: Promise<AdminTrekkingRouteReview>;
}

async function setup(options: SetupOptions = {}) {
	vi.resetModules();
	const listPendingReview = vi.fn();
	if (options.deferredList) {
		listPendingReview.mockReturnValue(options.deferredList);
	} else if (options.listErrorOnce) {
		listPendingReview
			.mockRejectedValueOnce(options.listErrorOnce)
			.mockResolvedValue(options.list ?? [route]);
	} else if (options.listError) {
		listPendingReview.mockRejectedValue(options.listError);
	} else {
		listPendingReview.mockResolvedValue(options.list ?? [route]);
	}
	const review = options.deferredReview
		? vi.fn().mockReturnValue(options.deferredReview)
		: options.reviewError
			? vi.fn().mockRejectedValue(options.reviewError)
			: vi.fn().mockResolvedValue(options.reviewResult ?? { ...route, status: "active" });
	vi.doMock("../services/trekking-routes.service", () => ({
		trekkingRoutesService: { listPendingReview, review },
	}));
	vi.doMock("../components/RouteGeometryPreview", () => ({
		RouteGeometryPreview: ({ geometry }: { geometry: { coordinates: unknown[] } }) => (
			<div data-testid="route-geometry-preview">{geometry.coordinates.length} vertices</div>
		),
	}));
	const { act, render, screen, waitFor, within } = await import("@testing-library/react");
	const userEvent = (await import("@testing-library/user-event")).default;
	const { AdminTrekkingRoutesPage } = await import("./AdminTrekkingRoutesPage");
	render(<AdminTrekkingRoutesPage />);
	return { act, screen, waitFor, within, user: userEvent.setup(), listPendingReview, review };
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.doUnmock("../services/trekking-routes.service");
	vi.doUnmock("../components/RouteGeometryPreview");
});

describe("AdminTrekkingRoutesPage", () => {
	it("renders the pending-review loading state", async () => {
		let resolveList!: (items: AdminTrekkingRouteReview[]) => void;
		const deferredList = new Promise<AdminTrekkingRouteReview[]>((resolve) => {
			resolveList = resolve;
		});
		const test = await setup({ deferredList });

		expect(test.screen.getByTestId("route-reviews-loading")).toBeInTheDocument();
		await test.act(async () => resolveList([route]));
		expect((await test.screen.findAllByText("Pine Ridge")).length).toBeGreaterThan(0);
	});

	it("renders pending Route geometry, difficulty, status, and checkpoints", async () => {
		const { screen } = await setup();
		expect((await screen.findAllByText("Pine Ridge")).length).toBeGreaterThan(0);
		expect(screen.getAllByText("hard").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Chờ duyệt").length).toBeGreaterThan(0);
		expect(screen.getByTestId("route-geometry-preview")).toHaveTextContent("2 vertices");
		expect(screen.getByText("Trail start")).toBeInTheDocument();
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
		expect(test.listPendingReview).toHaveBeenCalledTimes(2);
	});

	it("approves once and reloads authoritative pending data", async () => {
		const test = await setup();
		test.listPendingReview.mockResolvedValueOnce([]);
		await test.user.click(await test.screen.findByRole("button", { name: "Ra quyết định" }));
		const confirm = test.screen.getByRole("button", { name: "Xác nhận quyết định" });
		await test.user.dblClick(confirm);
		await test.waitFor(() => expect(test.review).toHaveBeenCalledTimes(1));
		expect(test.review).toHaveBeenCalledWith("route-1", { action: "approve", reason: undefined });
		expect(await test.screen.findByText(/Đã phê duyệt và kích hoạt/)).toBeInTheDocument();
		expect(test.listPendingReview).toHaveBeenCalledTimes(2);
	});

	it("requires a decline reason and accepts the 255-character boundary", async () => {
		const test = await setup({ reviewResult: { ...route, status: "draft" } });
		await test.user.click(await test.screen.findByRole("button", { name: "Ra quyết định" }));
		await test.user.click(test.screen.getByRole("button", { name: "Trả về bản nháp" }));
		await test.user.click(test.screen.getByRole("button", { name: "Xác nhận quyết định" }));
		expect(
			await test.screen.findByText("Lý do là bắt buộc cho quyết định này.")
		).toBeInTheDocument();
		expect(test.review).not.toHaveBeenCalled();

		await test.user.type(test.screen.getByLabelText("Lý do *"), "x".repeat(255));
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
		await test.user.click(test.screen.getByRole("button", { name: "Trả về bản nháp" }));
		const reason = test.screen.getByLabelText("Lý do *");
		await test.user.type(reason, "Keep this reason");
		await test.user.click(test.screen.getByRole("button", { name: "Xác nhận quyết định" }));
		expect(await test.screen.findByRole("alert")).toHaveTextContent("Không thể kết nối");
		expect(reason).toHaveValue("Keep this reason");
	});

	it("makes non-operable an explicit reasoned action", async () => {
		const test = await setup({ reviewResult: { ...route, status: "closed" } });
		await test.user.click(await test.screen.findByRole("button", { name: "Ra quyết định" }));
		await test.user.click(test.screen.getByRole("button", { name: "Không được vận hành" }));
		await test.user.type(test.screen.getByLabelText("Lý do *"), "Protected area closure");
		await test.user.click(test.screen.getByRole("button", { name: "Xác nhận quyết định" }));
		await test.waitFor(() =>
			expect(test.review).toHaveBeenCalledWith("route-1", {
				action: "non_operable",
				reason: "Protected area closure",
			})
		);
	});
});
