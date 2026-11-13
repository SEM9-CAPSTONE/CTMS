import {
	Injectable,
	Logger,
	type OnApplicationBootstrap,
	type OnApplicationShutdown,
	Optional,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { TripWeatherAiReviewService } from "./trip-weather-ai-review.service";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { TripWeatherMonitorService } from "./trip-weather-monitor.service";

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 50;
const CLEANUP_EVERY_MS = 24 * 60 * 60 * 1000;

interface UnrefTimer {
	unref?: () => void;
}

/**
 * Runs `TripWeatherMonitorService` (then the hybrid AI review of new forecasts) on an interval when `TRIP_WEATHER_MONITOR_WORKER_ENABLED=true`.
 * Each tick only re-forecasts the Trips that are due, so a short interval does not mean frequent
 * provider calls. History trimming runs at most once a day.
 */
@Injectable()
export class TripWeatherMonitorWorker implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger(TripWeatherMonitorWorker.name);
	private timer: ReturnType<typeof setInterval> | null = null;
	private activeTick: Promise<void> | null = null;
	private lastCleanupAt: number | null = null;
	private shuttingDown = false;

	constructor(
		private readonly configService: ConfigService,
		private readonly monitor: TripWeatherMonitorService,
		@Optional() private readonly aiReview?: TripWeatherAiReviewService
	) {}

	onApplicationBootstrap(): void {
		if (!this.isEnabled()) return;
		const intervalMs = this.positiveInteger(
			"TRIP_WEATHER_MONITOR_INTERVAL_MS",
			DEFAULT_INTERVAL_MS
		);
		this.timer = setInterval(() => this.startTick(), intervalMs);
		(this.timer as UnrefTimer).unref?.();
		this.startTick();
	}

	async onApplicationShutdown(): Promise<void> {
		this.shuttingDown = true;
		if (this.timer !== null) {
			clearInterval(this.timer);
			this.timer = null;
		}
		await this.activeTick;
	}

	/** Exposed for tests: one monitoring pass (plus the daily trim when it is due). */
	startTick(now: () => Date = () => new Date()): Promise<void> | null {
		if (this.shuttingDown || this.activeTick !== null) return this.activeTick;
		const batchSize = this.positiveInteger("TRIP_WEATHER_MONITOR_BATCH_SIZE", DEFAULT_BATCH_SIZE);
		this.activeTick = this.tick(batchSize, now())
			.catch((error: unknown) => {
				const message = error instanceof Error ? error.message : "Unknown worker error";
				this.logger.error(`Trip weather monitor tick failed: ${message}`);
			})
			.finally(() => {
				this.activeTick = null;
			});
		return this.activeTick;
	}

	private async tick(batchSize: number, now: Date): Promise<void> {
		await this.monitor.checkDueTrips(batchSize, now);
		// Hybrid risk: new forecasts get an independent AI opinion. Never blocks the monitor itself.
		await this.aiReview?.reviewPending(now).catch((error: unknown) => {
			const message = error instanceof Error ? error.message : "Unknown AI review error";
			this.logger.warn(`AI weather review pass failed: ${message}`);
		});
		if (this.lastCleanupAt === null || now.getTime() - this.lastCleanupAt >= CLEANUP_EVERY_MS) {
			this.lastCleanupAt = now.getTime();
			await this.monitor.trimEndedTripHistory(now);
		}
	}

	private isEnabled(): boolean {
		return (
			this.configService
				.get<string>("TRIP_WEATHER_MONITOR_WORKER_ENABLED")
				?.trim()
				.toLowerCase() === "true"
		);
	}

	private positiveInteger(key: string, fallback: number): number {
		const value = Number(this.configService.get<string>(key));
		return Number.isInteger(value) && value > 0 ? value : fallback;
	}
}
