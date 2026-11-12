import {
	Injectable,
	Logger,
	type OnApplicationBootstrap,
	type OnApplicationShutdown,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { PushNotificationsService } from "./push-notifications.service";

const DEFAULT_INTERVAL_MS = 15_000;
const DEFAULT_BATCH_SIZE = 50;

interface UnrefTimer {
	unref?: () => void;
}

/**
 * CTMS-090: delivers queued background pushes on an interval when
 * `PUSH_DELIVERY_WORKER_ENABLED=true`. Each row is claimed before it is sent, so overlapping
 * passes or instances never push the same row twice.
 */
@Injectable()
export class PushDeliveryWorker implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger(PushDeliveryWorker.name);
	private timer: ReturnType<typeof setInterval> | null = null;
	private activeTick: Promise<void> | null = null;
	private shuttingDown = false;

	constructor(
		private readonly configService: ConfigService,
		private readonly pushes: PushNotificationsService
	) {}

	onApplicationBootstrap(): void {
		if (!this.isEnabled()) return;
		const intervalMs = this.positiveInteger("PUSH_DELIVERY_INTERVAL_MS", DEFAULT_INTERVAL_MS);
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

	/** Exposed for tests: one delivery pass. */
	startTick(now: () => Date = () => new Date()): Promise<void> | null {
		if (this.shuttingDown || this.activeTick !== null) return this.activeTick;
		const batchSize = this.positiveInteger("PUSH_DELIVERY_BATCH_SIZE", DEFAULT_BATCH_SIZE);
		this.activeTick = this.pushes
			.deliverDue(now(), batchSize)
			.then((report) => {
				if (report.claimed > 0) {
					this.logger.debug(
						`Push pass: ${report.sent} sent, ${report.skipped} skipped, ${report.retried} retried, ${report.failed} failed`
					);
				}
			})
			.catch((error: unknown) => {
				const message = error instanceof Error ? error.message : "Unknown worker error";
				this.logger.error(`Push delivery pass failed: ${message}`);
			})
			.finally(() => {
				this.activeTick = null;
			});
		return this.activeTick;
	}

	private isEnabled(): boolean {
		return (
			this.configService.get<string>("PUSH_DELIVERY_WORKER_ENABLED")?.trim().toLowerCase() ===
			"true"
		);
	}

	private positiveInteger(key: string, fallback: number): number {
		const value = Number(this.configService.get<string>(key));
		return Number.isInteger(value) && value > 0 ? value : fallback;
	}
}
