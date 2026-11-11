import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: Nest injection
import { SurvivalSourceReader } from "../survival-documents/survival-source-reader.service";
// biome-ignore lint/style/useImportType: Nest injection
import { KnowledgeChunksProvider } from "./knowledge-chunks.provider";
// biome-ignore lint/style/useImportType: Nest injection
import { KnowledgeChunksRepository } from "./knowledge-chunks.repository";
import { HEARTBEAT_MS, IngestionError, POLL_MS } from "./knowledge-chunks.types";

@Injectable()
export class KnowledgeChunksWorker implements OnModuleInit, OnModuleDestroy {
	private timer?: NodeJS.Timeout;
	private busy = false;
	private readonly logger = new Logger(KnowledgeChunksWorker.name);
	constructor(
		private readonly repository: KnowledgeChunksRepository,
		private readonly provider: KnowledgeChunksProvider,
		private readonly reader: SurvivalSourceReader,
		private readonly config: ConfigService
	) {}
	onModuleInit(): void {
		const enabled =
			this.config.get<string>("KNOWLEDGE_WORKER_ENABLED") ??
			(process.env.NODE_ENV === "test" ? "false" : "true");
		if (enabled !== "true") return;
		this.timer = setInterval(() => void this.tick(), POLL_MS);
		this.timer.unref();
	}
	onModuleDestroy(): void {
		if (this.timer) clearInterval(this.timer);
	}
	async tick(): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		try {
			await this.repository.consumeEvents(this.provider.configuration());
			await this.processOne();
		} catch {
			this.logger.error(
				"Knowledge ingestion failed; unfinished work will recover through durable leases"
			);
		} finally {
			this.busy = false;
		}
	}
	async processOne(): Promise<boolean> {
		const set = await this.repository.claim();
		if (!set) return false;
		const abort = new AbortController();
		const heartbeat = setInterval(() => {
			void this.repository
				.heartbeat(set)
				.then((valid) => {
					if (!valid) abort.abort();
				})
				.catch(() => abort.abort());
		}, HEARTBEAT_MS);
		heartbeat.unref();
		try {
			const source = await this.reader.readPublished(set.document_version_id);
			const output = await this.provider.generate(
				set,
				source.bytes,
				source.manifest.metadata.sourceTitle,
				abort.signal
			);
			await this.repository.finish(set, output);
		} catch (error) {
			const failure =
				error instanceof IngestionError ? error : new IngestionError("source_or_ingestion_failed");
			await this.repository.finish(set, { error: failure.code, retryable: failure.retryable });
		} finally {
			clearInterval(heartbeat);
		}
		return true;
	}
}
