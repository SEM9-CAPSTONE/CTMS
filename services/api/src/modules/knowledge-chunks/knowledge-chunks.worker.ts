import {
	Injectable,
	Logger,
	type OnModuleDestroy,
	type OnModuleInit,
	ServiceUnavailableException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: Nest injection
import { SurvivalSourceReader } from "../survival-documents/survival-source-reader.service";
// biome-ignore lint/style/useImportType: Nest injection
import { KnowledgeChunksProvider } from "./knowledge-chunks.provider";
// biome-ignore lint/style/useImportType: Nest injection
import { KnowledgeChunksRepository } from "./knowledge-chunks.repository";
import {
	CLEANUP_INTERVAL_MS,
	type ChunkFailure,
	type ChunkOutput,
	DEFAULT_RETENTION_DAYS,
	HEARTBEAT_MS,
	IngestionError,
	POLL_MS,
	QUEUE_BATCH_SIZE,
	RECOVERY_POLL_MS,
} from "./knowledge-chunks.types";

@Injectable()
export class KnowledgeChunksWorker implements OnModuleInit, OnModuleDestroy {
	private timer?: NodeJS.Timeout;
	private busy = false;
	private nextCleanupAt = 0;
	private nextRecoveryAt = 0;
	private nextReconciliationAt = 0;
	private reconciliationCursor: string | null = null;
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
			const configuration = this.provider.configuration();
			await this.repository.consumeEvents(configuration);
			if (Date.now() >= this.nextReconciliationAt) {
				const { candidates, lastDocumentId } = await this.repository.reconcile(
					configuration,
					this.reconciliationCursor,
					QUEUE_BATCH_SIZE
				);
				this.reconciliationCursor = candidates === QUEUE_BATCH_SIZE ? lastDocumentId : null;
				if (!this.reconciliationCursor) this.nextReconciliationAt = Date.now() + RECOVERY_POLL_MS;
			}
			if (Date.now() >= this.nextRecoveryAt) {
				this.nextRecoveryAt = Date.now() + RECOVERY_POLL_MS;
				if (
					(await this.repository.hasRecoverableFailures(configuration)) &&
					(await this.provider.isAvailable())
				) {
					await this.repository.recoverFailed(configuration);
				}
			}
			await this.processOne();
			await this.cleanupWhenDue();
		} catch {
			this.logger.error(
				"Knowledge ingestion failed; unfinished work will recover through durable leases"
			);
		} finally {
			this.busy = false;
		}
	}
	private async cleanupWhenDue(): Promise<void> {
		if (Date.now() < this.nextCleanupAt) return;
		this.nextCleanupAt = Date.now() + CLEANUP_INTERVAL_MS;
		const retentionDays = Number(
			this.config.get<string>("KNOWLEDGE_CHUNK_RETENTION_DAYS") ?? DEFAULT_RETENTION_DAYS
		);
		if (!Number.isSafeInteger(retentionDays) || retentionDays <= 0 || retentionDays > 36500) {
			this.logger.error("KNOWLEDGE_CHUNK_RETENTION_DAYS must be an integer from 1 to 36500");
			return;
		}
		try {
			const result = await this.repository.cleanupHistory(retentionDays);
			if (result.deleted || result.retainedByDependency)
				this.logger.log(
					`Knowledge history cleanup deleted ${result.deleted} sets and retained ${result.retainedByDependency} with dependencies`
				);
		} catch {
			this.logger.error("Knowledge history cleanup failed");
		}
	}
	async processOne(): Promise<boolean> {
		const set = await this.repository.claim(this.provider.configuration());
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
			let result: ChunkOutput | ChunkFailure;
			try {
				const source = await this.reader.readPublished(set.document_version_id);
				result = await this.provider.generate(
					set,
					source.bytes,
					source.manifest.metadata.sourceTitle,
					abort.signal,
					(inputs) => this.repository.reusableEmbeddings(set, inputs)
				);
			} catch (error) {
				const failure =
					error instanceof IngestionError
						? error
						: new IngestionError(
								error instanceof ServiceUnavailableException
									? "source_file_unavailable"
									: "source_or_ingestion_failed",
								true
							);
				result = { error: failure.code, retryable: failure.retryable, quality: failure.quality };
			}
			await this.repository.finish(set, result);
		} finally {
			clearInterval(heartbeat);
		}
		return true;
	}
}
