import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { TrekkingRouteStatus } from "../../trekking-routes/entities/trekking-route.entity";
import { UserStatus } from "../../users/entities/user.entity";
import { RiskLevel } from "../entities/weather-risk-assessment.entity";
import { WeatherSnapshotStatus } from "../entities/weather-snapshot.entity";
import { WeatherRiskService } from "./weather-risk.service";

function actor(roles: string[], userId = "actor-1"): AuthenticatedUser {
	return { userId, roles, status: UserStatus.ACTIVE };
}

function mockRoute(overrides = {}) {
	return {
		id: "route-1",
		status: TrekkingRouteStatus.ACTIVE,
		hostId: "host-1",
		centroid: [108.46, 11.94],
		...overrides,
	};
}

function mockRule(overrides = {}) {
	return {
		id: "rule-1",
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
		...overrides,
	};
}

function mockSnapshot(overrides = {}) {
	return {
		id: "snap-1",
		routeId: "route-1",
		status: WeatherSnapshotStatus.SUCCESS,
		observedAt: new Date(),
		rainfallMm: 0,
		windKph: 10,
		temperatureC: 25,
		visibilityM: 10000,
		thunderstorm: false,
		...overrides,
	};
}

describe("WeatherRiskService", () => {
	let service: WeatherRiskService;
	let weatherRiskRepository: {
		findActiveRule: jest.Mock;
		findExistingAssessment: jest.Mock;
		createAssessment: jest.Mock;
		findLatestAssessmentForRoute: jest.Mock;
	};
	let weatherSnapshotsRepository: {
		findRouteForFetch: jest.Mock;
		findLatestForRoute: jest.Mock;
	};

	beforeEach(() => {
		weatherRiskRepository = {
			findActiveRule: jest.fn(),
			findExistingAssessment: jest.fn(),
			createAssessment: jest.fn(),
			findLatestAssessmentForRoute: jest.fn(),
		};
		weatherSnapshotsRepository = {
			findRouteForFetch: jest.fn(),
			findLatestForRoute: jest.fn(),
		};
		service = new WeatherRiskService(
			weatherRiskRepository as never,
			weatherSnapshotsRepository as never
		);
	});

	describe("calculateForRoute", () => {
		it("throws NotFoundException if route does not exist", async () => {
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(null);

			await expect(service.calculateForRoute(actor(["host"]), "missing-route")).rejects.toThrow(
				NotFoundException
			);
		});

		it("throws ForbiddenException if host does not own the route", async () => {
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(
				mockRoute({ hostId: "other-host" })
			);

			await expect(service.calculateForRoute(actor(["host"], "host-1"), "route-1")).rejects.toThrow(
				ForbiddenException
			);
		});

		it("allows admin to bypass ownership check", async () => {
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(
				mockRoute({ hostId: "other-host" })
			);
			weatherSnapshotsRepository.findLatestForRoute.mockResolvedValue(mockSnapshot());
			weatherRiskRepository.findActiveRule.mockResolvedValue(mockRule());
			weatherRiskRepository.createAssessment.mockResolvedValue({ id: "assess-1" });

			await expect(
				service.calculateForRoute(actor(["admin"], "admin-1"), "route-1")
			).resolves.toBeDefined();
		});

		it("throws ConflictException if route is not active (BR-243)", async () => {
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(
				mockRoute({ status: TrekkingRouteStatus.DRAFT })
			);

			await expect(service.calculateForRoute(actor(["host"], "host-1"), "route-1")).rejects.toThrow(
				ConflictException
			);

			expect(weatherRiskRepository.createAssessment).not.toHaveBeenCalled();
		});

		it("throws ConflictException if no snapshot found (BR-066)", async () => {
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(mockRoute());
			weatherSnapshotsRepository.findLatestForRoute.mockResolvedValue(null);

			await expect(service.calculateForRoute(actor(["host"], "host-1"), "route-1")).rejects.toThrow(
				ConflictException
			);
		});

		it("throws ConflictException if latest snapshot was failed (BR-066)", async () => {
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(mockRoute());
			weatherSnapshotsRepository.findLatestForRoute.mockResolvedValue(
				mockSnapshot({ status: WeatherSnapshotStatus.FAILED })
			);

			await expect(service.calculateForRoute(actor(["host"], "host-1"), "route-1")).rejects.toThrow(
				ConflictException
			);
		});

		it("throws ConflictException if no active rules configured", async () => {
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(mockRoute());
			weatherSnapshotsRepository.findLatestForRoute.mockResolvedValue(mockSnapshot());
			weatherRiskRepository.findActiveRule.mockResolvedValue(null);

			await expect(service.calculateForRoute(actor(["host"], "host-1"), "route-1")).rejects.toThrow(
				ConflictException
			);
		});

		it("returns existing assessment if already computed (idempotency / BR-230)", async () => {
			const route = mockRoute();
			const snapshot = mockSnapshot();
			const rule = mockRule();
			const existingAssessment = {
				id: "existing-1",
				routeId: "route-1",
				snapshotId: "snap-1",
				ruleVersionId: "rule-1",
			};

			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(route);
			weatherSnapshotsRepository.findLatestForRoute.mockResolvedValue(snapshot);
			weatherRiskRepository.findActiveRule.mockResolvedValue(rule);
			weatherRiskRepository.findExistingAssessment.mockResolvedValue(existingAssessment);

			const result = await service.calculateForRoute(actor(["host"], "host-1"), "route-1");

			expect(weatherRiskRepository.findExistingAssessment).toHaveBeenCalledWith(
				snapshot.id,
				rule.id
			);
			expect(weatherRiskRepository.createAssessment).not.toHaveBeenCalled();
			expect(result.id).toBe(existingAssessment.id);
		});

		it("calculates GREEN score correctly", async () => {
			const route = mockRoute();
			const snapshot = mockSnapshot({
				rainfallMm: 0,
				windKph: 10,
				temperatureC: 22,
				visibilityM: 12000,
				thunderstorm: false,
			});
			const rule = mockRule();

			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(route);
			weatherSnapshotsRepository.findLatestForRoute.mockResolvedValue(snapshot);
			weatherRiskRepository.findActiveRule.mockResolvedValue(rule);
			weatherRiskRepository.findExistingAssessment.mockResolvedValue(null);
			weatherRiskRepository.createAssessment.mockImplementation((dto) =>
				Promise.resolve({ ...dto, id: "assess-green" })
			);

			const result = await service.calculateForRoute(actor(["host"], "host-1"), "route-1");

			expect(result.riskLevel).toBe(RiskLevel.GREEN);
			expect(result.compositeScore).toBe(0.0);
			expect(result.criteriaScores.rainfall.score).toBe(0);
			expect(result.criteriaScores.wind.score).toBe(0);
			expect(result.criteriaScores.temperature.score).toBe(0);
			expect(result.criteriaScores.visibility.score).toBe(0);
			expect(result.criteriaScores.thunderstorm.score).toBe(0);
		});

		it("calculates YELLOW score correctly", async () => {
			const route = mockRoute();
			// Rain: 15 (Yellow, score 1 * 0.3 = 0.3)
			// Wind: 20 (Green, score 0 * 0.25 = 0.0)
			// Temp: 4 (Low Yellow, score 1 * 0.15 = 0.15)
			// Visibility: 6000 (Green, score 0 * 0.15 = 0)
			// Thunderstorm: false
			// Total composite: 0.45 < 0.5 (Green? Wait, greenMaxScore is 0.5. Let's make total composite >= 0.5)
			// Let's add Wind: 45 (Yellow, score 1 * 0.25 = 0.25) -> Total composite = 0.3 + 0.25 + 0.15 = 0.70 (Yellow)
			const snapshot = mockSnapshot({
				rainfallMm: 15,
				windKph: 45,
				temperatureC: 4,
				visibilityM: 10000,
				thunderstorm: false,
			});
			const rule = mockRule();

			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(route);
			weatherSnapshotsRepository.findLatestForRoute.mockResolvedValue(snapshot);
			weatherRiskRepository.findActiveRule.mockResolvedValue(rule);
			weatherRiskRepository.findExistingAssessment.mockResolvedValue(null);
			weatherRiskRepository.createAssessment.mockImplementation((dto) =>
				Promise.resolve({ ...dto, id: "assess-yellow" })
			);

			const result = await service.calculateForRoute(actor(["host"], "host-1"), "route-1");

			expect(result.riskLevel).toBe(RiskLevel.YELLOW);
			expect(result.compositeScore).toBe(0.7);
			expect(result.criteriaScores.rainfall.score).toBe(1);
			expect(result.criteriaScores.wind.score).toBe(1);
			expect(result.criteriaScores.temperature.score).toBe(1);
			expect(result.criteriaScores.visibility.score).toBe(0);
		});

		it("calculates RED score correctly", async () => {
			const route = mockRoute();
			// Rain: 55 (Red, score 2 * 0.30 = 0.60)
			// Wind: 75 (Red, score 2 * 0.25 = 0.50)
			// Temp: -2 (Red, score 2 * 0.15 = 0.30)
			// Total composite = 0.6 + 0.5 + 0.3 = 1.40 >= 1.20 (Red)
			const snapshot = mockSnapshot({
				rainfallMm: 55,
				windKph: 75,
				temperatureC: -2,
				visibilityM: 10000,
				thunderstorm: false,
			});
			const rule = mockRule();

			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(route);
			weatherSnapshotsRepository.findLatestForRoute.mockResolvedValue(snapshot);
			weatherRiskRepository.findActiveRule.mockResolvedValue(rule);
			weatherRiskRepository.findExistingAssessment.mockResolvedValue(null);
			weatherRiskRepository.createAssessment.mockImplementation((dto) =>
				Promise.resolve({ ...dto, id: "assess-red" })
			);

			const result = await service.calculateForRoute(actor(["host"], "host-1"), "route-1");

			expect(result.riskLevel).toBe(RiskLevel.RED);
			expect(result.compositeScore).toBe(1.4);
		});

		it("calculates RED score on thunderstorm", async () => {
			const route = mockRoute();
			// Thunderstorm true maps to Red (score 2 * 0.15 = 0.30)
			// Rain: 60 (Red, score 2 * 0.30 = 0.60)
			// Wind: 45 (Yellow, score 1 * 0.25 = 0.25)
			// Total composite: 0.30 + 0.60 + 0.25 = 1.15 (Yellow, since < 1.2)
			// Let's add visibility: 800 (Red, score 2 * 0.15 = 0.30) -> Total: 1.45 (Red)
			const snapshot = mockSnapshot({
				rainfallMm: 60,
				windKph: 45,
				temperatureC: 22,
				visibilityM: 800,
				thunderstorm: true,
			});
			const rule = mockRule();

			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(route);
			weatherSnapshotsRepository.findLatestForRoute.mockResolvedValue(snapshot);
			weatherRiskRepository.findActiveRule.mockResolvedValue(rule);
			weatherRiskRepository.findExistingAssessment.mockResolvedValue(null);
			weatherRiskRepository.createAssessment.mockImplementation((dto) =>
				Promise.resolve({ ...dto, id: "assess-red" })
			);

			const result = await service.calculateForRoute(actor(["host"], "host-1"), "route-1");

			expect(result.riskLevel).toBe(RiskLevel.RED);
			expect(result.criteriaScores.thunderstorm.score).toBe(2);
		});
	});

	describe("getLatestForRoute", () => {
		it("throws NotFoundException if route does not exist", async () => {
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(null);

			await expect(service.getLatestForRoute(actor(["host"]), "missing-route")).rejects.toThrow(
				NotFoundException
			);
		});

		it("throws ForbiddenException if host does not own the route", async () => {
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(
				mockRoute({ hostId: "other-host" })
			);

			await expect(service.getLatestForRoute(actor(["host"], "host-1"), "route-1")).rejects.toThrow(
				ForbiddenException
			);
		});

		it("returns null if no assessment exists", async () => {
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(mockRoute());
			weatherRiskRepository.findLatestAssessmentForRoute.mockResolvedValue(null);

			const result = await service.getLatestForRoute(actor(["host"], "host-1"), "route-1");
			expect(result).toBeNull();
		});

		it("returns latest assessment response dto", async () => {
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(mockRoute());
			const assessment = {
				id: "assess-1",
				routeId: "route-1",
				snapshotId: "snap-1",
				ruleVersionId: "rule-1",
				riskLevel: RiskLevel.GREEN,
				compositeScore: 0.1,
				criteriaScores: {} as never,
				createdBy: "user-1",
				createdAt: new Date(),
			};
			weatherRiskRepository.findLatestAssessmentForRoute.mockResolvedValue(assessment);

			const result = await service.getLatestForRoute(actor(["host"], "host-1"), "route-1");
			expect(result).toBeDefined();
			expect(result?.id).toBe("assess-1");
		});
	});
});
