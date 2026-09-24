import { afterEach, describe, expect, it, vi } from "vitest";
import type { Trip } from "../types";

const trip: Trip = {
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

interface SetupOptions {
	list?: Trip[];
	listError?: Error;
	listErrorOnce?: Error;
	deferredList?: Promise<Trip[]>;
	reviewResult?: Trip | null;
	reviewError?: Error;
}

async function setup(options: SetupOptions = {}) {
	vi.resetModules();
	const listPendingReview = vi.fn();
	if (options.deferredList) {
		listPendingReview.mockReturnValue(options.deferredList);
	} else if (options.listErrorOnce) {
		listPendingReview
			.mockRejectedValueOnce(options.listErrorOnce)
			.mockResolvedValue(options.list ?? [trip]);
	} else if (options.listError) {
		listPendingReview.mockRejectedValue(options.listError);
	} else {
		listPendingReview.mockResolvedValue(options.list ?? [trip]);
	}
	const review = options.reviewError
		? vi.fn().mockRejectedValue(options.reviewError)
		: vi.fn().mockResolvedValue(options.reviewResult ?? { ...trip, status: "published" });
	vi.doMock("../services/trips.service", () => ({
		tripsService: { listPendingReview, review },
	}));
	const { act, render, screen, waitFor, within } = await import("@testing-library/react");
	const userEvent = (await import("@testing-library/user-event")).default;
	const { AdminTripsPage } = await import("./AdminTripsPage");
	render(<AdminTripsPage />);
	return { act, screen, waitFor, within, user: userEvent.setup(), listPendingReview, review };
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.doUnmock("../services/trips.service");
});

describe("AdminTripsPage", () => {
	it("renders the pending-review loading state", async () => {
		let resolveList!: (items: Trip[]) => void;
		const deferredList = new Promise<Trip[]>((resolve) => {
			resolveList = resolve;
		});
		const test = await setup({ deferredList });

		expect(test.screen.getByTestId("trip-reviews-loading")).toBeInTheDocument();
		await test.act(async () => resolveList([trip]));
		expect((await test.screen.findAllByText("Langbiang sunrise trek")).length).toBeGreaterThan(0);
	});

	it("renders pending Trip schedule, capacity, status, and waypoints", async () => {
		const { screen } = await setup();
		expect((await screen.findAllByText("Langbiang sunrise trek")).length).toBeGreaterThan(0);
		expect(screen.getAllByText("Chờ duyệt").length).toBeGreaterThan(0);
		expect(screen.getByText("1. Trailhead")).toBeInTheDocument();
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
		expect(test.listPendingReview).toHaveBeenCalledTimes(2);
	});

	it("approves once and reloads authoritative pending data", async () => {
		const test = await setup();
		test.listPendingReview.mockResolvedValueOnce([]);
		await test.user.click(await test.screen.findByRole("button", { name: "Ra quyết định" }));
		const confirm = test.screen.getByRole("button", { name: "Xác nhận quyết định" });
		await test.user.dblClick(confirm);
		await test.waitFor(() => expect(test.review).toHaveBeenCalledTimes(1));
		expect(test.review).toHaveBeenCalledWith("trip-1", { action: "approve", reason: undefined });
		expect(await test.screen.findByText(/Đã phê duyệt và xuất bản/)).toBeInTheDocument();
		expect(test.listPendingReview).toHaveBeenCalledTimes(2);
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
});
