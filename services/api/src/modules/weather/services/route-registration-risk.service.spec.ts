import {
	ConflictException,
	ForbiddenException,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole, UserStatus } from "../../users/entities/user.entity";
import { RiskLevel } from "../entities/weather-risk-assessment.entity";
import { RouteRegistrationRiskService } from "./route-registration-risk.service";

function createActor(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
	return {
		userId: "user-camper-1",
		roles: [UserRole.CAMPER],
		status: UserStatus.ACTIVE,
		...overrides,
	};
}

describe("RouteRegistrationRiskService", () => {
	let service: RouteRegistrationRiskService;
	let weatherRiskRepository: {
		findLatestAssessmentForRoute: jest.Mock;
	};
	let weatherSnapshotsRepository: {
		findRouteForFetch: jest.Mock;
	};
	let mockDataSource: {
		isInitialized: boolean;
		getRepository: jest.Mock;
		query: jest.Mock;
	};

	beforeEach(() => {
		weatherRiskRepository = {
			findLatestAssessmentForRoute: jest.fn(),
		};
		weatherSnapshotsRepository = {
			findRouteForFetch: jest.fn(),
		};
		mockDataSource = {
			isInitialized: true,
			getRepository: jest.fn().mockReturnValue({
				create: jest.fn().mockImplementation((dto) => dto),
				save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: "log-1", ...entity })),
			}),
			query: jest.fn(),
		};

		service = new RouteRegistrationRiskService(
			weatherRiskRepository as never,
			weatherSnapshotsRepository as never,
			mockDataSource as never
		);
	});

	describe("checkRouteEligibility", () => {
		it("throws NotFoundException if the route does not exist", async () => {
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue(null);

			await expect(service.checkRouteEligibility("missing-route")).rejects.toThrow(
				NotFoundException
			);
		});

		it("throws ConflictException if no weather risk assessment has been calculated for the route", async () => {
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue({ id: "route-1" });
			weatherRiskRepository.findLatestAssessmentForRoute.mockResolvedValue(null);

			await expect(service.checkRouteEligibility("route-1")).rejects.toThrow(ConflictException);
		});

		it("returns allowed = true when weather risk level is GREEN", async () => {
			const assessmentTime = new Date("2026-09-03T10:00:00.000Z");
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue({ id: "route-1" });
			weatherRiskRepository.findLatestAssessmentForRoute.mockResolvedValue({
				id: "assess-1",
				routeId: "route-1",
				riskLevel: RiskLevel.GREEN,
				compositeScore: 0.1,
				createdAt: assessmentTime,
				criteriaScores: {
					rainfall: { level: RiskLevel.GREEN, value: 0 },
					wind: { level: RiskLevel.GREEN, value: 10 },
				},
			});

			const result = await service.checkRouteEligibility("route-1");

			expect(result).toEqual({
				allowed: true,
				routeId: "route-1",
				riskLevel: RiskLevel.GREEN,
				assessmentTime,
				compositeScore: 0.1,
				reasons: [],
			});
		});

		it("returns allowed = true when weather risk level is YELLOW", async () => {
			const assessmentTime = new Date("2026-09-03T10:00:00.000Z");
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue({ id: "route-1" });
			weatherRiskRepository.findLatestAssessmentForRoute.mockResolvedValue({
				id: "assess-1",
				routeId: "route-1",
				riskLevel: RiskLevel.YELLOW,
				compositeScore: 0.8,
				createdAt: assessmentTime,
				criteriaScores: {
					rainfall: { level: RiskLevel.YELLOW, value: 20 },
				},
			});

			const result = await service.checkRouteEligibility("route-1");

			expect(result).toEqual({
				allowed: true,
				routeId: "route-1",
				riskLevel: RiskLevel.YELLOW,
				assessmentTime,
				compositeScore: 0.8,
				reasons: [],
			});
		});

		it("returns allowed = false and reasons breakdown when weather risk level is RED", async () => {
			const assessmentTime = new Date("2026-09-03T10:00:00.000Z");
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue({ id: "route-1" });
			weatherRiskRepository.findLatestAssessmentForRoute.mockResolvedValue({
				id: "assess-red",
				routeId: "route-1",
				riskLevel: RiskLevel.RED,
				compositeScore: 1.5,
				createdAt: assessmentTime,
				criteriaScores: {
					rainfall: { level: RiskLevel.RED, value: 65 },
					wind: { level: RiskLevel.RED, value: 75 },
					temperature: { level: RiskLevel.GREEN, value: 25 },
					visibility: { level: RiskLevel.GREEN, value: 10000 },
					thunderstorm: { level: RiskLevel.GREEN, value: false },
				},
			});

			const result = await service.checkRouteEligibility("route-1");

			expect(result.allowed).toBe(false);
			expect(result.riskLevel).toBe(RiskLevel.RED);
			expect(result.assessmentTime).toEqual(assessmentTime);
			expect(result.reasons).toHaveLength(2);
			expect(result.reasons[0]).toEqual({
				criterion: "rainfall",
				level: RiskLevel.RED,
				value: 65,
				message: "Lượng mưa (65mm) vượt quá ngưỡng nguy hiểm Mức Đỏ",
			});
			expect(result.reasons[1]).toEqual({
				criterion: "wind",
				level: RiskLevel.RED,
				value: 75,
				message: "Tốc độ gió (75km/h) vượt quá ngưỡng nguy hiểm Mức Đỏ",
			});
		});
	});

	describe("assertRegistrationAllowedForRoute", () => {
		it("throws UnauthorizedException if actor is missing or unauthenticated", async () => {
			await expect(
				service.assertRegistrationAllowedForRoute(null as never, "route-1")
			).rejects.toThrow(UnauthorizedException);
		});

		it("throws ForbiddenException if actor account status is not ACTIVE (BR-202)", async () => {
			const suspendedActor = createActor({ status: UserStatus.SUSPENDED });

			await expect(
				service.assertRegistrationAllowedForRoute(suspendedActor, "route-1")
			).rejects.toThrow(ForbiddenException);
		});

		it("succeeds and returns eligibility when risk level is GREEN or YELLOW", async () => {
			const actor = createActor();
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue({ id: "route-1" });
			weatherRiskRepository.findLatestAssessmentForRoute.mockResolvedValue({
				id: "assess-1",
				routeId: "route-1",
				riskLevel: RiskLevel.GREEN,
				compositeScore: 0.1,
				createdAt: new Date(),
				criteriaScores: {},
			});

			const result = await service.assertRegistrationAllowedForRoute(actor, "route-1");
			expect(result.allowed).toBe(true);
		});

		it("rejects with HTTP 409 Conflict containing reason, riskLevel, and assessment time when risk level is RED", async () => {
			const actor = createActor();
			const assessmentTime = new Date("2026-09-03T11:00:00.000Z");
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue({ id: "route-1" });
			weatherRiskRepository.findLatestAssessmentForRoute.mockResolvedValue({
				id: "assess-red",
				routeId: "route-1",
				riskLevel: RiskLevel.RED,
				compositeScore: 1.4,
				createdAt: assessmentTime,
				criteriaScores: {
					rainfall: { level: RiskLevel.RED, value: 80 },
					thunderstorm: { level: RiskLevel.RED, value: true },
				},
			});

			try {
				await service.assertRegistrationAllowedForRoute(actor, "route-1");
				fail("Expected ConflictException was not thrown");
			} catch (error: unknown) {
				expect(error).toBeInstanceOf(ConflictException);
				const errResponse = (error as ConflictException).getResponse() as Record<string, unknown>;

				expect(errResponse).toMatchObject({
					statusCode: 409,
					message: "New registrations are blocked because route weather risk is RED",
					allowed: false,
					routeId: "route-1",
					riskLevel: RiskLevel.RED,
					assessmentTime,
					compositeScore: 1.4,
				});

				const reasons = errResponse.reasons as Array<Record<string, unknown>>;
				expect(reasons).toHaveLength(2);
				expect(reasons[0].criterion).toBe("rainfall");
				expect(reasons[1].criterion).toBe("thunderstorm");
			}
		});

		it("records audit log entry on blocked registration attempt (BR-200)", async () => {
			const actor = createActor();
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue({ id: "route-1" });
			weatherRiskRepository.findLatestAssessmentForRoute.mockResolvedValue({
				id: "assess-red",
				routeId: "route-1",
				riskLevel: RiskLevel.RED,
				compositeScore: 1.4,
				createdAt: new Date(),
				criteriaScores: {
					wind: { level: RiskLevel.RED, value: 90 },
				},
			});

			await expect(service.assertRegistrationAllowedForRoute(actor, "route-1")).rejects.toThrow(
				ConflictException
			);

			expect(mockDataSource.getRepository).toHaveBeenCalled();
		});
	});

	describe("assertRegistrationAllowedForTrip", () => {
		it("throws NotFoundException if trip is not found", async () => {
			const actor = createActor();
			mockDataSource.query.mockResolvedValue([]);

			await expect(service.assertRegistrationAllowedForTrip(actor, "missing-trip")).rejects.toThrow(
				NotFoundException
			);
		});

		it("asserts eligibility for trip's route when trip has a routeId", async () => {
			const actor = createActor();
			mockDataSource.query.mockResolvedValue([{ id: "trip-1", route_id: "route-1" }]);
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue({ id: "route-1" });
			weatherRiskRepository.findLatestAssessmentForRoute.mockResolvedValue({
				id: "assess-green",
				routeId: "route-1",
				riskLevel: RiskLevel.GREEN,
				compositeScore: 0.1,
				createdAt: new Date(),
				criteriaScores: {},
			});

			const result = await service.assertRegistrationAllowedForTrip(actor, "trip-1");
			expect(result.allowed).toBe(true);
		});

		it("rejects when trip's linked route risk level is RED", async () => {
			const actor = createActor();
			mockDataSource.query.mockResolvedValue([{ id: "trip-1", route_id: "route-1" }]);
			weatherSnapshotsRepository.findRouteForFetch.mockResolvedValue({ id: "route-1" });
			weatherRiskRepository.findLatestAssessmentForRoute.mockResolvedValue({
				id: "assess-red",
				routeId: "route-1",
				riskLevel: RiskLevel.RED,
				compositeScore: 1.6,
				createdAt: new Date(),
				criteriaScores: {
					rainfall: { level: RiskLevel.RED, value: 100 },
				},
			});

			await expect(service.assertRegistrationAllowedForTrip(actor, "trip-1")).rejects.toThrow(
				ConflictException
			);
		});
	});
});
