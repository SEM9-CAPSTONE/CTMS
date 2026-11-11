import {
	ConflictException,
	ForbiddenException,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { TrekkingRouteStatus } from "../../trekking-routes/entities/trekking-route.entity";
import { UserStatus } from "../../users/entities/user.entity";
import { RiskLevel } from "../entities/weather-risk-assessment.entity";
import { WeatherAdviceProviderError } from "../providers/weather-advice-provider.interface";
import { WeatherAdviceService } from "./weather-advice.service";

function actor(roles: string[], userId = "actor-1"): AuthenticatedUser {
	return { userId, roles, status: UserStatus.ACTIVE };
}

function mockRoute(overrides = {}) {
	return {
		id: "route-1",
		status: TrekkingRouteStatus.ACTIVE,
		hostId: "host-1",
		...overrides,
	};
}

function mockCriterion(overrides = {}) {
	return { value: 0, level: RiskLevel.GREEN, weight: 0.2, score: 0, ...overrides };
}

function mockAssessment(overrides = {}) {
	return {
		id: "assess-1",
		routeId: "route-1",
		riskLevel: RiskLevel.YELLOW,
		compositeScore: 0.7,
		criteriaScores: {
			rainfall: mockCriterion(),
			wind: mockCriterion(),
			temperature: mockCriterion(),
			visibility: mockCriterion(),
			thunderstorm: mockCriterion(),
		},
		...overrides,
	};
}

function mockAdvice(overrides = {}) {
	return {
		id: "advice-1",
		assessmentId: "assess-1",
		adviceText: "Điều kiện ở mức cảnh báo nhẹ, nên chuẩn bị áo mưa.",
		actions: ["Mang áo mưa", "Theo dõi dự báo trước giờ khởi hành"],
		createdBy: "host-1",
		createdAt: new Date(),
		...overrides,
	};
}

describe("WeatherAdviceService", () => {
	let service: WeatherAdviceService;
	let weatherAdviceRepository: {
		findExistingForAssessment: jest.Mock;
		createAdvice: jest.Mock;
		findLatestForRoute: jest.Mock;
	};
	let weatherRiskRepository: {
		findLatestAssessmentForRoute: jest.Mock;
	};
	let weatherSnapshotsRepository: {
		findRouteForFetch: jest.Mock;
	};
	let weatherAdviceProvider: {
		generate: jest.Mock;
	};

	beforeEach(() => {
		weatherAdviceRepository = {
			findExistingForAssessment: jest.fn(),
			createAdvice: jest.fn(),
			findLatestForRoute: jest.fn(),
		};
		weatherRiskRepository = {
			findLatestAssessmentForRoute: jest.fn(),
		};
		weatherSnapshotsRepository = {
			findRouteForFetch: jest.fn(),
		};
		weatherAdviceProvider = {
			generate: jest.fn(),
		};
		service = new WeatherAdviceService(
			weatherAdviceRepository as never,
			weatherRiskRepository as never,
			weatherSnapshotsRepository as never,
			weatherAdviceProvider as never
		);
	});

	describe("generateForRoute", () => {
		it("throws NotFoundException if route does not exist", async () => {
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(null);

			await expect(service.generateForRoute(actor(["host"]), "missing-route")).rejects.toThrow(
				NotFoundException
			);
		});

		it("throws ForbiddenException if host does not own the route", async () => {
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(
				mockRoute({ hostId: "other-host" })
			);

			await expect(service.generateForRoute(actor(["host"], "host-1"), "route-1")).rejects.toThrow(
				ForbiddenException
			);
		});

		it("allows admin to bypass ownership check", async () => {
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(
				mockRoute({ hostId: "other-host" })
			);
			weatherRiskRepository.findLatestAssessmentForRoute.mockResolvedValue(mockAssessment());
			weatherAdviceRepository.findExistingForAssessment.mockResolvedValue(null);
			weatherAdviceProvider.generate.mockResolvedValue({
				adviceText: "ok",
				actions: ["a"],
			});
			weatherAdviceRepository.createAdvice.mockResolvedValue(mockAdvice());

			await expect(
				service.generateForRoute(actor(["admin"], "admin-1"), "route-1")
			).resolves.toBeDefined();
		});

		it("throws ConflictException if route is not active (BR-243), with zero side effects", async () => {
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(
				mockRoute({ status: TrekkingRouteStatus.DRAFT })
			);

			await expect(service.generateForRoute(actor(["host"], "host-1"), "route-1")).rejects.toThrow(
				ConflictException
			);

			expect(weatherAdviceProvider.generate).not.toHaveBeenCalled();
			expect(weatherAdviceRepository.createAdvice).not.toHaveBeenCalled();
		});

		it("throws ConflictException if no risk assessment exists for the route, with zero side effects", async () => {
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(mockRoute());
			weatherRiskRepository.findLatestAssessmentForRoute.mockResolvedValue(null);

			await expect(service.generateForRoute(actor(["host"], "host-1"), "route-1")).rejects.toThrow(
				ConflictException
			);

			expect(weatherAdviceProvider.generate).not.toHaveBeenCalled();
			expect(weatherAdviceRepository.createAdvice).not.toHaveBeenCalled();
		});

		it("returns existing advice without calling the provider again (idempotency / BR-230)", async () => {
			const assessment = mockAssessment();
			const existingAdvice = mockAdvice();

			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(mockRoute());
			weatherRiskRepository.findLatestAssessmentForRoute.mockResolvedValue(assessment);
			weatherAdviceRepository.findExistingForAssessment.mockResolvedValue(existingAdvice);

			const result = await service.generateForRoute(actor(["host"], "host-1"), "route-1");

			expect(weatherAdviceRepository.findExistingForAssessment).toHaveBeenCalledWith(assessment.id);
			expect(weatherAdviceProvider.generate).not.toHaveBeenCalled();
			expect(weatherAdviceRepository.createAdvice).not.toHaveBeenCalled();
			expect(result.id).toBe(existingAdvice.id);
		});

		it("calls the provider with the assessment's own criteria (never recalculating risk) and persists the result", async () => {
			const assessment = mockAssessment();
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(mockRoute());
			weatherRiskRepository.findLatestAssessmentForRoute.mockResolvedValue(assessment);
			weatherAdviceRepository.findExistingForAssessment.mockResolvedValue(null);
			weatherAdviceProvider.generate.mockResolvedValue({
				adviceText: "Điều kiện ở mức cảnh báo nhẹ.",
				actions: ["Mang áo mưa"],
			});
			weatherAdviceRepository.createAdvice.mockResolvedValue(mockAdvice());

			const result = await service.generateForRoute(actor(["host"], "host-1"), "route-1");

			expect(weatherAdviceProvider.generate).toHaveBeenCalledWith({
				riskLevel: assessment.riskLevel,
				compositeScore: assessment.compositeScore,
				rainfall: assessment.criteriaScores.rainfall,
				wind: assessment.criteriaScores.wind,
				temperature: assessment.criteriaScores.temperature,
				visibility: assessment.criteriaScores.visibility,
				thunderstorm: assessment.criteriaScores.thunderstorm,
			});
			expect(weatherAdviceRepository.createAdvice).toHaveBeenCalledWith({
				assessmentId: assessment.id,
				adviceText: "Điều kiện ở mức cảnh báo nhẹ.",
				actions: ["Mang áo mưa"],
				createdBy: "host-1",
			});
			expect(result.id).toBe("advice-1");
		});

		it("retries a transient provider failure and succeeds without a second persistence attempt", async () => {
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(mockRoute());
			weatherRiskRepository.findLatestAssessmentForRoute.mockResolvedValue(mockAssessment());
			weatherAdviceRepository.findExistingForAssessment.mockResolvedValue(null);
			weatherAdviceProvider.generate
				.mockRejectedValueOnce(new WeatherAdviceProviderError("boom"))
				.mockResolvedValueOnce({ adviceText: "ok", actions: ["a"] });
			weatherAdviceRepository.createAdvice.mockResolvedValue(mockAdvice());

			await service.generateForRoute(actor(["host"], "host-1"), "route-1");

			expect(weatherAdviceProvider.generate).toHaveBeenCalledTimes(2);
			expect(weatherAdviceRepository.createAdvice).toHaveBeenCalledTimes(1);
		}, 10000);

		it("gives up after 3 attempts, persists nothing, and throws ServiceUnavailableException (BR-229)", async () => {
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(mockRoute());
			weatherRiskRepository.findLatestAssessmentForRoute.mockResolvedValue(mockAssessment());
			weatherAdviceRepository.findExistingForAssessment.mockResolvedValue(null);
			weatherAdviceProvider.generate.mockRejectedValue(
				new WeatherAdviceProviderError("service down")
			);

			await expect(service.generateForRoute(actor(["host"], "host-1"), "route-1")).rejects.toThrow(
				ServiceUnavailableException
			);

			expect(weatherAdviceProvider.generate).toHaveBeenCalledTimes(3);
			expect(weatherAdviceRepository.createAdvice).not.toHaveBeenCalled();
		}, 10000);
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

		it("returns null if no advice has ever been recorded for the route", async () => {
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(mockRoute());
			weatherAdviceRepository.findLatestForRoute.mockResolvedValue(null);

			const result = await service.getLatestForRoute(actor(["host"], "host-1"), "route-1");
			expect(result).toBeNull();
		});

		it("returns the mapped latest advice when one exists", async () => {
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(mockRoute());
			weatherAdviceRepository.findLatestForRoute.mockResolvedValue(mockAdvice());

			const result = await service.getLatestForRoute(actor(["host"], "host-1"), "route-1");
			expect(result).toBeDefined();
			expect(result?.id).toBe("advice-1");
		});
	});
});
