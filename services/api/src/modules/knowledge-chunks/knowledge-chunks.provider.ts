import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { ConfigService } from "@nestjs/config";
import { validateChunkOutput } from "./knowledge-chunks.policy";
import {
	type ChunkConfiguration,
	type ChunkOutput,
	type ChunkSet,
	IngestionError,
	PDF_READ_ISSUES,
	chunkConfiguration,
} from "./knowledge-chunks.types";

@Injectable()
export class KnowledgeChunksProvider {
	constructor(private readonly config: ConfigService) {}
	private get baseUrl(): string {
		return this.config.get<string>("KNOWLEDGE_SERVICE_URL") || "http://localhost:8001";
	}
	configuration(): ChunkConfiguration {
		return chunkConfiguration();
	}
	async isAvailable(): Promise<boolean> {
		const token = this.config.get<string>("KNOWLEDGE_SERVICE_TOKEN");
		if (!token) return false;
		try {
			const response = await fetch(`${this.baseUrl}/readiness`, {
				headers: { "X-CTMS-Knowledge-Token": token },
				signal: AbortSignal.timeout(3000),
			});
			return response.status === 204;
		} catch {
			return false;
		}
	}
	async generate(
		set: ChunkSet,
		bytes: Buffer,
		title: string,
		signal: AbortSignal
	): Promise<ChunkOutput> {
		const token = this.config.get<string>("KNOWLEDGE_SERVICE_TOKEN");
		if (!token) throw new IngestionError("ingestion_not_configured", true);
		try {
			const response = await fetch(`${this.baseUrl}/knowledge-chunks`, {
				method: "POST",
				headers: { "Content-Type": "application/json", "X-CTMS-Knowledge-Token": token },
				body: JSON.stringify({
					document_version_id: set.document_version_id,
					source_version: set.source_version,
					checksum: set.checksum,
					locale: set.locale,
					title,
					configuration: set.configuration,
					pdf_base64: bytes.toString("base64"),
				}),
				signal: AbortSignal.any([signal, AbortSignal.timeout(600000)]),
			});
			if (response.status === 422) {
				const raw: unknown = await response.json().catch(() => null);
				const detail = (raw as { detail?: { code?: unknown; issue?: unknown } } | null)?.detail;
				const issue = PDF_READ_ISSUES.find((code) => code === detail?.issue);
				if (detail?.code === "invalid_pdf" && issue) {
					throw new IngestionError("extraction_needs_review", false, {
						status: "NEEDS_REVIEW",
						issues: [issue],
						page_count: null,
					});
				}
			}
			if (!response.ok)
				throw new IngestionError(
					`ingestion_http_${response.status}`,
					[401, 429].includes(response.status) || response.status >= 500
				);
			const raw: unknown = await response.json();
			return validateChunkOutput(raw, set);
		} catch (error) {
			if (error instanceof IngestionError) throw error;
			throw new IngestionError("ingestion_transport", true);
		}
	}
}
