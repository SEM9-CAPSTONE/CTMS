import {
	Injectable,
	Logger,
	type OnApplicationBootstrap,
	type OnApplicationShutdown,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { RouteDeviationAnalysisService } from "./route-deviation-analysis.service";

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 20;

interface UnrefTimer {
	unref?: () => void;
}

/**
 * CTMS-115: analyses completed Trips in the background when
 * `ROUTE_DEVIATION_ANALYSIS_WORKER_ENABLED=true`. Same shape as `TripStatusScheduleWorker`:
 * env-gated, one tick at a time, drained on shutdown.
 */
@Injectable()
export class RouteDeviationAnalysisWorker implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger(RouteDeviationAnalysisWorker.name);
	private timer: ReturnType<typeof setInterval> | null = null;
	private activeTick: Promise<void> | null = null;
	private shuttingDown = false;

	constructor(
		private readonly configService: ConfigService,
		private readonly analysisService: RouteDeviationAnalysisService
	) {}

	onApplicationBootstrap(): void {
		if (!this.isEnabled()) return;
		const intervalMs = this.positiveInteger(
			"ROUTE_DEVIATION_ANALYSIS_INTERVAL_MS",
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

	/** Exposed for tests: one analysis pass. */
	startTick(): Promise<void> | null {
		if (this.shuttingDown || this.activeTick !== null) return this.activeTick;
		const batchSize = this.positiveInteger(
			"ROUTE_DEVIATION_ANALYSIS_BATCH_SIZE",
			DEFAULT_BATCH_SIZE
		);
		this.activeTick = this.analysisService
			.analyzeDueTrips(batchSize)
			.then(() => undefined)
			.catch((error: unknown) => {
				const message = error instanceof Error ? error.message : "Unknown worker error";
				this.logger.error(`Route deviation analysis tick failed: ${message}`);
			})
			.finally(() => {
				this.activeTick = null;
			});
		return this.activeTick;
	}

	private isEnabled(): boolean {
		return (
			this.configService
				.get<string>("ROUTE_DEVIATION_ANALYSIS_WORKER_ENABLED")
				?.trim()
				.toLowerCase() === "true"
		);
	}

	private positiveInteger(key: string, fallback: number): number {
		const value = Number(this.configService.get<string>(key));
		return Number.isSafeInteger(value) && value > 0 ? value : fallback;
	}
}
