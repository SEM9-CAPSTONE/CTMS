import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type TestingLibrary = typeof import("@testing-library/react");
type AdminTripReviewsModule = typeof import("./useAdminTripReviews");
type HttpErrorConstructor = typeof import("../../../core/api").HttpError;

let testingLibrary: TestingLibrary;
let adminTripReviewsModule: AdminTripReviewsModule;
let HttpError: HttpErrorConstructor;
let listPendingReviewMock: ReturnType<typeof vi.fn>;
let reviewMock: ReturnType<typeof vi.fn>;

describe("useAdminTripReviews", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		listPendingReviewMock = vi.fn();
		reviewMock = vi.fn();
		vi.doMock("../services/trips.service", () => ({
			tripsService: {
				listPendingReview: listPendingReviewMock,
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
		listPendingReviewMock.mockResolvedValue([{ id: "trip-1", status: "pending_approval" }]);
		const { result } = testingLibrary.renderHook(() =>
			adminTripReviewsModule.useAdminTripReviews()
		);

		await testingLibrary.waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.items).toEqual([{ id: "trip-1", status: "pending_approval" }]);
		expect(listPendingReviewMock).toHaveBeenCalledTimes(1);
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
			firstRequest = result.current.submit("trip-1", { action: "approve" });
		});

		expect(result.current.isSubmitting).toBe(true);
		expect(
			await result.current.submit("trip-1", { action: "decline", reason: "Duplicate request" })
		).toBeNull();
		resolveReview({ status: "published" });
		await testingLibrary.act(async () => firstRequest);

		expect(reviewMock).toHaveBeenCalledTimes(1);
		expect(result.current.isSubmitting).toBe(false);
	});
});
