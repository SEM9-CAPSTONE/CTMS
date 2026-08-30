import {
	ConflictException,
	ForbiddenException,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserStatus } from "../../users/entities/user.entity";
import { WeatherSnapshotStatus } from "../entities/weather-snapshot.entity";
import type { WeatherReading } from "../providers/weather-provider.interface";
import { WeatherProviderError } from "../providers/weather-provider.interface";
import type { RouteForWeatherFetch } from "../repositories/weather-snapshots.repository";
import { WeatherService } from "./weather.service";

function actor(roles: string[], userId = "actor-1"): AuthenticatedUser {
	return { userId, roles, status: UserStatus.ACTIVE };
}

function route(overrides: Partial<RouteForWeatherFetch> = {}): RouteForWeatherFetch {
	return {
		id: "route-1",
		status: "active",
		hostId: "host-1",
		centroid: [108.46, 11.94],
		...overrides,
	};
}

function reading(overrides: Partial<WeatherReading> = {}): WeatherReading {
	return {
		observedAt: new Date("2026-08-29T11:30:00Z"),
		rainfallMm: 0,
		windKph: 10.4,
		temperatureC: 32.2,
		visibilityM: 23780,
		thunderstorm: false,
		providerWeatherCode: 3,
		raw: { current: {} },
		...overrides,
	};
}

describe("WeatherService", () => {
	let repository: {
		findRouteForFetch: jest.Mock;
		createSuccess: jest.Mock;
		createFailed: jest.Mock;
		findLatestForRoute: jest.Mock;
	};
	let provider: { fetchCurrent: jest.Mock };
	let service: WeatherService;

	beforeEach(() => {
		repository = {
			findRouteForFetch: jest.fn(),
			createSuccess: jest.fn(),
			createFailed: jest.fn(),
			findLatestForRoute: jest.fn(),
		};
		provider = { fetchCurrent: jest.fn() };
		service = new WeatherService(repository as never, provider as never);
	});

	describe("refreshForRoute", () => {
		it("throws NotFoundException when the route does not exist", async () => {
			repository.findRouteForFetch.mockResolvedValue(null);

			await expect(service.refreshForRoute(actor(["host"]), "missing")).rejects.toThrow(
				NotFoundException
			);
			expect(provider.fetchCurrent).not.toHaveBeenCalled();
		});

		it("throws ForbiddenException when a Host does not own the route", async () => {
			repository.findRouteForFetch.mockResolvedValue(route({ hostId: "someone-else" }));

			await expect(service.refreshForRoute(actor(["host"], "actor-1"), "route-1")).rejects.toThrow(
				ForbiddenException
			);
			expect(provider.fetchCurrent).not.toHaveBeenCalled();
		});

		it("lets an Admin bypass ownership entirely", async () => {
			repository.findRouteForFetch.mockResolvedValue(route({ hostId: "someone-else" }));
			provider.fetchCurrent.mockResolvedValue(reading());
			repository.createSuccess.mockResolvedValue({
				id: "snap-1",
				routeId: "route-1",
				status: WeatherSnapshotStatus.SUCCESS,
				...reading(),
				providerResponse: {},
				errorMessage: null,
				createdAt: new Date(),
			});

			await expect(
				service.refreshForRoute(actor(["admin"], "admin-1"), "route-1")
			).resolves.toBeDefined();
		});

		it("throws ConflictException for a non-active route, and never calls the provider (BR-243)", async () => {
			repository.findRouteForFetch.mockResolvedValue(route({ status: "draft" }));

			await expect(service.refreshForRoute(actor(["host"], "host-1"), "route-1")).rejects.toThrow(
				ConflictException
			);
			expect(provider.fetchCurrent).not.toHaveBeenCalled();
			expect(repository.createSuccess).not.toHaveBeenCalled();
			expect(repository.createFailed).not.toHaveBeenCalled();
		});

		it("persists exactly one success row and returns it on a successful fetch", async () => {
			repository.findRouteForFetch.mockResolvedValue(route());
			provider.fetchCurrent.mockResolvedValue(reading());
			const saved = {
				id: "snap-1",
				routeId: "route-1",
				status: WeatherSnapshotStatus.SUCCESS,
				...reading(),
				providerResponse: {},
				errorMessage: null,
				createdAt: new Date(),
			};
			repository.createSuccess.mockResolvedValue(saved);

			const result = await service.refreshForRoute(actor(["host"], "host-1"), "route-1");

			expect(provider.fetchCurrent).toHaveBeenCalledTimes(1);
			expect(provider.fetchCurrent).toHaveBeenCalledWith(11.94, 108.46);
			expect(repository.createSuccess).toHaveBeenCalledTimes(1);
			expect(repository.createFailed).not.toHaveBeenCalled();
			expect(result.id).toBe("snap-1");
		});

		it("retries a transient failure and succeeds without writing a failed row", async () => {
			repository.findRouteForFetch.mockResolvedValue(route());
			provider.fetchCurrent
				.mockRejectedValueOnce(new WeatherProviderError("boom"))
				.mockResolvedValueOnce(reading());
			repository.createSuccess.mockResolvedValue({ id: "snap-1" });

			await service.refreshForRoute(actor(["host"], "host-1"), "route-1");

			expect(provider.fetchCurrent).toHaveBeenCalledTimes(2);
			expect(repository.createFailed).not.toHaveBeenCalled();
			expect(repository.createSuccess).toHaveBeenCalledTimes(1);
		}, 10000);

		it("gives up after 3 attempts, persists exactly one FAILED row, and throws ServiceUnavailableException", async () => {
			repository.findRouteForFetch.mockResolvedValue(route());
			provider.fetchCurrent.mockRejectedValue(new WeatherProviderError("provider down"));
			repository.createFailed.mockResolvedValue({ id: "snap-failed" });

			await expect(service.refreshForRoute(actor(["host"], "host-1"), "route-1")).rejects.toThrow(
				ServiceUnavailableException
			);

			expect(provider.fetchCurrent).toHaveBeenCalledTimes(3);
			expect(repository.createFailed).toHaveBeenCalledTimes(1);
			expect(repository.createFailed).toHaveBeenCalledWith({
				routeId: "route-1",
				errorMessage: "provider down",
			});
			expect(repository.createSuccess).not.toHaveBeenCalled();
		}, 10000);
	});

	describe("getLatestForRoute", () => {
		it("throws NotFoundException when the route does not exist", async () => {
			repository.findRouteForFetch.mockResolvedValue(null);

			await expect(service.getLatestForRoute(actor(["host"]), "missing")).rejects.toThrow(
				NotFoundException
			);
		});

		it("throws ForbiddenException when a Host does not own the route", async () => {
			repository.findRouteForFetch.mockResolvedValue(route({ hostId: "someone-else" }));

			await expect(
				service.getLatestForRoute(actor(["host"], "actor-1"), "route-1")
			).rejects.toThrow(ForbiddenException);
		});

		it("returns null when no snapshot has ever been recorded", async () => {
			repository.findRouteForFetch.mockResolvedValue(route());
			repository.findLatestForRoute.mockResolvedValue(null);

			const result = await service.getLatestForRoute(actor(["host"], "host-1"), "route-1");
			expect(result).toBeNull();
		});

		it("returns the mapped latest snapshot when one exists", async () => {
			repository.findRouteForFetch.mockResolvedValue(route());
			repository.findLatestForRoute.mockResolvedValue({
				id: "snap-1",
				routeId: "route-1",
				status: WeatherSnapshotStatus.SUCCESS,
				...reading(),
				providerResponse: {},
				errorMessage: null,
				createdAt: new Date(),
			});

			const result = await service.getLatestForRoute(actor(["host"], "host-1"), "route-1");
			expect(result?.id).toBe("snap-1");
		});
	});
});
