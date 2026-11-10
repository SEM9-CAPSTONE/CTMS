import {
	Injectable,
	Logger,
	type OnApplicationBootstrap,
	type OnApplicationShutdown,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { RealtimeEventsService } from "./realtime-events.service";

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

interface UnrefTimer {
	unref?: () => void;
}

/**
 * CTMS-082: removes real-time events older than the recovery window when
 * `REALTIME_EVENT_PRUNE_WORKER_ENABLED=true`. Recovery already ignores expired rows, so a missed
 * run only keeps the table larger for a while.
 */
@Injectable()
export class RealtimeEventPruneWorker implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger(RealtimeEventPruneWorker.name);
	private timer: ReturnType<typeof setInterval> | null = null;
	private activeTick: Promise<void> | null = null;
	private shuttingDown = false;

	constructor(
		private readonly configService: ConfigService,
		private readonly events: RealtimeEventsService
	) {}

	onApplicationBootstrap(): void {
		if (!this.isEnabled()) return;
		const value = Number(this.configService.get<string>("REALTIME_EVENT_PRUNE_INTERVAL_MS"));
		const intervalMs = Number.isInteger(value) && value > 0 ? value : DEFAULT_INTERVAL_MS;
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

	/** Exposed for tests: one prune pass. */
	startTick(now: () => Date = () => new Date()): Promise<void> | null {
		if (this.shuttingDown || this.activeTick !== null) return this.activeTick;
		this.activeTick = this.events
			.prune(now())
			.then((removed) => {
				if (removed > 0) this.logger.debug(`Pruned ${removed} expired real-time events`);
			})
			.catch((error: unknown) => {
				const message = error instanceof Error ? error.message : "Unknown worker error";
				this.logger.error(`Real-time event prune failed: ${message}`);
			})
			.finally(() => {
				this.activeTick = null;
			});
		return this.activeTick;
	}

	private isEnabled(): boolean {
		return (
			this.configService
				.get<string>("REALTIME_EVENT_PRUNE_WORKER_ENABLED")
				?.trim()
				.toLowerCase() === "true"
		);
	}
}
