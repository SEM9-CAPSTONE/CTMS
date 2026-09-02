import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatedTrekkingRoute, RouteStatus, WeatherAdvice } from "../types";

type TestingLibrary = typeof import("@testing-library/react");
type UserEvent = typeof import("@testing-library/user-event").default;
type RouteWeatherAdvicePanelComponent = typeof import(
	"./RouteWeatherAdvicePanel"
).RouteWeatherAdvicePanel;

let testingLibrary: TestingLibrary;
let userEvent: UserEvent;
let RouteWeatherAdvicePanel: RouteWeatherAdvicePanelComponent;
let getLatestWeatherAdviceMock: ReturnType<typeof vi.fn>;
let generateWeatherAdviceMock: ReturnType<typeof vi.fn>;

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

const mockAdvice: WeatherAdvice = {
	id: "advice-1",
	assessmentId: "assess-1",
	adviceText: "Điều kiện ở mức cảnh báo nhẹ, nên chuẩn bị áo mưa.",
	actions: ["Mang áo mưa", "Theo dõi dự báo trước giờ khởi hành"],
	createdBy: "user-1",
	createdAt: "2026-08-30T15:24:24.000Z",
};

describe("RouteWeatherAdvicePanel", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		getLatestWeatherAdviceMock = vi.fn().mockResolvedValue(null);
		generateWeatherAdviceMock = vi.fn();
		vi.doMock("../services/trekking-routes.service", () => ({
			trekkingRoutesService: {
				getLatestWeatherAdvice: getLatestWeatherAdviceMock,
				generateWeatherAdvice: generateWeatherAdviceMock,
			},
		}));

		[testingLibrary, { default: userEvent }, { RouteWeatherAdvicePanel }] = await Promise.all([
			import("@testing-library/react"),
			import("@testing-library/user-event"),
			import("./RouteWeatherAdvicePanel"),
		]);
	});

	afterEach(() => {
		testingLibrary.cleanup();
		vi.doUnmock("../services/trekking-routes.service");
		vi.resetModules();
	});

	it("shows empty state when no advice has ever been recorded", async () => {
		testingLibrary.render(<RouteWeatherAdvicePanel route={route("active")} />);

		expect(await testingLibrary.screen.findByTestId("advice-empty")).toHaveTextContent(
			"Chưa có lời khuyên cho tuyến này"
		);
	});

	it("renders loading state initially", () => {
		testingLibrary.render(<RouteWeatherAdvicePanel route={route("active")} />);
		expect(testingLibrary.screen.getByTestId("advice-loading")).toBeInTheDocument();
	});

	it("shows load error with working retry button", async () => {
		getLatestWeatherAdviceMock.mockRejectedValueOnce(new Error("failed loading"));
		testingLibrary.render(<RouteWeatherAdvicePanel route={route("active")} />);

		await testingLibrary.screen.findByTestId("advice-load-error");

		getLatestWeatherAdviceMock.mockResolvedValueOnce(mockAdvice);
		await userEvent.click(testingLibrary.screen.getByRole("button", { name: /tải lại/i }));

		await testingLibrary.screen.findByTestId("advice-content");
		expect(getLatestWeatherAdviceMock).toHaveBeenCalledTimes(2);
	});

	it("renders advice text and every recommended action", async () => {
		getLatestWeatherAdviceMock.mockResolvedValue(mockAdvice);
		testingLibrary.render(<RouteWeatherAdvicePanel route={route("active")} />);

		expect(await testingLibrary.screen.findByTestId("advice-text")).toHaveTextContent(
			"Điều kiện ở mức cảnh báo nhẹ"
		);
		const actionsEl = testingLibrary.screen.getByTestId("advice-actions");
		expect(actionsEl).toHaveTextContent("Mang áo mưa");
		expect(actionsEl).toHaveTextContent("Theo dõi dự báo trước giờ khởi hành");
	});

	it("disables the generate button and shows a warning when the route is not active", async () => {
		testingLibrary.render(<RouteWeatherAdvicePanel route={route("draft")} />);

		expect(await testingLibrary.screen.findByTestId("advice-empty")).toBeInTheDocument();
		expect(testingLibrary.screen.getByRole("button", { name: /tạo lời khuyên/i })).toBeDisabled();
		expect(
			testingLibrary.screen.getByText("Chỉ tạo được khi tuyến đang Hoạt động")
		).toBeInTheDocument();
	});

	it("clicking generate on an active route calls the service and updates display", async () => {
		generateWeatherAdviceMock.mockResolvedValue(mockAdvice);
		testingLibrary.render(<RouteWeatherAdvicePanel route={route("active")} />);

		await testingLibrary.screen.findByTestId("advice-empty");

		await userEvent.click(testingLibrary.screen.getByRole("button", { name: /tạo lời khuyên/i }));

		expect(generateWeatherAdviceMock).toHaveBeenCalledWith(route("active").id);
		expect(await testingLibrary.screen.findByTestId("advice-text")).toHaveTextContent(
			"Điều kiện ở mức cảnh báo nhẹ"
		);
	});

	it("shows a distinct generation error when generate fails", async () => {
		generateWeatherAdviceMock.mockRejectedValue(new Error("generation failed"));
		testingLibrary.render(<RouteWeatherAdvicePanel route={route("active")} />);

		await testingLibrary.screen.findByTestId("advice-empty");

		await userEvent.click(testingLibrary.screen.getByRole("button", { name: /tạo lời khuyên/i }));

		expect(await testingLibrary.screen.findByTestId("advice-generate-error")).toHaveTextContent(
			"Không thể tạo lời khuyên thời tiết"
		);
	});
});
