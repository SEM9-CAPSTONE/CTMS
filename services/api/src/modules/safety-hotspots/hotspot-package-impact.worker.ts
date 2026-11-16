import {
	Injectable,
	Logger,
	type OnApplicationBootstrap,
	type OnApplicationShutdown,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { HotspotPackageImpactDispatcher } from "./hotspot-package-impact.dispatcher";

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;

interface UnrefTimer {
	unref?: () => void;
}

/**
 * CTMS-118: re-requests Offline Safety Package impacts for corrections whose hand-over did not
 * complete after commit. Enabled with `SAFETY_HOTSPOT_IMPACT_RETRY_WORKER_ENABLED=true`
 * (every 15 minutes by default, `SAFETY_HOTSPOT_IMPACT_RETRY_INTERVAL_MS`). It only requests
 * package jobs and never changes Route or safety data (BR-356).
 */
@Injectable()
export class HotspotPackageImpactWorker implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger(HotspotPackageImpactWorker.name);
	private timer: ReturnType<typeof setInterval> | null = null;
	private activeTick: Promise<void> | null = null;
	private shuttingDown = false;

	constructor(
		private readonly configService: ConfigService,
		private readonly dispatcher: HotspotPackageImpactDispatcher
	) {}

	onApplicationBootstrap(): void {
		const enabled =
			this.configService
				.get<string>("SAFETY_HOTSPOT_IMPACT_RETRY_WORKER_ENABLED")
				?.trim()
				.toLowerCase() === "true";
		if (!enabled) return;
		const value = Number(this.configService.get<string>("SAFETY_HOTSPOT_IMPACT_RETRY_INTERVAL_MS"));
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

	/** Exposed for tests: one retry pass. */
	startTick(): Promise<void> | null {
		if (this.shuttingDown || this.activeTick !== null) return this.activeTick;
		this.activeTick = this.dispatcher
			.retryPending()
			.then((count) => {
				if (count > 0)
					this.logger.log(`Requested package impact for ${count} safety correction(s)`);
			})
			.catch((error: unknown) => {
				const message = error instanceof Error ? error.message : "Unknown worker error";
				this.logger.error(`Safety correction package impact retry failed: ${message}`);
			})
			.finally(() => {
				this.activeTick = null;
			});
		return this.activeTick;
	}
}
