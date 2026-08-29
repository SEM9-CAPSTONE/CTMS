import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WeatherSnapshot } from "../types";

type TestingLibrary = typeof import("@testing-library/react");
type RouteWeatherModule = typeof import("./useRouteWeather");

let testingLibrary: TestingLibrary;
let routeWeatherModule: RouteWeatherModule;
let getLatestWeatherMock: ReturnType<typeof vi.fn>;

const snapshot = { id: "snap-1", routeId: "route-id", status: "success" } as WeatherSnapshot;

describe("useRouteWeather", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		getLatestWeatherMock = vi.fn();
		vi.doMock("../services/trekking-routes.service", () => ({
			trekkingRoutesService: { getLatestWeather: getLatestWeatherMock },
		}));

		[testingLibrary, routeWeatherModule] = await Promise.all([
			import("@testing-library/react"),
			import("./useRouteWeather"),
		]);
	});

	afterEach(() => {
		testingLibrary.cleanup();
		vi.doUnmock("../services/trekking-routes.service");
		vi.resetModules();
	});

	it("fires no request when routeId is undefined, leaving snapshot null", async () => {
		const { result } = testingLibrary.renderHook(() => routeWeatherModule.useRouteWeather());

		await testingLibrary.waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(getLatestWeatherMock).not.toHaveBeenCalled();
		expect(result.current.snapshot).toBeNull();
	});

	it("loads the latest snapshot for a real routeId", async () => {
		getLatestWeatherMock.mockResolvedValue(snapshot);
		const { result } = testingLibrary.renderHook(() =>
			routeWeatherModule.useRouteWeather("route-id")
		);

		await testingLibrary.waitFor(() => expect(result.current.snapshot).toEqual(snapshot));
		expect(getLatestWeatherMock).toHaveBeenCalledWith("route-id");
	});

	it("null (no error) means no snapshot has ever been recorded, not a failure", async () => {
		getLatestWeatherMock.mockResolvedValue(null);
		const { result } = testingLibrary.renderHook(() =>
			routeWeatherModule.useRouteWeather("route-id")
		);

		await testingLibrary.waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.snapshot).toBeNull();
		expect(result.current.error).toBe("");
	});

	it("maps a load failure to a Vietnamese message and keeps snapshot null", async () => {
		getLatestWeatherMock.mockRejectedValue(new Error("network down"));
		const { result } = testingLibrary.renderHook(() =>
			routeWeatherModule.useRouteWeather("route-id")
		);

		await testingLibrary.waitFor(() => expect(result.current.error).not.toBe(""));
		expect(result.current.snapshot).toBeNull();
	});

	it("keeps the displayed snapshot stable until an authoritative reload completes", async () => {
		const nextSnapshot = { ...snapshot, id: "snap-2" };
		let resolveReload!: (value: WeatherSnapshot) => void;
		getLatestWeatherMock.mockResolvedValueOnce(snapshot).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveReload = resolve;
				})
		);
		const { result } = testingLibrary.renderHook(() =>
			routeWeatherModule.useRouteWeather("route-id")
		);
		await testingLibrary.waitFor(() => expect(result.current.snapshot).toEqual(snapshot));

		let reload!: Promise<void>;
		testingLibrary.act(() => {
			reload = result.current.reload();
		});
		expect(result.current.snapshot).toEqual(snapshot);
		resolveReload(nextSnapshot);
		await testingLibrary.act(async () => reload);

		expect(result.current.snapshot).toEqual(nextSnapshot);
	});

	it("exposes setSnapshot so a refresh action's own response can update the display directly", async () => {
		getLatestWeatherMock.mockResolvedValue(null);
		const { result } = testingLibrary.renderHook(() =>
			routeWeatherModule.useRouteWeather("route-id")
		);
		await testingLibrary.waitFor(() => expect(result.current.isLoading).toBe(false));

		testingLibrary.act(() => {
			result.current.setSnapshot(snapshot);
		});
		expect(result.current.snapshot).toEqual(snapshot);
	});
});
