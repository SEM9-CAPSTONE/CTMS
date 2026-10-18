import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type TestingLibrary = typeof import("@testing-library/react");
type AdminRouteReviewsModule = typeof import("./useAdminRouteReviews");
type HttpErrorConstructor = typeof import("../../../core/api").HttpError;

let testingLibrary: TestingLibrary;
let adminRouteReviewsModule: AdminRouteReviewsModule;
let HttpError: HttpErrorConstructor;
let listAdminReviewsMock: ReturnType<typeof vi.fn>;
let reviewMock: ReturnType<typeof vi.fn>;

describe("useAdminRouteReviews", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		listAdminReviewsMock = vi.fn();
		reviewMock = vi.fn();
		vi.doMock("../services/trekking-routes.service", () => ({
			trekkingRoutesService: {
				listAdminReviews: listAdminReviewsMock,
				review: reviewMock,
			},
		}));

		[testingLibrary, adminRouteReviewsModule, { HttpError }] = await Promise.all([
			import("@testing-library/react"),
			import("./useAdminRouteReviews"),
			import("../../../core/api"),
		]);
	});

	afterEach(() => {
		testingLibrary.cleanup();
		vi.doUnmock("../services/trekking-routes.service");
	});

	it.each([
		[401, "đăng nhập"],
		[403, "Admin"],
		[404, "Không tìm thấy"],
		[409, "Admin khác"],
		[422, "điều kiện phê duyệt"],
	] as const)("maps API status %s", (status, expectedMessage) => {
		expect(
			adminRouteReviewsModule.mapRouteReviewError(new HttpError("failure", status, {}))
		).toContain(expectedMessage);
	});

	it("surfaces structured backend validation details", () => {
		const error = new HttpError("invalid", 422, {
			message: [
				{ field: "checkpoints", errors: ["stored route checkpoints are invalid"] },
				{ field: "geometry", errors: ["stored route geometry is invalid"] },
			],
		});

		expect(adminRouteReviewsModule.mapRouteReviewError(error)).toBe(
			"stored route checkpoints are invalid stored route geometry is invalid"
		);
	});

	it("keeps the latest filter response when an older request finishes later", async () => {
		let resolvePending!: (value: unknown) => void;
		let resolveApproved!: (value: unknown) => void;
		const pendingRequest = new Promise((resolve) => {
			resolvePending = resolve;
		});
		const approvedRequest = new Promise((resolve) => {
			resolveApproved = resolve;
		});
		listAdminReviewsMock.mockReturnValueOnce(pendingRequest).mockReturnValueOnce(approvedRequest);

		const { result, rerender } = testingLibrary.renderHook(
			({ outcome }) => adminRouteReviewsModule.useAdminRouteReviews(outcome),
			{ initialProps: { outcome: "pending" as "pending" | "approved" } }
		);

		rerender({ outcome: "approved" });
		await testingLibrary.act(async () => {
			resolveApproved({
				items: [{ id: "approved-route", reviewOutcome: "approved" }],
				pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
			});
		});
		await testingLibrary.waitFor(() => expect(result.current.isLoading).toBe(false));

		await testingLibrary.act(async () => {
			resolvePending({
				items: [{ id: "pending-route", reviewOutcome: "pending" }],
				pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
			});
		});

		expect(result.current.items).toEqual([{ id: "approved-route", reviewOutcome: "approved" }]);
		expect(listAdminReviewsMock).toHaveBeenNthCalledWith(2, {
			reviewOutcome: "approved",
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
		const { result } = testingLibrary.renderHook(() =>
			adminRouteReviewsModule.useReviewTrekkingRoute()
		);
		let firstRequest!: Promise<unknown>;

		testingLibrary.act(() => {
			firstRequest = result.current.submit("route-1", { action: "approve" });
		});

		expect(result.current.isSubmitting).toBe(true);
		expect(
			await result.current.submit("route-1", {
				action: "decline",
				reason: "Duplicate request",
			})
		).toBeNull();
		resolveReview({ status: "active" });
		await testingLibrary.act(async () => firstRequest);

		expect(reviewMock).toHaveBeenCalledTimes(1);
		expect(result.current.isSubmitting).toBe(false);
	});
});
