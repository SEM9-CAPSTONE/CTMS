import {
	Injectable,
	Logger,
	type OnApplicationBootstrap,
	type OnApplicationShutdown,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { TripStatusScheduleService } from "./trip-status-schedule.service";

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_BATCH_SIZE = 100;

interface UnrefTimer {
	unref?: () => void;
}

/** Mirrors `TripAutoCancelWorker`: env-gated, overlap-guarded `setInterval` tick with
 *  graceful shutdown draining. */
@Injectable()
export class TripStatusScheduleWorker implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger(TripStatusScheduleWorker.name);
	private timer: ReturnType<typeof setInterval> | null = null;
	private activeTick: Promise<void> | null = null;
	private shuttingDown = false;

	constructor(
		private readonly configService: ConfigService,
		private readonly scheduleService: TripStatusScheduleService
	) {}

	onApplicationBootstrap(): void {
		if (!this.isEnabled()) return;
		const intervalMs = this.positiveInteger("TRIP_STATUS_WORKER_INTERVAL_MS", DEFAULT_INTERVAL_MS);
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

	private startTick(): void {
		if (this.shuttingDown || this.activeTick !== null) return;
		const batchSize = this.positiveInteger("TRIP_STATUS_WORKER_BATCH_SIZE", DEFAULT_BATCH_SIZE);
		this.activeTick = this.scheduleService
			.advanceDueTrips(batchSize)
			.then(() => undefined)
			.catch((error: unknown) => {
				const message = error instanceof Error ? error.message : "Unknown worker error";
				this.logger.error(`Trip status schedule tick failed: ${message}`);
			})
			.finally(() => {
				this.activeTick = null;
			});
	}

	private isEnabled(): boolean {
		return (
			this.configService.get<string>("TRIP_STATUS_WORKER_ENABLED")?.trim().toLowerCase() === "true"
		);
	}

	private positiveInteger(key: string, fallback: number): number {
		const value = Number(this.configService.get<string>(key));
		return Number.isSafeInteger(value) && value > 0 ? value : fallback;
	}
}
