import { ConflictException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
import { toTripWeatherForecastResponse } from "../dto/trip-weather-forecast-response.dto";
import {
	type TripWeatherForecast,
	TripWeatherForecastStatus,
} from "../entities/trip-weather-forecast.entity";
import { RiskLevel } from "../entities/weather-risk-assessment.entity";
import {
	WeatherRiskReviewError,
	type WeatherRiskReviewProvider,
} from "../providers/weather-risk-review.provider";
import type { TripWeatherForecastsRepository } from "../repositories/trip-weather-forecasts.repository";
import {
	TripWeatherAiReviewService,
	WEATHER_AI_REVIEW_MAX_ATTEMPTS,
	levelGap,
} from "./trip-weather-ai-review.service";
import { TripWeatherMonitorWorker } from "./trip-weather-monitor.worker";

const NOW = new Date("2026-11-13T03:00:00.000Z");
const admin: AuthenticatedUser = {
	userId: "admin-1",
	email: "admin@ctms.local",
	roles: [UserRole.ADMIN],
} as AuthenticatedUser;

function forecast(overrides: Partial<TripWeatherForecast> = {}): TripWeatherForecast {
	return {
		id: "f-1",
		tripId: "t-1",
		routeId: "r-1",
		status: TripWeatherForecastStatus.AVAILABLE,
		tripStartsAt: new Date("2026-11-15T00:00:00.000Z"),
		tripEndsAt: new Date("2026-11-16T00:00:00.000Z"),
		forecastFrom: new Date("2026-11-15T00:00:00.000Z"),
		forecastTo: new Date("2026-11-16T00:00:00.000Z"),
		worstReading: {
			rainfallMm: 62,
			rainfallAt: "2026-11-15T05:00:00.000Z",
			windKph: 18,
			windAt: "2026-11-15T05:00:00.000Z",
			temperatureC: 24,
			temperatureAt: "2026-11-15T05:00:00.000Z",
			visibilityM: 8000,
			visibilityAt: "2026-11-15T05:00:00.000Z",
			thunderstorm: true,
			thunderstormAt: "2026-11-15T05:00:00.000Z",
			hoursCovered: 24,
		},
		ruleVersionId: "rule-1",
		riskLevel: RiskLevel.RED,
		compositeScore: 1.4,
		criteriaScores: null,
		providerResponse: null,
		adviceText: null,
		adviceActions: null,
		adviceGeneratedAt: null,
		aiRiskLevel: null,
		aiReason: null,
		aiConfidence: null,
		aiModel: null,
		aiReviewedAt: null,
		aiReviewAttempts: 0,
		aiReviewAcknowledgedAt: null,
		aiReviewAcknowledgedBy: null,
		createdBy: "host-1",
		checkedAt: NOW,
		createdAt: NOW,
		...overrides,
	};
}

function setup(options: { configured?: boolean; pending?: TripWeatherForecast[] } = {}) {
	const repository = {
		findPendingAiReviews: jest.fn().mockResolvedValue(options.pending ?? [forecast()]),
		saveAiReview: jest.fn().mockResolvedValue(true),
		recordAiReviewFailure: jest.fn().mockResolvedValue(undefined),
		findAiMismatches: jest.fn().mockResolvedValue([]),
		findOneBy: jest.fn(),
		acknowledgeAiReview: jest.fn().mockResolvedValue(true),
	};
	const provider: jest.Mocked<WeatherRiskReviewProvider> = {
		isConfigured: jest.fn().mockReturnValue(options.configured ?? true),
		review: jest.fn().mockResolvedValue({
			level: RiskLevel.GREEN,
			reason: "Mưa ngắn, gió nhẹ.",
			confidence: 0.7,
			model: "gpt-4o-mini",
		}),
	};
	const service = new TripWeatherAiReviewService(
		repository as unknown as TripWeatherForecastsRepository,
		provider
	);
	return { service, repository, provider };
}

describe("TripWeatherAiReviewService.reviewPending", () => {
	it("skips everything when the AI service is not configured", async () => {
		const { service, repository, provider } = setup({ configured: false });
		await expect(service.reviewPending(NOW)).resolves.toEqual({
			reviewed: 0,
			failed: 0,
			skipped: true,
		});
		expect(repository.findPendingAiReviews).not.toHaveBeenCalled();
		expect(provider.review).not.toHaveBeenCalled();
	});

	it("sends only the raw worst-hour readings and stores the opinion", async () => {
		const { service, repository, provider } = setup();
		await expect(service.reviewPending(NOW)).resolves.toEqual({
			reviewed: 1,
			failed: 0,
			skipped: false,
		});
		expect(repository.findPendingAiReviews).toHaveBeenCalledWith(
			NOW,
			20,
			WEATHER_AI_REVIEW_MAX_ATTEMPTS
		);
		expect(provider.review).toHaveBeenCalledWith({
			rainfallMm: 62,
			windKph: 18,
			temperatureC: 24,
			visibilityM: 8000,
			thunderstorm: true,
			hoursCovered: 24,
		});
		expect(repository.saveAiReview).toHaveBeenCalledWith(
			"f-1",
			expect.objectContaining({ level: RiskLevel.GREEN, model: "gpt-4o-mini" }),
			NOW
		);
	});

	it("counts a retryable failure without giving up on the forecast", async () => {
		const { service, repository, provider } = setup();
		provider.review.mockRejectedValue(new WeatherRiskReviewError("provider_http_503", true));
		await expect(service.reviewPending(NOW)).resolves.toMatchObject({ reviewed: 0, failed: 1 });
		expect(repository.recordAiReviewFailure).toHaveBeenCalledWith(
			"f-1",
			WEATHER_AI_REVIEW_MAX_ATTEMPTS,
			false
		);
		expect(repository.saveAiReview).not.toHaveBeenCalled();
	});

	it("stops retrying a forecast after a permanent failure", async () => {
		const { service, repository, provider } = setup();
		provider.review.mockRejectedValue(new WeatherRiskReviewError("provider_http_422", false));
		await service.reviewPending(NOW);
		expect(repository.recordAiReviewFailure).toHaveBeenCalledWith(
			"f-1",
			WEATHER_AI_REVIEW_MAX_ATTEMPTS,
			true
		);
	});

	it("stops the pass when the AI service rejects the token", async () => {
		const { service, provider } = setup({
			pending: [forecast({ id: "f-1" }), forecast({ id: "f-2" })],
		});
		provider.review.mockRejectedValue(new WeatherRiskReviewError("provider_http_401", false));
		await service.reviewPending(NOW);
		expect(provider.review).toHaveBeenCalledTimes(1);
	});

	it("ignores rows without readings", async () => {
		const { service, provider } = setup({ pending: [forecast({ worstReading: null })] });
		await service.reviewPending(NOW);
		expect(provider.review).not.toHaveBeenCalled();
	});
});

describe("TripWeatherAiReviewService.listMismatches", () => {
	it("maps rows and computes the level gap", async () => {
		const { service, repository } = setup();
		repository.findAiMismatches.mockResolvedValue([
			{
				forecastId: "f-1",
				tripId: "t-1",
				tripTitle: "Bà Nà",
				tripStatus: "published",
				tripStartsAt: NOW,
				hostId: "h-1",
				hostName: "Host",
				riskLevel: "red",
				aiRiskLevel: "green",
				aiReason: "Mưa ngắn.",
				aiConfidence: "0.8",
				aiReviewedAt: NOW,
				worstReading: null,
				ruleVersion: "3",
			},
		]);
		const [row] = await service.listMismatches(NOW);
		expect(row).toMatchObject({ gap: 2, aiConfidence: 0.8, ruleVersion: 3 });
		expect(repository.findAiMismatches).toHaveBeenCalledWith(NOW, 100);
	});
});

describe("TripWeatherAiReviewService.acknowledge", () => {
	it("404s for an unknown forecast", async () => {
		const { service, repository } = setup();
		repository.findOneBy.mockResolvedValue(null);
		await expect(service.acknowledge(admin, "f-x", NOW)).rejects.toBeInstanceOf(NotFoundException);
	});

	it("409s when the AI agrees with the thresholds", async () => {
		const { service, repository } = setup();
		repository.findOneBy.mockResolvedValue(
			forecast({ aiRiskLevel: RiskLevel.RED, aiReviewedAt: NOW })
		);
		await expect(service.acknowledge(admin, "f-1", NOW)).rejects.toBeInstanceOf(ConflictException);
	});

	it("marks a disagreement as seen", async () => {
		const { service, repository } = setup();
		repository.findOneBy.mockResolvedValue(
			forecast({ aiRiskLevel: RiskLevel.GREEN, aiReviewedAt: NOW })
		);
		await expect(service.acknowledge(admin, "f-1", NOW)).resolves.toEqual({
			forecastId: "f-1",
			acknowledgedAt: NOW,
		});
		expect(repository.acknowledgeAiReview).toHaveBeenCalledWith("f-1", "admin-1", NOW);
	});

	it("is idempotent once acknowledged", async () => {
		const { service, repository } = setup();
		const seenAt = new Date("2026-11-12T00:00:00.000Z");
		repository.findOneBy.mockResolvedValue(
			forecast({ aiRiskLevel: RiskLevel.GREEN, aiReviewedAt: NOW, aiReviewAcknowledgedAt: seenAt })
		);
		await expect(service.acknowledge(admin, "f-1", NOW)).resolves.toEqual({
			forecastId: "f-1",
			acknowledgedAt: seenAt,
		});
		expect(repository.acknowledgeAiReview).not.toHaveBeenCalled();
	});
});

describe("levelGap", () => {
	it("measures how far two levels are apart", () => {
		expect(levelGap(RiskLevel.GREEN, RiskLevel.RED)).toBe(2);
		expect(levelGap(RiskLevel.YELLOW, RiskLevel.RED)).toBe(1);
		expect(levelGap(RiskLevel.RED, RiskLevel.RED)).toBe(0);
		expect(levelGap(null, RiskLevel.RED)).toBe(0);
	});
});

describe("toTripWeatherForecastResponse aiReview", () => {
	const reviewed = forecast({
		aiRiskLevel: RiskLevel.GREEN,
		aiReason: "Mưa ngắn.",
		aiConfidence: 0.7,
		aiModel: "m",
		aiReviewedAt: NOW,
	});

	it("is hidden unless the caller is the Host or an Admin", () => {
		expect(toTripWeatherForecastResponse(reviewed, 15).aiReview).toBeNull();
	});

	it("carries the opinion and whether it matches the thresholds", () => {
		expect(toTripWeatherForecastResponse(reviewed, 15, { includeAiReview: true }).aiReview).toEqual(
			{
				level: RiskLevel.GREEN,
				reason: "Mưa ngắn.",
				confidence: 0.7,
				reviewedAt: NOW,
				matchesRule: false,
				acknowledgedAt: null,
			}
		);
	});

	it("never changes the official level", () => {
		expect(toTripWeatherForecastResponse(reviewed, 15, { includeAiReview: true }).riskLevel).toBe(
			RiskLevel.RED
		);
	});
});

describe("TripWeatherMonitorWorker with the hybrid AI review", () => {
	function build(review: jest.Mock) {
		const config = { get: jest.fn(() => undefined) } as unknown as ConfigService;
		const monitor = {
			checkDueTrips: jest.fn().mockResolvedValue({ checked: 0, failed: 0 }),
			trimEndedTripHistory: jest.fn().mockResolvedValue(0),
		};
		const aiReview = { reviewPending: review };
		const worker = new TripWeatherMonitorWorker(config, monitor as never, aiReview as never);
		return { worker, monitor };
	}

	it("reviews new forecasts after each monitoring pass", async () => {
		const review = jest.fn().mockResolvedValue({ reviewed: 1, failed: 0, skipped: false });
		const { worker, monitor } = build(review);
		await worker.startTick(() => NOW);
		expect(monitor.checkDueTrips).toHaveBeenCalled();
		expect(review).toHaveBeenCalledWith(NOW);
	});

	it("keeps trimming history when the AI review pass fails", async () => {
		const { worker, monitor } = build(jest.fn().mockRejectedValue(new Error("ai down")));
		await worker.startTick(() => NOW);
		expect(monitor.trimEndedTripHistory).toHaveBeenCalledWith(NOW);
	});
});
