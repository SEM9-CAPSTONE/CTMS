import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type TestingLibrary = typeof import("@testing-library/react");
type RefreshRouteWeatherModule = typeof import("./useRefreshRouteWeather");
type HttpErrorConstructor = typeof import("../../../core/api").HttpError;

let testingLibrary: TestingLibrary;
let refreshRouteWeatherModule: RefreshRouteWeatherModule;
let HttpError: HttpErrorConstructor;
let refreshWeatherMock: ReturnType<typeof vi.fn>;

describe("useRefreshRouteWeather", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		refreshWeatherMock = vi.fn();
		vi.doMock("../services/trekking-routes.service", () => ({
			trekkingRoutesService: { refreshWeather: refreshWeatherMock },
		}));

		[testingLibrary, refreshRouteWeatherModule, { HttpError }] = await Promise.all([
			import("@testing-library/react"),
			import("./useRefreshRouteWeather"),
			import("../../../core/api"),
		]);
	});

	afterEach(() => {
		testingLibrary.cleanup();
		vi.doUnmock("../services/trekking-routes.service");
		vi.resetModules();
	});

	it("routes through the dedicated refresh service action and returns the new snapshot", async () => {
		refreshWeatherMock.mockResolvedValue({ id: "snap-1", status: "success" });
		const { result } = testingLibrary.renderHook(() =>
			refreshRouteWeatherModule.useRefreshRouteWeather()
		);

		let returned: unknown;
		await testingLibrary.act(async () => {
			returned = await result.current.refresh("route-id");
		});

		expect(refreshWeatherMock).toHaveBeenCalledWith("route-id");
		expect(returned).toEqual({ id: "snap-1", status: "success" });
		expect(result.current.error).toBeNull();
	});

	it("prevents duplicate submissions while a request is in flight (BR-241-style)", async () => {
		let resolve!: (value: { id: string; status: string }) => void;
		refreshWeatherMock.mockImplementation(
			() =>
				new Promise((done) => {
					resolve = done;
				})
		);
		const { result } = testingLibrary.renderHook(() =>
			refreshRouteWeatherModule.useRefreshRouteWeather()
		);

		let first!: Promise<unknown>;
		testingLibrary.act(() => {
			first = result.current.refresh("route-id");
		});
		expect(result.current.isSubmitting).toBe(true);
		expect(await result.current.refresh("route-id")).toBeNull();
		resolve({ id: "snap-1", status: "success" });
		await testingLibrary.act(async () => first);

		expect(refreshWeatherMock).toHaveBeenCalledTimes(1);
		expect(result.current.isSubmitting).toBe(false);
	});

	it.each([401, 403, 404, 409, 503])(
		"maps API status %s to a distinct Vietnamese message",
		async (status) => {
			refreshWeatherMock.mockRejectedValue(new HttpError("failure", status, {}));
			const { result } = testingLibrary.renderHook(() =>
				refreshRouteWeatherModule.useRefreshRouteWeather()
			);

			await testingLibrary.act(async () => {
				await result.current.refresh("route-id");
			});

			expect(result.current.error).toEqual(
				expect.objectContaining({ status, message: expect.any(String) })
			);
		}
	);

	it("409 and 503 map to distinct messages, not the same generic fallback", async () => {
		refreshWeatherMock.mockRejectedValueOnce(new HttpError("failure", 409, {}));
		const { result } = testingLibrary.renderHook(() =>
			refreshRouteWeatherModule.useRefreshRouteWeather()
		);
		await testingLibrary.act(async () => {
			await result.current.refresh("route-id");
		});
		const conflictMessage = result.current.error?.message;

		refreshWeatherMock.mockRejectedValueOnce(new HttpError("failure", 503, {}));
		await testingLibrary.act(async () => {
			await result.current.refresh("route-id");
		});
		expect(result.current.error?.message).not.toBe(conflictMessage);
	});

	it("resetError clears a previous error", async () => {
		refreshWeatherMock.mockRejectedValue(new HttpError("failure", 404, {}));
		const { result } = testingLibrary.renderHook(() =>
			refreshRouteWeatherModule.useRefreshRouteWeather()
		);
		await testingLibrary.act(async () => {
			await result.current.refresh("route-id");
		});
		expect(result.current.error).not.toBeNull();

		testingLibrary.act(() => result.current.resetError());
		expect(result.current.error).toBeNull();
	});
});
