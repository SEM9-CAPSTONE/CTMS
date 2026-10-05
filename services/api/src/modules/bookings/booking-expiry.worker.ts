import {
	Injectable,
	Logger,
	type OnApplicationBootstrap,
	type OnApplicationShutdown,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { BookingExpiryService } from "./booking-expiry.service";

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_BATCH_SIZE = 100;

interface UnrefTimer {
	unref?: () => void;
}

@Injectable()
export class BookingExpiryWorker implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger(BookingExpiryWorker.name);
	private timer: ReturnType<typeof setInterval> | null = null;
	private activeTick: Promise<void> | null = null;
	private shuttingDown = false;

	constructor(
		private readonly configService: ConfigService,
		private readonly expiryService: BookingExpiryService
	) {}

	onApplicationBootstrap(): void {
		if (!this.isEnabled()) return;
		const intervalMs = this.positiveInteger("BOOKING_EXPIRY_INTERVAL_MS", DEFAULT_INTERVAL_MS);
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
		const batchSize = this.positiveInteger("BOOKING_EXPIRY_BATCH_SIZE", DEFAULT_BATCH_SIZE);
		this.activeTick = this.expiryService
			.expireDueBookings(batchSize)
			.catch((error: unknown) => {
				const message = error instanceof Error ? error.message : "Unknown worker error";
				this.logger.error(`Booking expiry tick failed: ${message}`);
			})
			.finally(() => {
				this.activeTick = null;
			});
	}

	private isEnabled(): boolean {
		return (
			this.configService.get<string>("BOOKING_EXPIRY_WORKER_ENABLED")?.trim().toLowerCase() ===
			"true"
		);
	}

	private positiveInteger(key: string, fallback: number): number {
		const value = Number(this.configService.get<string>(key));
		return Number.isSafeInteger(value) && value > 0 ? value : fallback;
	}
}
