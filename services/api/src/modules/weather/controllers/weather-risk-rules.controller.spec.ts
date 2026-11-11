import { Test, type TestingModule } from "@nestjs/testing";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole, UserStatus } from "../../users/entities/user.entity";
import type { CreateWeatherRiskRuleDto } from "../dto/create-weather-risk-rule.dto";
import type { WeatherRiskRuleResponseDto } from "../dto/weather-risk-rule-response.dto";
import { WeatherRiskRulesService } from "../services/weather-risk-rules.service";
import { WeatherRiskRulesController } from "./weather-risk-rules.controller";

describe("WeatherRiskRulesController", () => {
	let controller: WeatherRiskRulesController;
	let service: jest.Mocked<WeatherRiskRulesService>;

	const mockAdminUser: AuthenticatedUser = {
		userId: "admin-uuid-1234",
		roles: [UserRole.ADMIN],
		status: UserStatus.ACTIVE,
	};

	const mockRuleResponse: WeatherRiskRuleResponseDto = {
		id: "rule-uuid-1",
		version: 1,
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
		createdBy: "admin-uuid-1234",
		createdAt: new Date(),
	};

	beforeEach(async () => {
		const mockService: Partial<jest.Mocked<WeatherRiskRulesService>> = {
			findAll: jest.fn(),
			findActive: jest.fn(),
			findById: jest.fn(),
			createRule: jest.fn(),
			activateRule: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [WeatherRiskRulesController],
			providers: [{ provide: WeatherRiskRulesService, useValue: mockService }],
		}).compile();

		controller = module.get<WeatherRiskRulesController>(WeatherRiskRulesController);
		service = module.get(WeatherRiskRulesService);
	});

	describe("findAll", () => {
		it("should return list of all rule versions", async () => {
			service.findAll.mockResolvedValue([mockRuleResponse]);

			const result = await controller.findAll();

			expect(result).toEqual([mockRuleResponse]);
			expect(service.findAll).toHaveBeenCalledTimes(1);
		});
	});

	describe("findActive", () => {
		it("should return currently active weather risk rule set", async () => {
			service.findActive.mockResolvedValue(mockRuleResponse);

			const result = await controller.findActive();

			expect(result).toEqual(mockRuleResponse);
			expect(service.findActive).toHaveBeenCalledTimes(1);
		});
	});

	describe("findById", () => {
		it("should return rule version by ID", async () => {
			service.findById.mockResolvedValue(mockRuleResponse);

			const result = await controller.findById("rule-uuid-1");

			expect(result).toEqual(mockRuleResponse);
			expect(service.findById).toHaveBeenCalledWith("rule-uuid-1");
		});
	});

	describe("createRule", () => {
		it("should delegate creation to WeatherRiskRulesService", async () => {
			const dto: CreateWeatherRiskRuleDto = {
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
			};

			service.createRule.mockResolvedValue(mockRuleResponse);

			const result = await controller.createRule({ user: mockAdminUser }, dto);

			expect(result).toEqual(mockRuleResponse);
			expect(service.createRule).toHaveBeenCalledWith(mockAdminUser, dto);
		});
	});

	describe("activateRule", () => {
		it("should delegate activation to WeatherRiskRulesService", async () => {
			service.activateRule.mockResolvedValue(mockRuleResponse);

			const result = await controller.activateRule({ user: mockAdminUser }, "rule-uuid-1");

			expect(result).toEqual(mockRuleResponse);
			expect(service.activateRule).toHaveBeenCalledWith(mockAdminUser, "rule-uuid-1");
		});
	});
});
