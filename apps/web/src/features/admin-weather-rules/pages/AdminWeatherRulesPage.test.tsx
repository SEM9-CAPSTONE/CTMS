import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../shared/components";
import { weatherRulesService } from "../services/weather-rules.service";
import type { WeatherRiskRuleItem } from "../types";
import { AdminWeatherRulesPage } from "./AdminWeatherRulesPage";

vi.mock("../services/weather-rules.service", () => ({
	weatherRulesService: {
		getAll: vi.fn(),
		getActive: vi.fn(),
		createRule: vi.fn(),
		activateRule: vi.fn(),
	},
}));

describe("AdminWeatherRulesPage Component", () => {
	const mockActiveRule: WeatherRiskRuleItem = {
		id: "rule-active-1",
		version: 2,
		rainfallYellowThreshold: 10,
		rainfallRedThreshold: 50,
		windYellowThreshold: 40,
		windRedThreshold: 70,
		tempLowYellow: 5,
		tempLowRed: 0,
		tempHighYellow: 38,
		tempHighRed: 42,
		visibilityYellowThreshold: 5000,
		visibilityRedThreshold: 1000,
		thunderstormYellow: true,
		thunderstormRed: true,
		rainfallWeight: 0.3,
		windWeight: 0.25,
		temperatureWeight: 0.15,
		visibilityWeight: 0.15,
		thunderstormWeight: 0.15,
		greenMaxScore: 0.5,
		yellowMaxScore: 1.2,
		isActive: true,
		createdBy: "admin-1",
		createdAt: "2026-09-03T10:00:00.000Z",
	};

	const mockRule2: WeatherRiskRuleItem = {
		...mockActiveRule,
		id: "rule-old-1",
		version: 1,
		isActive: false,
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	function renderComponent() {
		return render(
			<ToastProvider>
				<AdminWeatherRulesPage />
			</ToastProvider>
		);
	}

	it("renders active rule card and rule history table successfully", async () => {
		vi.mocked(weatherRulesService.getAll).mockResolvedValue([mockActiveRule, mockRule2]);
		vi.mocked(weatherRulesService.getActive).mockResolvedValue(mockActiveRule);

		renderComponent();

		expect(await screen.findByTestId("active-rule-card")).toBeInTheDocument();
		expect(screen.getByText("Bộ quy tắc thời tiết hiện tại (Phiên bản 2)")).toBeInTheDocument();
		expect(screen.getByTestId("rules-versions-table")).toBeInTheDocument();
		expect(screen.getByTestId("rule-row-2")).toBeInTheDocument();
		expect(screen.getByTestId("rule-row-1")).toBeInTheDocument();
	});

	it("renders empty rules state when no rules exist", async () => {
		vi.mocked(weatherRulesService.getAll).mockResolvedValue([]);
		vi.mocked(weatherRulesService.getActive).mockResolvedValue(null);

		renderComponent();

		expect(await screen.findByTestId("no-active-rule-card")).toBeInTheDocument();
		expect(screen.getByTestId("empty-rules-list")).toBeInTheDocument();
	});

	it("opens create rule dialog on button click", async () => {
		const user = userEvent.setup();
		vi.mocked(weatherRulesService.getAll).mockResolvedValue([mockActiveRule]);
		vi.mocked(weatherRulesService.getActive).mockResolvedValue(mockActiveRule);

		renderComponent();

		const createBtn = await screen.findByTestId("btn-open-create-modal");
		await user.click(createBtn);

		expect(screen.getByText("Tạo bộ quy tắc rủi ro thời tiết mới")).toBeInTheDocument();
		expect(screen.getByTestId("weight-sum-indicator")).toBeInTheDocument();
	});

	it("opens activation confirm modal when clicking activate on an inactive rule version", async () => {
		const user = userEvent.setup();
		vi.mocked(weatherRulesService.getAll).mockResolvedValue([mockActiveRule, mockRule2]);
		vi.mocked(weatherRulesService.getActive).mockResolvedValue(mockActiveRule);
		vi.mocked(weatherRulesService.activateRule).mockResolvedValue({
			...mockRule2,
			isActive: true,
		});

		renderComponent();

		const activateBtn = await screen.findByTestId("btn-activate-rule-1");
		await user.click(activateBtn);

		expect(screen.getByText("Xác nhận kích hoạt bộ quy tắc")).toBeInTheDocument();

		const confirmBtn = screen.getByText("Xác nhận kích hoạt");
		await user.click(confirmBtn);

		await waitFor(() => {
			expect(weatherRulesService.activateRule).toHaveBeenCalledWith("rule-old-1");
		});
	});
});
