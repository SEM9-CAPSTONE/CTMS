import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime metadata
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime metadata
import { HostAnalyticsSuggestionsService } from "./host-analytics-suggestions.service";

@Injectable()
export class HostAnalyticsSuggestionsWorker implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(HostAnalyticsSuggestionsWorker.name);
	private timer: NodeJS.Timeout | null = null;
	private running = false;

	constructor(
		private readonly configService: ConfigService,
		private readonly suggestionsService: HostAnalyticsSuggestionsService
	) {}

	onModuleInit(): void {
		const isTest = this.configService.get<string>("NODE_ENV") === "test";
		const flag = this.configService.get<string>("HOST_ANALYTICS_WORKER_ENABLED");
		const enabled = flag !== undefined ? flag.toLowerCase() === "true" : !isTest;
		if (!enabled) return;

		this.timer = setInterval(() => {
			void this.tick();
		}, 2000);
		this.timer.unref?.();
	}

	onModuleDestroy(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	async tick(): Promise<void> {
		if (this.running) return;
		this.running = true;
		try {
			await this.suggestionsService.processNextJob();
		} catch (error) {
			this.logger.warn(
				`Host analytics suggestion worker tick failed: ${error instanceof Error ? error.message : String(error)}`
			);
		} finally {
			this.running = false;
		}
	}
}
