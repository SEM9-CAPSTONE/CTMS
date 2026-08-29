import {
	ConflictException,
	ForbiddenException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { TrekkingRouteStatus } from "../../trekking-routes/entities/trekking-route.entity";
import { UserRole } from "../../users/entities/user.entity";
import type { WeatherSnapshotResponseDto } from "../dto/weather-snapshot-response.dto";
import type { WeatherSnapshot } from "../entities/weather-snapshot.entity";
import { WEATHER_PROVIDER, type WeatherProvider } from "../providers/weather-provider.interface";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { WeatherSnapshotsRepository } from "../repositories/weather-snapshots.repository";

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [500, 1000, 2000];

function toResponse(snapshot: WeatherSnapshot): WeatherSnapshotResponseDto {
	return {
		id: snapshot.id,
		routeId: snapshot.routeId,
		status: snapshot.status,
		observedAt: snapshot.observedAt,
		rainfallMm: snapshot.rainfallMm,
		windKph: snapshot.windKph,
		temperatureC: snapshot.temperatureC,
		visibilityM: snapshot.visibilityM,
		thunderstorm: snapshot.thunderstorm,
		errorMessage: snapshot.errorMessage,
		createdAt: snapshot.createdAt,
	};
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * CTMS-25-T01. `status` is never part of this service's own decisions
 * beyond gating ACTIVE routes -- search/permission/role logic for Trip or
 * Booking domains is out of scope here (they don't exist yet).
 */
@Injectable()
export class WeatherService {
	private readonly logger = new Logger(WeatherService.name);

	constructor(
		private readonly weatherSnapshotsRepository: WeatherSnapshotsRepository,
		@Inject(WEATHER_PROVIDER) private readonly weatherProvider: WeatherProvider
	) {}

	async refreshForRoute(
		actor: AuthenticatedUser,
		routeId: string
	): Promise<WeatherSnapshotResponseDto> {
		const route = await this.weatherSnapshotsRepository.findRouteForFetch(routeId);
		if (!route) {
			throw new NotFoundException("Trekking route not found");
		}
		this.assertOwnerOrAdmin(actor, route.hostId);
		// BR-243: an unmet business condition (route not active) must not
		// create any side effect -- checked BEFORE any provider call or DB
		// write, not after a wasted network round-trip.
		if (route.status !== TrekkingRouteStatus.ACTIVE) {
			throw new ConflictException("Weather can only be refreshed for an active route");
		}

		const [longitude, latitude] = route.centroid;

		try {
			const reading = await this.fetchWithRetry(latitude, longitude);
			const snapshot = await this.weatherSnapshotsRepository.createSuccess({
				routeId,
				observedAt: reading.observedAt,
				rainfallMm: reading.rainfallMm,
				windKph: reading.windKph,
				temperatureC: reading.temperatureC,
				visibilityM: reading.visibilityM,
				thunderstorm: reading.thunderstorm,
				providerWeatherCode: reading.providerWeatherCode,
				providerResponse: reading.raw,
			});
			return toResponse(snapshot);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown weather provider error";
			this.logger.error(`Weather fetch failed for route ${routeId}: ${message}`);
			// BR-229: record the error, never assume success, never fabricate
			// a reading.
			await this.weatherSnapshotsRepository.createFailed({ routeId, errorMessage: message });
			throw new ServiceUnavailableException(
				"Weather provider is currently unavailable. The failed attempt has been recorded."
			);
		}
	}

	async getLatestForRoute(
		actor: AuthenticatedUser,
		routeId: string
	): Promise<WeatherSnapshotResponseDto | null> {
		const route = await this.weatherSnapshotsRepository.findRouteForFetch(routeId);
		if (!route) {
			throw new NotFoundException("Trekking route not found");
		}
		this.assertOwnerOrAdmin(actor, route.hostId);

		const snapshot = await this.weatherSnapshotsRepository.findLatestForRoute(routeId);
		return snapshot ? toResponse(snapshot) : null;
	}

	/** Mirrors TrekkingRoutesService's own `assertLifecycleActor` split:
	 * Admin bypasses ownership entirely, a Host must be the route's own
	 * owner -- `@Roles(HOST, ADMIN)` on the controller already excludes
	 * every other role before this is ever reached. */
	private assertOwnerOrAdmin(actor: AuthenticatedUser, owningHostId: string): void {
		if (actor.roles.includes(UserRole.ADMIN)) return;
		if (actor.userId !== owningHostId) {
			throw new ForbiddenException("Only the owning Host can access weather for this route");
		}
	}

	/**
	 * BR-230: bounded retries with backoff, entirely in-memory -- only the
	 * final outcome (one success or one recorded failure) ever reaches the
	 * database, so a retry here can never itself create a duplicate row.
	 */
	private async fetchWithRetry(latitude: number, longitude: number) {
		let lastError: unknown;
		for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
			try {
				return await this.weatherProvider.fetchCurrent(latitude, longitude);
			} catch (error) {
				lastError = error;
				if (attempt < MAX_ATTEMPTS - 1) {
					await sleep(BACKOFF_MS[attempt]);
				}
			}
		}
		throw lastError;
	}
}
