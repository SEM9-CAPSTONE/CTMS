import {
	Injectable,
	Logger,
	type OnApplicationBootstrap,
	type OnApplicationShutdown,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { TripWeatherDecisionAlertsService } from "./trip-weather-decision-alerts.service";

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 100;

interface UnrefTimer {
	unref?: () => void;
}

/**
 * Sends the policy §5 reminders (T-48h Host, T-24h / T-12h / T-6h Admin) on an interval when
 * `TRIP_WEATHER_DECISION_WORKER_ENABLED=true`. Each reminder is stored once, so a short interval
 * never sends duplicates.
 */
@Injectable()
export class TripWeatherDecisionWorker implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger(TripWeatherDecisionWorker.name);
	private timer: ReturnType<typeof setInterval> | null = null;
	private activeTick: Promise<void> | null = null;
	private shuttingDown = false;

	constructor(
		private readonly configService: ConfigService,
		private readonly alerts: TripWeatherDecisionAlertsService
	) {}

	onApplicationBootstrap(): void {
		if (!this.isEnabled()) return;
		const intervalMs = this.positiveInteger(
			"TRIP_WEATHER_DECISION_INTERVAL_MS",
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

	/** Exposed for tests: one reminder pass. */
	startTick(now: () => Date = () => new Date()): Promise<void> | null {
		if (this.shuttingDown || this.activeTick !== null) return this.activeTick;
		const batchSize = this.positiveInteger("TRIP_WEATHER_DECISION_BATCH_SIZE", DEFAULT_BATCH_SIZE);
		this.activeTick = this.alerts
			.sendDueAlerts(now(), batchSize)
			.then(() => undefined)
			.catch((error: unknown) => {
				const message = error instanceof Error ? error.message : "Unknown worker error";
				this.logger.error(`Trip weather decision tick failed: ${message}`);
			})
			.finally(() => {
				this.activeTick = null;
			});
		return this.activeTick;
	}

	private isEnabled(): boolean {
		return (
			this.configService
				.get<string>("TRIP_WEATHER_DECISION_WORKER_ENABLED")
				?.trim()
				.toLowerCase() === "true"
		);
	}

	private positiveInteger(key: string, fallback: number): number {
		const value = Number(this.configService.get<string>(key));
		return Number.isInteger(value) && value > 0 ? value : fallback;
	}
}
