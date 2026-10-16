import {
	Injectable,
	Logger,
	type OnApplicationBootstrap,
	type OnApplicationShutdown,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS injection requires runtime metadata
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: NestJS injection requires runtime metadata
import { PorterRequestsService } from "./porter-requests.service";

const INTERVAL_MS = 60_000;
const BATCH_SIZE = 100;

@Injectable()
export class PorterRequestExpiryWorker implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger(PorterRequestExpiryWorker.name);
	private timer: ReturnType<typeof setInterval> | null = null;
	private activeTick: Promise<void> | null = null;
	private stopping = false;

	constructor(
		private readonly config: ConfigService,
		private readonly requests: PorterRequestsService
	) {}

	onApplicationBootstrap(): void {
		const enabled = this.config.get<string>("PORTER_REQUEST_EXPIRY_WORKER_ENABLED")?.toLowerCase();
		if (enabled === "false" || (process.env.NODE_ENV === "test" && enabled !== "true")) return;
		this.timer = setInterval(() => this.tick(), INTERVAL_MS);
		this.timer.unref?.();
		this.tick();
	}

	async onApplicationShutdown(): Promise<void> {
		this.stopping = true;
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
		await this.activeTick;
	}

	private tick(): void {
		if (this.stopping || this.activeTick) return;
		this.activeTick = this.requests
			.expirePending(BATCH_SIZE)
			.then(() => undefined)
			.catch((error: unknown) => this.logger.error("Porter Request expiry failed", error))
			.finally(() => {
				this.activeTick = null;
			});
	}
}
