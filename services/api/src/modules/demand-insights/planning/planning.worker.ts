import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: Nest injection
import { PlanningService } from "./planning.service";
@Injectable()
export class PlanningWorker implements OnModuleInit, OnModuleDestroy {
	private timer?: NodeJS.Timeout;
	private busy = false;
	private readonly logger = new Logger(PlanningWorker.name);
	constructor(
		private readonly service: PlanningService,
		private readonly config: ConfigService
	) {}
	onModuleInit() {
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
	onModuleDestroy() {
		if (this.timer) clearInterval(this.timer);
	}
	async tick() {
		if (this.busy) return;
		this.busy = true;
		try {
			await this.service.processOne();
		} catch {
			this.logger.error("Planning worker failed; persisted leases will recover work");
		} finally {
			this.busy = false;
		}
	}
}
