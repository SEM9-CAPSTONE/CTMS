import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole, UserStatus } from "../../users/entities/user.entity";
import type { CreateWeatherRiskRuleDto } from "../dto/create-weather-risk-rule.dto";
import type { WeatherRiskRule } from "../entities/weather-risk-rule.entity";
import { WeatherRiskRulesService } from "./weather-risk-rules.service";

describe("WeatherRiskRulesService", () => {
	let service: WeatherRiskRulesService;
	let dataSource: jest.Mocked<Partial<DataSource>>;
	let mockRepository: Record<string, jest.Mock>;

	const mockAdminUser: AuthenticatedUser = {
		userId: "admin-uuid-1234",
		roles: [UserRole.ADMIN],
		status: UserStatus.ACTIVE,
	};

	const validRuleDto: CreateWeatherRiskRuleDto = {
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

	beforeEach(async () => {
		mockRepository = {
			find: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn((dto) => ({ id: "rule-uuid-1", ...dto, createdAt: new Date() })),
			save: jest.fn((rule) => Promise.resolve(rule)),
			update: jest.fn().mockResolvedValue({ affected: 1 }),
		};

		dataSource = {
			getRepository: jest.fn().mockReturnValue(mockRepository),
			transaction: jest.fn().mockImplementation((cb) =>
				cb({
					getRepository: jest.fn().mockReturnValue(mockRepository),
				})
			),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [WeatherRiskRulesService, { provide: DataSource, useValue: dataSource }],
		}).compile();

		service = module.get<WeatherRiskRulesService>(WeatherRiskRulesService);
	});

	describe("findAll", () => {
		it("should return all weather risk rule versions ordered by version DESC", async () => {
			const mockRules = [
				{ id: "rule-2", version: 2, isActive: true, createdAt: new Date() },
				{ id: "rule-1", version: 1, isActive: false, createdAt: new Date() },
			] as WeatherRiskRule[];
			mockRepository.find.mockResolvedValue(mockRules);

			const result = await service.findAll();

			expect(result).toHaveLength(2);
			expect(result[0]?.version).toBe(2);
			expect(result[1]?.version).toBe(1);
			expect(mockRepository.find).toHaveBeenCalledWith({ order: { version: "DESC" } });
		});
	});

	describe("findActive", () => {
		it("should return current active weather risk rule set", async () => {
			const mockActiveRule = {
				id: "rule-active",
				version: 1,
				isActive: true,
				createdAt: new Date(),
			} as WeatherRiskRule;
			mockRepository.findOne.mockResolvedValue(mockActiveRule);

			const result = await service.findActive();

			expect(result).not.toBeNull();
			expect(result?.id).toBe("rule-active");
			expect(result?.isActive).toBe(true);
			expect(mockRepository.findOne).toHaveBeenCalledWith({
				where: { isActive: true },
				order: { version: "DESC" },
			});
		});

		it("should return null if no active rule exists", async () => {
			mockRepository.findOne.mockResolvedValue(null);

			const result = await service.findActive();

			expect(result).toBeNull();
		});
	});

	describe("findById", () => {
		it("should return rule version when found", async () => {
			const mockRule = {
				id: "rule-uuid-1",
				version: 1,
				isActive: true,
				createdAt: new Date(),
			} as WeatherRiskRule;
			mockRepository.findOne.mockResolvedValue(mockRule);

			const result = await service.findById("rule-uuid-1");

			expect(result.id).toBe("rule-uuid-1");
		});

		it("should throw NotFoundException when rule version does not exist", async () => {
			mockRepository.findOne.mockResolvedValue(null);

			await expect(service.findById("non-existent-id")).rejects.toThrow(NotFoundException);
		});
	});

	describe("createRule", () => {
		it("should validate weights sum and create a new rule version with auto-incremented version", async () => {
			mockRepository.findOne.mockResolvedValue({ version: 2 });

			const result = await service.createRule(mockAdminUser, validRuleDto);

			expect(result.version).toBe(3);
			expect(result.isActive).toBe(true);
			expect(result.createdBy).toBe("admin-uuid-1234");
			expect(mockRepository.update).toHaveBeenCalledWith({ isActive: true }, { isActive: false });
		});

		it("should throw BadRequestException if criteria weights do not sum up to 1.0", async () => {
			const invalidWeightsDto = { ...validRuleDto, rainfallWeight: 0.5 }; // Total = 1.2

			await expect(service.createRule(mockAdminUser, invalidWeightsDto)).rejects.toThrow(
				BadRequestException
			);
		});

		it("should throw BadRequestException if rainfall yellow threshold >= red threshold", async () => {
			const invalidThresholdDto = {
				...validRuleDto,
				rainfallYellowThreshold: 50,
				rainfallRedThreshold: 10,
			};

			await expect(service.createRule(mockAdminUser, invalidThresholdDto)).rejects.toThrow(
				BadRequestException
			);
		});

		it("should throw BadRequestException if temperature thresholds violate ordering constraint", async () => {
			const invalidTempDto = {
				...validRuleDto,
				tempLowYellow: 0,
				tempLowRed: 5,
			};

			await expect(service.createRule(mockAdminUser, invalidTempDto)).rejects.toThrow(
				BadRequestException
			);
		});
	});

	describe("activateRule", () => {
		it("should atomically deactivate existing rules and activate target rule version", async () => {
			const targetRule = {
				id: "rule-uuid-2",
				version: 2,
				isActive: false,
				createdAt: new Date(),
			} as WeatherRiskRule;

			mockRepository.findOne.mockResolvedValue(targetRule);

			const result = await service.activateRule(mockAdminUser, "rule-uuid-2");

			expect(mockRepository.update).toHaveBeenCalledWith({ isActive: true }, { isActive: false });
			expect(result.isActive).toBe(true);
			expect(mockRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({ id: "rule-uuid-2", isActive: true })
			);
		});

		it("should throw NotFoundException if rule to activate does not exist", async () => {
			mockRepository.findOne.mockResolvedValue(null);

			await expect(service.activateRule(mockAdminUser, "non-existent")).rejects.toThrow(
				NotFoundException
			);
		});
	});
});
