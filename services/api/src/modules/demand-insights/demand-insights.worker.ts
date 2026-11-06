import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: Nest injection
import { DemandInsightsService } from "./demand-insights.service";
@Injectable()
export class DemandInsightsWorker implements OnModuleInit, OnModuleDestroy {
	private timer?: NodeJS.Timeout;
	private busy = false;
	private readonly logger = new Logger(DemandInsightsWorker.name);
	constructor(
		private readonly service: DemandInsightsService,
		private readonly config: ConfigService
	) {}
	onModuleInit(): void {
		if (
			(this.config.get<string>("DEMAND_WORKER_ENABLED") ??
				(process.env.NODE_ENV === "test" ? "false" : "true")) !== "true"
		)
			return;
		this.timer = setInterval(() => {
			void this.tick();
		}, 2000);
		this.timer.unref();
	}
	onModuleDestroy(): void {
		if (this.timer) clearInterval(this.timer);
	}
	async tick(): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		try {
			await this.service.processOne();
		} catch {
			this.logger.error("Demand worker failed; persisted leases will recover work");
		} finally {
			this.busy = false;
		}
	}
}
