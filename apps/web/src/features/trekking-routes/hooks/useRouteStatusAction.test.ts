import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type TestingLibrary = typeof import("@testing-library/react");
type RouteStatusActionModule = typeof import("./useRouteStatusAction");
type HttpErrorConstructor = typeof import("../../../core/api").HttpError;

let testingLibrary: TestingLibrary;
let routeStatusActionModule: RouteStatusActionModule;
let HttpError: HttpErrorConstructor;
let closeMock: ReturnType<typeof vi.fn>;
let reopenMock: ReturnType<typeof vi.fn>;

describe("useRouteStatusAction", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		closeMock = vi.fn();
		reopenMock = vi.fn();
		vi.doMock("../services/trekking-routes.service", () => ({
			trekkingRoutesService: { close: closeMock, reopen: reopenMock },
		}));

		[testingLibrary, routeStatusActionModule, { HttpError }] = await Promise.all([
			import("@testing-library/react"),
			import("./useRouteStatusAction"),
			import("../../../core/api"),
		]);
	});

	afterEach(() => {
		testingLibrary.cleanup();
		vi.doUnmock("../services/trekking-routes.service");
		vi.resetModules();
	});

	it("routes close and reopen through their dedicated service actions", async () => {
		closeMock.mockResolvedValue({ status: "closed" });
		reopenMock.mockResolvedValue({
			status: "pending_approval",
		});
		const { result } = testingLibrary.renderHook(() =>
			routeStatusActionModule.useRouteStatusAction()
		);

		await testingLibrary.act(async () => {
			await result.current.submit("close", "route-id", { reason: "Close reason" });
		});
		await testingLibrary.act(async () => {
			await result.current.submit("reopen", "route-id", { reason: "Reopen reason" });
		});

		expect(closeMock).toHaveBeenCalledWith("route-id", {
			reason: "Close reason",
		});
		expect(reopenMock).toHaveBeenCalledWith("route-id", {
			reason: "Reopen reason",
		});
	});

	it("prevents duplicate submissions while a request is in flight", async () => {
		let resolve!: (value: { status: string }) => void;
		closeMock.mockImplementation(
			() =>
				new Promise((done) => {
					resolve = done;
				})
		);
		const { result } = testingLibrary.renderHook(() =>
			routeStatusActionModule.useRouteStatusAction()
		);
		let first!: Promise<unknown>;
		testingLibrary.act(() => {
			first = result.current.submit("close", "route-id", { reason: "Reason" });
		});
		expect(result.current.isSubmitting).toBe(true);
		expect(await result.current.submit("close", "route-id", { reason: "Duplicate" })).toBeNull();
		resolve({ status: "closed" });
		await testingLibrary.act(async () => first);

		expect(closeMock).toHaveBeenCalledTimes(1);
		expect(result.current.isSubmitting).toBe(false);
	});

	it.each([403, 404, 409, 422])("maps API status %s", (status) => {
		expect(
			routeStatusActionModule.mapRouteStatusActionError(new HttpError("failure", status, {}))
		).toEqual(expect.objectContaining({ status }));
	});

	it("reloads authoritative Route data after a lifecycle conflict", async () => {
		const reload = vi.fn().mockResolvedValue(undefined);
		closeMock.mockRejectedValue(new HttpError("conflict", 409, {}));
		const { result } = testingLibrary.renderHook(() =>
			routeStatusActionModule.useRouteStatusAction(reload)
		);

		await testingLibrary.act(async () => {
			await result.current.submit("close", "route-id", { reason: "Heavy rain" });
		});

		expect(reload).toHaveBeenCalledTimes(1);
		expect(result.current.error).toEqual(expect.objectContaining({ status: 409 }));
	});

	it("surfaces structured 422 validation details from the backend", () => {
		const error = new HttpError("invalid", 422, {
			message: [
				{ field: "reason", errors: ["reason must be shorter than or equal to 255 characters"] },
			],
		});

		expect(routeStatusActionModule.mapRouteStatusActionError(error)).toEqual({
			status: 422,
			message: "reason must be shorter than or equal to 255 characters",
		});
	});

	it("prefers a backend conflict reason", () => {
		expect(
			routeStatusActionModule.mapRouteStatusActionError(
				new HttpError("failure", 409, {
					message: "Trekking route status transition is not allowed",
				})
			).message
		).toBe("Trekking route status transition is not allowed");
	});
});
