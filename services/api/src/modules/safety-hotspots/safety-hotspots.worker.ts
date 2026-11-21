import {
	Injectable,
	Logger,
	type OnApplicationBootstrap,
	type OnApplicationShutdown,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { SafetyHotspotsService } from "./safety-hotspots.service";

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface UnrefTimer {
	unref?: () => void;
}

/**
 * CTMS-116: runs hotspot detection in the background when
 * `SAFETY_HOTSPOT_DETECTION_WORKER_ENABLED=true` (daily by default,
 * `SAFETY_HOTSPOT_DETECTION_INTERVAL_MS`). One pass at a time, drained on shutdown.
 */
@Injectable()
export class SafetyHotspotsWorker implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger(SafetyHotspotsWorker.name);
	private timer: ReturnType<typeof setInterval> | null = null;
	private activeTick: Promise<void> | null = null;
	private shuttingDown = false;

	constructor(
		private readonly configService: ConfigService,
		private readonly hotspots: SafetyHotspotsService
	) {}

	onApplicationBootstrap(): void {
		if (!this.isEnabled()) return;
		const value = Number(this.configService.get<string>("SAFETY_HOTSPOT_DETECTION_INTERVAL_MS"));
		const intervalMs = Number.isSafeInteger(value) && value > 0 ? value : DEFAULT_INTERVAL_MS;
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

	/** Exposed for tests: one detection pass. */
	startTick(): Promise<void> | null {
		if (this.shuttingDown || this.activeTick !== null) return this.activeTick;
		this.activeTick = this.hotspots
			.detect(null)
			.then((result) => {
				if (result.candidatesCreated > 0) {
					this.logger.log(`Detected ${result.candidatesCreated} potential safety hotspot(s)`);
				}
			})
			.catch((error: unknown) => {
				const message = error instanceof Error ? error.message : "Unknown worker error";
				this.logger.error(`Safety hotspot detection failed: ${message}`);
			})
			.finally(() => {
				this.activeTick = null;
			});
		return this.activeTick;
	}

	private isEnabled(): boolean {
		return (
			this.configService
				.get<string>("SAFETY_HOTSPOT_DETECTION_WORKER_ENABLED")
				?.trim()
				.toLowerCase() === "true"
		);
	}
}
