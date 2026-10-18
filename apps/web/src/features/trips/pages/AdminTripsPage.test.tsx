import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminTripReview, PaginatedAdminTripReviews } from "../types";

const trip: AdminTripReview = {
	id: "trip-1",
	hostId: "host-1",
	routeId: "route-1",
	title: "Langbiang sunrise trek",
	description: "A guided overnight trek",
	coverImageUrl: null,
	itinerary: null,
	includes: null,
	excludes: null,
	tripType: "overnight",
	durationNights: 1,
	startsAt: "2026-10-01T12:00:00.000Z",
	endsAt: "2026-10-02T10:00:00.000Z",
	meetingPoint: { type: "Point", coordinates: [108.44, 11.94] },
	meetingAt: "2026-10-01T11:30:00.000Z",
	bookingDeadline: "2026-09-30T12:00:00.000Z",
	capacityMin: 2,
	capacityMax: 12,
	seatsTaken: 0,
	pricePerPerson: 500000,
	cancellationPolicy: null,
	status: "pending_approval",
	createdAt: "2026-09-15T00:00:00.000Z",
	updatedAt: "2026-09-15T00:00:00.000Z",
	reviewOutcome: "pending",
	reviewedAt: null,
	waypoints: [
		{
			id: "waypoint-1",
			tripId: "trip-1",
			checkpointId: null,
			type: "start",
			name: "Trailhead",
			location: { type: "Point", coordinates: [108.44, 11.94] },
			dayNumber: 1,
			sequenceOrder: 1,
			plannedAt: null,
			durationMinutes: null,
			metadata: null,
		},
	],
};

function paginated(
	items: AdminTripReview[],
	page = 1,
	totalPages = items.length > 0 ? 1 : 0
): PaginatedAdminTripReviews {
	return {
		items,
		pagination: { page, limit: 20, total: totalPages > 1 ? 21 : items.length, totalPages },
	};
}

interface SetupOptions {
	list?: AdminTripReview[];
	totalPages?: number;
	listError?: Error;
	listErrorOnce?: Error;
	deferredList?: Promise<PaginatedAdminTripReviews>;
	reviewResult?: AdminTripReview | null;
	reviewError?: Error;
}

async function setup(options: SetupOptions = {}) {
	vi.resetModules();
	const listAdminReviews = vi.fn();
	if (options.deferredList) {
		listAdminReviews.mockReturnValue(options.deferredList);
	} else if (options.listErrorOnce) {
		listAdminReviews
			.mockRejectedValueOnce(options.listErrorOnce)
			.mockResolvedValue(paginated(options.list ?? [trip], 1, options.totalPages));
	} else if (options.listError) {
		listAdminReviews.mockRejectedValue(options.listError);
	} else {
		listAdminReviews.mockResolvedValue(paginated(options.list ?? [trip], 1, options.totalPages));
	}
	const review = options.reviewError
		? vi.fn().mockRejectedValue(options.reviewError)
		: vi.fn().mockResolvedValue(options.reviewResult ?? { ...trip, status: "published" });
	vi.doMock("../services/trips.service", () => ({
		tripsService: { listAdminReviews, review },
	}));
	const { act, render, screen, waitFor, within } = await import("@testing-library/react");
	const userEvent = (await import("@testing-library/user-event")).default;
	const { AdminTripsPage } = await import("./AdminTripsPage");
	const { ToastProvider } = await import("../../../shared/components");
	render(
		<ToastProvider>
			<AdminTripsPage />
		</ToastProvider>
	);
	return { act, screen, waitFor, within, user: userEvent.setup(), listAdminReviews, review };
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.doUnmock("../services/trips.service");
});

describe("AdminTripsPage", () => {
	it("renders the pending-review loading state", async () => {
		let resolveList!: (items: PaginatedAdminTripReviews) => void;
		const deferredList = new Promise<PaginatedAdminTripReviews>((resolve) => {
			resolveList = resolve;
		});
		const test = await setup({ deferredList });

		expect(test.screen.getByTestId("trip-reviews-loading")).toBeInTheDocument();
		await test.act(async () => resolveList(paginated([trip])));
		expect((await test.screen.findAllByText("Langbiang sunrise trek")).length).toBeGreaterThan(0);
	});

	it("renders pending Trip schedule, capacity, status, and waypoints", async () => {
		const { screen } = await setup();
		expect((await screen.findAllByText("Langbiang sunrise trek")).length).toBeGreaterThan(0);
		expect(screen.getAllByText("Chờ duyệt").length).toBeGreaterThan(0);
		expect(screen.getByText("1. Trailhead")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Chờ duyệt" })).toHaveAttribute(
			"aria-pressed",
			"true"
		);
		expect(screen.getByRole("button", { name: "Đã phê duyệt" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Trả về chỉnh sửa" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Tự động từ chối" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Tất cả" })).toBeInTheDocument();
	});

	it("renders the empty and error states", async () => {
		const empty = await setup({ list: [] });
		expect(await empty.screen.findByTestId("trip-reviews-empty")).toBeInTheDocument();

		const failed = await setup({ listError: new Error("offline") });
		expect(await failed.screen.findByRole("alert")).toHaveTextContent("Không thể kết nối");
	});

	it("retries a list error and recovers authoritative pending data", async () => {
		const test = await setup({ listErrorOnce: new Error("offline") });
		const alert = await test.screen.findByRole("alert");

		await test.user.click(test.within(alert).getByRole("button"));

		expect((await test.screen.findAllByText("Langbiang sunrise trek")).length).toBeGreaterThan(0);
		expect(test.listAdminReviews).toHaveBeenCalledTimes(2);
	});

	it("approves once and reloads authoritative pending data", async () => {
		const test = await setup();
		test.listAdminReviews.mockResolvedValueOnce(paginated([]));
		await test.user.click(await test.screen.findByRole("button", { name: "Ra quyết định" }));
		const confirm = test.screen.getByRole("button", { name: "Xác nhận quyết định" });
		await test.user.dblClick(confirm);
		await test.waitFor(() => expect(test.review).toHaveBeenCalledTimes(1));
		expect(test.review).toHaveBeenCalledWith("trip-1", {
			action: "approve",
			reviewedUpdatedAt: trip.updatedAt,
			reason: undefined,
		});
		expect(await test.screen.findByText(/Đã phê duyệt và xuất bản/)).toBeInTheDocument();
		expect(test.listAdminReviews).toHaveBeenCalledTimes(2);
	});

	it("requires a decline reason and accepts the 255-character boundary", async () => {
		const test = await setup({ reviewResult: { ...trip, status: "draft" } });
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
			expect(test.review).toHaveBeenCalledWith("trip-1", {
				action: "decline",
				reviewedUpdatedAt: trip.updatedAt,
				reason: "x".repeat(255),
			})
		);
	}, 15000);

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

	it("maps filters to the API and resets pagination to page one", async () => {
		const test = await setup({ totalPages: 2 });
		await test.screen.findAllByText("Langbiang sunrise trek");

		await test.user.click(test.screen.getByRole("button", { name: "Tiếp theo" }));
		await test.waitFor(() =>
			expect(test.listAdminReviews).toHaveBeenCalledWith({
				reviewOutcome: "pending",
				page: 2,
				limit: 20,
			})
		);

		await test.user.click(test.screen.getByRole("button", { name: "Tự động từ chối" }));
		await test.waitFor(() =>
			expect(test.listAdminReviews).toHaveBeenCalledWith({
				reviewOutcome: "auto_rejected",
				page: 1,
				limit: 20,
			})
		);
	});

	it("renders historical approved Trips as read-only with their current status", async () => {
		const approvedTrip: AdminTripReview = {
			...trip,
			status: "completed",
			reviewOutcome: "approved",
			reviewedAt: "2026-09-16T00:00:00.000Z",
		};
		const test = await setup({ list: [approvedTrip] });

		await test.screen.findAllByText("Langbiang sunrise trek");
		expect(test.screen.getByText("Chỉ xem")).toBeInTheDocument();
		expect(test.screen.queryByRole("button", { name: "Ra quyết định" })).not.toBeInTheDocument();
		expect(test.screen.getAllByText("Đã phê duyệt").length).toBeGreaterThan(0);
		expect(test.screen.getAllByText("Kết thúc").length).toBeGreaterThan(0);
	});
});
