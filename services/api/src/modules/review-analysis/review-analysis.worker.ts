import { createHash } from "node:crypto";
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource } from "typeorm";
import { redactPersonalData, validateOutput } from "./review-analysis.policy";
// biome-ignore lint/style/useImportType: Nest injection
import { ReviewAnalysisProvider } from "./review-analysis.provider";
// biome-ignore lint/style/useImportType: Nest injection
import { ReviewAnalysisQueue } from "./review-analysis.queue";
// biome-ignore lint/style/useImportType: Nest injection
import { ReviewAnalysisRepository } from "./review-analysis.repository";
import { AnalysisProviderError } from "./review-analysis.types";

@Injectable()
export class ReviewAnalysisWorker implements OnModuleInit, OnModuleDestroy {
	private timer?: NodeJS.Timeout;
	private busy = false;
	private readonly logger = new Logger(ReviewAnalysisWorker.name);
	constructor(
		private readonly db: DataSource,
		private readonly queue: ReviewAnalysisQueue,
		private readonly repository: ReviewAnalysisRepository,
		private readonly provider: ReviewAnalysisProvider,
		private readonly config: ConfigService
	) {}
	onModuleInit(): void {
		const enabled =
			this.config.get<string>("REVIEW_ANALYSIS_WORKER_ENABLED") ??
			(process.env.NODE_ENV === "test" ? "false" : "true");
		if (enabled !== "true") return;
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
			await Promise.all([this.processOne(), this.processOne()]);
		} catch {
			this.logger.error(
				"Review analysis worker failed; durable leases will recover unfinished work"
			);
		} finally {
			this.busy = false;
		}
	}
	async processOne(): Promise<boolean> {
		const claim = await this.queue.claim();
		if (!claim) return false;
		const abort = new AbortController();
		const heartbeat = setInterval(() => {
			void this.queue
				.heartbeat(claim)
				.then((valid) => {
					if (!valid) abort.abort();
				})
				.catch(() => abort.abort());
		}, 20000);
		heartbeat.unref();
		try {
			const source = await this.repository.source(this.db.manager, claim.item.review_id);
			const config = this.provider.configuration();
			if (
				!source ||
				!source.eligible ||
				source.revision !== claim.item.source_revision ||
				config.model !== claim.item.model ||
				config.provider !== claim.item.provider ||
				config.configVersion !== claim.item.config_version ||
				config.promptVersion !== claim.item.prompt_version
			) {
				await this.queue.finish(claim, { error: "source_or_config_changed", skipped: true });
				return true;
			}
			const comment = redactPersonalData(source.comment ?? "");
			const output = validateOutput(await this.provider.generate(comment, config, abort.signal));
			await this.queue.finish(claim, {
				output,
				inputHash: createHash("sha256").update(comment).digest("hex"),
			});
		} catch (error) {
			const failure =
				error instanceof AnalysisProviderError
					? error
					: new AnalysisProviderError("analysis_internal_error", false);
			await this.queue.finish(claim, { error: failure.code, retryable: failure.retryable });
		} finally {
			clearInterval(heartbeat);
		}
		return true;
	}
}
