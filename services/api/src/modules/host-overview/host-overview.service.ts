import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { ConfigService } from "@nestjs/config";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import type { HostOverviewQueryDto } from "./host-overview.dto";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { HostOverviewRepository } from "./host-overview.repository";
import {
	type HostOverview,
	OverviewAvailability,
	type OverviewPage,
	type OverviewSection,
} from "./host-overview.types";

const DEFAULT_TIME_ZONE = "Asia/Ho_Chi_Minh";
const DEFAULT_WEATHER_MAX_AGE_SECONDS = 3600;

@Injectable()
export class HostOverviewService {
	private readonly logger = new Logger(HostOverviewService.name);
	private readonly timeZone: string;
	private readonly weatherMaxAgeSeconds: number;

	constructor(
		private readonly repository: HostOverviewRepository,
		config: ConfigService
	) {
		this.timeZone = config.get<string>("HOST_OVERVIEW_TIME_ZONE") ?? DEFAULT_TIME_ZONE;
		// Invalid deployment configuration must fail startup rather than produce misleading dates.
		new Intl.DateTimeFormat("en-CA", { timeZone: this.timeZone }).format();
		this.weatherMaxAgeSeconds = Number(
			config.get<string>("HOST_OVERVIEW_WEATHER_MAX_AGE_SECONDS") ?? DEFAULT_WEATHER_MAX_AGE_SECONDS
		);
		if (!Number.isFinite(this.weatherMaxAgeSeconds) || this.weatherMaxAgeSeconds <= 0) {
			throw new Error("HOST_OVERVIEW_WEATHER_MAX_AGE_SECONDS must be positive");
		}
	}

	async getOverview(actor: AuthenticatedUser, query: HostOverviewQueryDto): Promise<HostOverview> {
		if (actor.status !== UserStatus.ACTIVE || !actor.roles.includes(UserRole.HOST)) {
			throw new ForbiddenException("Chỉ Host đang hoạt động được xem tổng quan vận hành");
		}
		const at = new Date().toISOString();
		const { page, limit } = query;
		const hostId = actor.userId;
		const [bookings, activeTrips, routes, porters, sos, weather] = await Promise.all([
			this.read("bookings", () => this.repository.bookings(hostId, at, this.timeZone, page, limit)),
			this.read("trips", () => this.repository.trips(hostId, page, limit)),
			this.read("trekking_routes", () => this.repository.routes(hostId, page, limit)),
			this.read("trip_porters", () => this.repository.porters(hostId, page, limit)),
			this.read("sos_alerts", () => this.repository.sos(hostId, page, limit)),
			this.read("weather_risk_assessments", () =>
				this.repository.weather(hostId, at, this.weatherMaxAgeSeconds, page, limit)
			),
		]);
		return {
			generatedAt: at,
			timeZone: this.timeZone,
			bookingDate: new Intl.DateTimeFormat("en-CA", {
				timeZone: this.timeZone,
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
			}).format(new Date(at)),
			page,
			limit,
			kpis: {
				todaysBookings: bookings.data?.total ?? null,
				activeTrips: activeTrips.data?.total ?? null,
				routes: routes.data?.total ?? null,
				assignedPorters: porters.data?.total ?? null,
				unresolvedSos: sos.data?.total ?? null,
			},
			bookings,
			activeTrips,
			routes,
			porters,
			sos,
			weather,
		};
	}

	private async read<T>(
		source: string,
		load: () => Promise<OverviewPage<T>>
	): Promise<OverviewSection<T>> {
		try {
			const data = await load();
			return {
				source,
				queriedAt: new Date().toISOString(),
				availability: OverviewAvailability.AVAILABLE,
				data,
			};
		} catch {
			// Do not log raw SQL errors: they may contain participant/location payloads.
			this.logger.warn(`Host overview source unavailable: ${source}`);
			return {
				source,
				queriedAt: new Date().toISOString(),
				availability: OverviewAvailability.UNAVAILABLE,
				data: null,
			};
		}
	}
}
