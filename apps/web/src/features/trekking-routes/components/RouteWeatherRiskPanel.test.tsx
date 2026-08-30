import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatedTrekkingRoute, RouteStatus, WeatherRiskAssessment } from "../types";

type TestingLibrary = typeof import("@testing-library/react");
type UserEvent = typeof import("@testing-library/user-event").default;
type RouteWeatherRiskPanelComponent = typeof import(
	"./RouteWeatherRiskPanel"
).RouteWeatherRiskPanel;

let testingLibrary: TestingLibrary;
let userEvent: UserEvent;
let RouteWeatherRiskPanel: RouteWeatherRiskPanelComponent;
let getLatestWeatherRiskMock: ReturnType<typeof vi.fn>;
let calculateWeatherRiskMock: ReturnType<typeof vi.fn>;

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

const mockAssessment: WeatherRiskAssessment = {
	id: "assess-1",
	routeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
	snapshotId: "snap-1",
	ruleVersionId: "rule-1",
	riskLevel: "yellow",
	compositeScore: 0.65,
	criteriaScores: {
		rainfall: { value: 12.5, level: "yellow", weight: 0.3, score: 1 },
		wind: { value: 35.0, level: "green", weight: 0.25, score: 0 },
		temperature: { value: 3.5, level: "yellow", weight: 0.15, score: 1 },
		visibility: { value: 8000, level: "green", weight: 0.15, score: 0 },
		thunderstorm: { value: false, level: "green", weight: 0.15, score: 0 },
	},
	createdBy: "user-1",
	createdAt: "2026-08-30T15:24:24.000Z",
};

describe("RouteWeatherRiskPanel", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		getLatestWeatherRiskMock = vi.fn().mockResolvedValue(null);
		calculateWeatherRiskMock = vi.fn();
		vi.doMock("../services/trekking-routes.service", () => ({
			trekkingRoutesService: {
				getLatestWeatherRisk: getLatestWeatherRiskMock,
				calculateWeatherRisk: calculateWeatherRiskMock,
			},
		}));

		[testingLibrary, { default: userEvent }, { RouteWeatherRiskPanel }] = await Promise.all([
			import("@testing-library/react"),
			import("@testing-library/user-event"),
			import("./RouteWeatherRiskPanel"),
		]);
	});

	afterEach(() => {
		testingLibrary.cleanup();
		vi.doUnmock("../services/trekking-routes.service");
		vi.resetModules();
	});

	it("shows empty state when no assessment has ever been recorded", async () => {
		testingLibrary.render(<RouteWeatherRiskPanel route={route("active")} />);

		expect(await testingLibrary.screen.findByTestId("risk-empty")).toHaveTextContent(
			"Chưa có đánh giá rủi ro cho tuyến này"
		);
	});

	it("renders loading state initially", () => {
		testingLibrary.render(<RouteWeatherRiskPanel route={route("active")} />);
		expect(testingLibrary.screen.getByTestId("risk-loading")).toBeInTheDocument();
	});

	it("shows load error with working retry button", async () => {
		getLatestWeatherRiskMock.mockRejectedValueOnce(new Error("failed loading"));
		testingLibrary.render(<RouteWeatherRiskPanel route={route("active")} />);

		await testingLibrary.screen.findByTestId("risk-load-error");

		getLatestWeatherRiskMock.mockResolvedValueOnce(mockAssessment);
		await userEvent.click(testingLibrary.screen.getByRole("button", { name: /tải lại/i }));

		await testingLibrary.screen.findByTestId("risk-level-badge");
		expect(getLatestWeatherRiskMock).toHaveBeenCalledTimes(2);
	});

	it("renders risk level badge, composite score, and criterion breakdown", async () => {
		getLatestWeatherRiskMock.mockResolvedValue(mockAssessment);
		testingLibrary.render(<RouteWeatherRiskPanel route={route("active")} />);

		expect(await testingLibrary.screen.findByTestId("risk-level-badge")).toHaveTextContent(
			"Cảnh báo (Trung bình)"
		);
		expect(testingLibrary.screen.getByTestId("risk-composite-score")).toHaveTextContent("0.65");

		const rainfallEl = testingLibrary.screen.getByTestId("criterion-rainfall");
		expect(rainfallEl).toHaveTextContent("Lượng mưa");
		expect(rainfallEl).toHaveTextContent("12.5 mm");
		expect(rainfallEl).toHaveTextContent("Điểm: 1 (Hệ số: 0.30)");

		const windEl = testingLibrary.screen.getByTestId("criterion-wind");
		expect(windEl).toHaveTextContent("Sức gió");
		expect(windEl).toHaveTextContent("35 km/h");
		expect(windEl).toHaveTextContent("Điểm: 0 (Hệ số: 0.25)");

		const tempEl = testingLibrary.screen.getByTestId("criterion-temperature");
		expect(tempEl).toHaveTextContent("Nhiệt độ");
		expect(tempEl).toHaveTextContent("3.5°C");
		expect(tempEl).toHaveTextContent("Điểm: 1 (Hệ số: 0.15)");
	});

	it("disables the calculate button and shows a warning when the route is not active", async () => {
		testingLibrary.render(<RouteWeatherRiskPanel route={route("draft")} />);

		expect(await testingLibrary.screen.findByTestId("risk-empty")).toBeInTheDocument();
		expect(testingLibrary.screen.getByRole("button", { name: /tính điểm rủi ro/i })).toBeDisabled();
		expect(
			testingLibrary.screen.getByText("Chỉ tính được khi tuyến đang Hoạt động")
		).toBeInTheDocument();
	});

	it("clicking calculate on an active route calls the service and updates display", async () => {
		calculateWeatherRiskMock.mockResolvedValue(mockAssessment);
		testingLibrary.render(<RouteWeatherRiskPanel route={route("active")} />);

		await testingLibrary.screen.findByTestId("risk-empty");

		await userEvent.click(testingLibrary.screen.getByRole("button", { name: /tính điểm rủi ro/i }));

		expect(calculateWeatherRiskMock).toHaveBeenCalledWith(route("active").id);
		expect(await testingLibrary.screen.findByTestId("risk-level-badge")).toHaveTextContent(
			"Cảnh báo (Trung bình)"
		);
	});

	it("shows a distinct calculation error when calculate fails", async () => {
		calculateWeatherRiskMock.mockRejectedValue(new Error("calculation failed"));
		testingLibrary.render(<RouteWeatherRiskPanel route={route("active")} />);

		await testingLibrary.screen.findByTestId("risk-empty");

		await userEvent.click(testingLibrary.screen.getByRole("button", { name: /tính điểm rủi ro/i }));

		expect(await testingLibrary.screen.findByTestId("risk-calculate-error")).toHaveTextContent(
			"Không thể tính điểm rủi ro thời tiết"
		);
	});
});
