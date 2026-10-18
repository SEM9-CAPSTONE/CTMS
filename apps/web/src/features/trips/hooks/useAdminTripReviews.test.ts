import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type TestingLibrary = typeof import("@testing-library/react");
type AdminTripReviewsModule = typeof import("./useAdminTripReviews");
type HttpErrorConstructor = typeof import("../../../core/api").HttpError;

let testingLibrary: TestingLibrary;
let adminTripReviewsModule: AdminTripReviewsModule;
let HttpError: HttpErrorConstructor;
let listAdminReviewsMock: ReturnType<typeof vi.fn>;
let reviewMock: ReturnType<typeof vi.fn>;

describe("useAdminTripReviews", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		listAdminReviewsMock = vi.fn();
		reviewMock = vi.fn();
		vi.doMock("../services/trips.service", () => ({
			tripsService: {
				listAdminReviews: listAdminReviewsMock,
				review: reviewMock,
			},
		}));

		[testingLibrary, adminTripReviewsModule, { HttpError }] = await Promise.all([
			import("@testing-library/react"),
			import("./useAdminTripReviews"),
			import("../../../core/api"),
		]);
	});

	afterEach(() => {
		testingLibrary.cleanup();
		vi.doUnmock("../services/trips.service");
	});

	it.each([
		[401, "đăng nhập"],
		[403, "Admin"],
		[404, "Không tìm thấy"],
		[409, "Admin khác"],
		[422, "điều kiện phê duyệt"],
	] as const)("maps API status %s", (status, expectedMessage) => {
		expect(
			adminTripReviewsModule.mapTripReviewError(new HttpError("failure", status, {}))
		).toContain(expectedMessage);
	});

	it("surfaces structured backend validation details", () => {
		const error = new HttpError("invalid", 422, {
			message: [{ field: "routeId", errors: ["the Trip's Route is no longer active"] }],
		});

		expect(adminTripReviewsModule.mapTripReviewError(error)).toBe(
			"the Trip's Route is no longer active"
		);
	});

	it("loads pending Trips on mount", async () => {
		listAdminReviewsMock.mockResolvedValue({
			items: [{ id: "trip-1", status: "pending_approval" }],
			pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
		});
		const { result } = testingLibrary.renderHook(() =>
			adminTripReviewsModule.useAdminTripReviews()
		);

		await testingLibrary.waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.items).toEqual([{ id: "trip-1", status: "pending_approval" }]);
		expect(listAdminReviewsMock).toHaveBeenCalledWith({
			reviewOutcome: "pending",
			page: 1,
			limit: 20,
		});
	});

	it("keeps the latest filter response when an older request finishes later", async () => {
		let resolvePending!: (value: unknown) => void;
		let resolveAutoRejected!: (value: unknown) => void;
		const pendingRequest = new Promise((resolve) => {
			resolvePending = resolve;
		});
		const autoRejectedRequest = new Promise((resolve) => {
			resolveAutoRejected = resolve;
		});
		listAdminReviewsMock
			.mockReturnValueOnce(pendingRequest)
			.mockReturnValueOnce(autoRejectedRequest);

		const { result, rerender } = testingLibrary.renderHook(
			({ outcome }) => adminTripReviewsModule.useAdminTripReviews(outcome),
			{ initialProps: { outcome: "pending" as "pending" | "auto_rejected" } }
		);

		rerender({ outcome: "auto_rejected" });
		await testingLibrary.act(async () => {
			resolveAutoRejected({
				items: [{ id: "rejected-trip", reviewOutcome: "auto_rejected" }],
				pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
			});
		});
		await testingLibrary.waitFor(() => expect(result.current.isLoading).toBe(false));

		await testingLibrary.act(async () => {
			resolvePending({
				items: [{ id: "pending-trip", reviewOutcome: "pending" }],
				pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
			});
		});

		expect(result.current.items).toEqual([{ id: "rejected-trip", reviewOutcome: "auto_rejected" }]);
		expect(listAdminReviewsMock).toHaveBeenNthCalledWith(2, {
			reviewOutcome: "auto_rejected",
			page: 1,
			limit: 20,
		});
	});

	it("rejects a duplicate review mutation while the first request is in flight", async () => {
		let resolveReview!: (value: { status: string }) => void;
		reviewMock.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveReview = resolve;
				})
		);
		const { result } = testingLibrary.renderHook(() => adminTripReviewsModule.useReviewTrip());
		let firstRequest!: Promise<unknown>;

		testingLibrary.act(() => {
			firstRequest = result.current.submit("trip-1", {
				action: "approve",
				reviewedUpdatedAt: "2026-09-15T00:00:00.000Z",
			});
		});

		expect(result.current.isSubmitting).toBe(true);
		expect(
			await result.current.submit("trip-1", {
				action: "decline",
				reviewedUpdatedAt: "2026-09-15T00:00:00.000Z",
				reason: "Duplicate request",
			})
		).toBeNull();
		resolveReview({ status: "published" });
		await testingLibrary.act(async () => firstRequest);

		expect(reviewMock).toHaveBeenCalledTimes(1);
		expect(result.current.isSubmitting).toBe(false);
	});
});
