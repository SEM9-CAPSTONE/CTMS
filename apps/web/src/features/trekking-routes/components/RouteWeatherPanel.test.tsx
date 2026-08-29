import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatedTrekkingRoute, RouteStatus, WeatherSnapshot } from "../types";

type TestingLibrary = typeof import("@testing-library/react");
type UserEvent = typeof import("@testing-library/user-event").default;
type RouteWeatherPanelComponent = typeof import("./RouteWeatherPanel").RouteWeatherPanel;

let testingLibrary: TestingLibrary;
let userEvent: UserEvent;
let RouteWeatherPanel: RouteWeatherPanelComponent;
let getLatestWeatherMock: ReturnType<typeof vi.fn>;
let refreshWeatherMock: ReturnType<typeof vi.fn>;

function route(status: RouteStatus): CreatedTrekkingRoute {
	return {
		id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		campsiteId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
		name: "Ridge route",
		description: null,
		geometry: {
			type: "LineString",
			coordinates: [
				[108.45, 11.94],
				[108.47, 11.95],
			],
		},
		lengthMeters: 1000,
		difficulty: "moderate",
		expectedDurationMinutes: 120,
		status,
		createdAt: "2026-08-27T00:00:00.000Z",
		updatedAt: "2026-08-27T00:00:00.000Z",
	};
}

const successSnapshot: WeatherSnapshot = {
	id: "snap-1",
	routeId: route("active").id,
	status: "success",
	observedAt: "2026-08-29T11:30:00.000Z",
	rainfallMm: 0,
	windKph: 10.4,
	temperatureC: 32.2,
	visibilityM: 23780,
	thunderstorm: false,
	errorMessage: null,
	createdAt: "2026-08-29T11:30:05.000Z",
};

const failedSnapshot: WeatherSnapshot = {
	...successSnapshot,
	id: "snap-2",
	status: "failed",
	observedAt: null,
	rainfallMm: null,
	windKph: null,
	temperatureC: null,
	visibilityM: null,
	thunderstorm: null,
	errorMessage: "Weather provider is currently unavailable.",
};

describe("RouteWeatherPanel", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		getLatestWeatherMock = vi.fn().mockResolvedValue(null);
		refreshWeatherMock = vi.fn();
		vi.doMock("../services/trekking-routes.service", () => ({
			trekkingRoutesService: {
				getLatestWeather: getLatestWeatherMock,
				refreshWeather: refreshWeatherMock,
			},
		}));

		[testingLibrary, { default: userEvent }, { RouteWeatherPanel }] = await Promise.all([
			import("@testing-library/react"),
			import("@testing-library/user-event"),
			import("./RouteWeatherPanel"),
		]);
	});

	afterEach(() => {
		testingLibrary.cleanup();
		vi.doUnmock("../services/trekking-routes.service");
		vi.resetModules();
	});

	it("shows the empty state when no snapshot has ever been recorded", async () => {
		testingLibrary.render(<RouteWeatherPanel route={route("active")} />);

		expect(await testingLibrary.screen.findByTestId("weather-empty")).toHaveTextContent(
			"Chưa có dữ liệu thời tiết"
		);
	});

	it("renders every BR-065 field from a real success snapshot", async () => {
		getLatestWeatherMock.mockResolvedValue(successSnapshot);
		testingLibrary.render(<RouteWeatherPanel route={route("active")} />);

		const snapshotEl = await testingLibrary.screen.findByTestId("weather-snapshot");
		expect(snapshotEl).toHaveTextContent("0 mm");
		expect(snapshotEl).toHaveTextContent("10.4 km/h");
		expect(snapshotEl).toHaveTextContent("32.2°C");
		expect(snapshotEl).toHaveTextContent("23780 m");
		expect(snapshotEl).toHaveTextContent("Không");
	});

	it("shows a distinct warning when the latest recorded attempt failed", async () => {
		getLatestWeatherMock.mockResolvedValue(failedSnapshot);
		testingLibrary.render(<RouteWeatherPanel route={route("active")} />);

		expect(await testingLibrary.screen.findByTestId("weather-last-fetch-failed")).toHaveTextContent(
			"Weather provider is currently unavailable."
		);
		expect(testingLibrary.screen.queryByTestId("weather-snapshot")).not.toBeInTheDocument();
	});

	it("shows a load error with a working retry", async () => {
		getLatestWeatherMock.mockRejectedValueOnce(new Error("network down"));
		testingLibrary.render(<RouteWeatherPanel route={route("active")} />);
		await testingLibrary.screen.findByTestId("weather-load-error");

		getLatestWeatherMock.mockResolvedValueOnce(successSnapshot);
		await userEvent.click(testingLibrary.screen.getByRole("button", { name: /tải lại/i }));

		await testingLibrary.screen.findByTestId("weather-snapshot");
		expect(getLatestWeatherMock).toHaveBeenCalledTimes(2);
	});

	it("disables the refresh button and explains why when the route is not active", async () => {
		testingLibrary.render(<RouteWeatherPanel route={route("draft")} />);
		await testingLibrary.screen.findByTestId("weather-empty");

		expect(
			testingLibrary.screen.getByRole("button", { name: /làm mới thời tiết/i })
		).toBeDisabled();
		expect(
			testingLibrary.screen.getByText(/Chỉ làm mới được khi tuyến đang Hoạt động/)
		).toBeInTheDocument();
	});

	it("clicking refresh on an active route calls the service and updates the display immediately", async () => {
		refreshWeatherMock.mockResolvedValue(successSnapshot);
		testingLibrary.render(<RouteWeatherPanel route={route("active")} />);
		await testingLibrary.screen.findByTestId("weather-empty");

		await userEvent.click(
			testingLibrary.screen.getByRole("button", { name: /làm mới thời tiết/i })
		);

		expect(refreshWeatherMock).toHaveBeenCalledWith(route("active").id);
		await testingLibrary.screen.findByTestId("weather-snapshot");
	});

	it("shows a distinct error banner when refresh itself fails, without clearing an existing snapshot", async () => {
		getLatestWeatherMock.mockResolvedValue(successSnapshot);
		refreshWeatherMock.mockRejectedValue(new Error("boom"));
		testingLibrary.render(<RouteWeatherPanel route={route("active")} />);
		await testingLibrary.screen.findByTestId("weather-snapshot");

		await userEvent.click(
			testingLibrary.screen.getByRole("button", { name: /làm mới thời tiết/i })
		);

		await testingLibrary.screen.findByTestId("weather-refresh-error");
		expect(testingLibrary.screen.getByTestId("weather-snapshot")).toBeInTheDocument();
	});
});
