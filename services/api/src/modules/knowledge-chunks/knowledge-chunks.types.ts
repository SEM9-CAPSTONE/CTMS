export const INGESTION_VERSION = "ctms-content-integrity-v5";
export const EMBEDDING_MODEL = "intfloat/multilingual-e5-small";
export const EMBEDDING_REVISION = "614241f622f53c4eeff9890bdc4f31cfecc418b3";
export const EMBEDDING_DIMENSIONS = 384;
export const MAX_TOKENS = 480;
export const MAX_CHUNKS = 10000;
export const MAX_ATTEMPTS = 3;
export const RETRY_BASE_SECONDS = 30;
export const MAX_RECOVERY_ROUNDS = 2;
export const RECOVERY_DELAY_SECONDS = [15 * 60, 60 * 60] as const;
export const RECOVERY_POLL_MS = 60_000;
export const QUEUE_BATCH_SIZE = 20;
export const LEASE_SECONDS = 120;
export const HEARTBEAT_MS = 20000;
export const POLL_MS = 3000;
export const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
export const DEFAULT_RETENTION_DAYS = 7;
export enum ChunkSetStatus {
	PENDING = "PENDING",
	RUNNING = "RUNNING",
	READY = "READY",
	FAILED = "FAILED",
	NEEDS_REVIEW = "NEEDS_REVIEW",
	OBSOLETE = "OBSOLETE",
}
export interface ChunkConfiguration {
	verification_revision?: number;
	pipeline_version: string;
	embedding_model: string;
	embedding_revision: string;
	embedding_dimensions: number;
	max_tokens: number;
}
export function chunkConfiguration(): ChunkConfiguration {
	return {
		verification_revision: 0,
		pipeline_version: INGESTION_VERSION,
		embedding_model: EMBEDDING_MODEL,
		embedding_revision: EMBEDDING_REVISION,
		embedding_dimensions: EMBEDDING_DIMENSIONS,
		max_tokens: MAX_TOKENS,
	};
}

export interface ChunkSet {
	extraction_snapshot?: ExtractionSnapshot | null;
	quality_report?: PreparedChunkOutput["quality"] | null;
	id: string;
	document_id: string;
	document_version_id: string;
	source_version: number;
	checksum: string;
	locale: string;
	configuration: ChunkConfiguration;
	config_hash: string;
	status: ChunkSetStatus;
	attempts: number;
	recovery_round: number;
	lease_token: string | null;
}
export interface ChunkSetSummary {
	id: string;
	active: boolean;
	document_version_id: string;
	source_version: number;
	locale: string;
	status: ChunkSetStatus;
	attempts: number;
	error_code: string | null;
	automatic_recovery_pending: boolean;
	quality_report: ChunkOutput["quality"] | UnreadablePdfReport | null;
	configuration: ChunkConfiguration;
	chunk_count: number;
	created_at: string;
	completed_at: string | null;
}
export interface StoredKnowledgeChunk {
	id: string;
	chunk_set_id: string;
	document_version_id: string;
	source_version: number;
	locale: string;
	chunk_index: number;
	content: string;
	embedding_text: string;
	metadata: {
		headings: string[];
		locations: ChunkLocation[];
		token_count: number;
		source_title: string;
	};
	embedding: number[];
}
export interface ChunkLocation {
	page: number;
	item_ref: string;
	bbox: { l: number; t: number; r: number; b: number; coord_origin: string };
}
export interface PreparedChunk {
	chunk_index: number;
	content: string;
	embedding_text: string;
	token_count: number;
	headings: string[];
	locations: ChunkLocation[];
}
export interface GeneratedChunk extends PreparedChunk {
	embedding: number[];
}
export interface PreparedChunkOutput {
	extraction_snapshot?: ExtractionSnapshot | null;
	document_version_id: string;
	source_version: number;
	checksum: string;
	locale: string;
	configuration: ChunkConfiguration;
	quality: {
		integrity?: { revision: number; complete: boolean; regions: IntegrityRegion[] } | null;
		status: "PASSED" | "NEEDS_REVIEW";
		issues: string[];
		page_count: number;
		pages?: Array<{
			page: number;
			mode: "native" | "ocr" | "mixed" | "blank" | "unverified" | "manual";
			ocr_words: number;
			minimum_confidence: number | null;
			text_coverage: number | null;
			issues: string[];
		}>;
	};
	chunks: PreparedChunk[];
}
export interface ChunkOutput extends PreparedChunkOutput {
	chunks: GeneratedChunk[];
}

export interface IntegrityDecision {
	action: "confirm" | "correct" | "describe" | "exclude";
	text: string;
	source_checked: boolean;
	context_checked: boolean;
	visual_checked: boolean;
	reason?: string;
	after_item_ref?: string;
	block_texts?: Record<string, string>;
}
export interface IntegrityRegion {
	id: string;
	page: number;
	bbox: ChunkLocation["bbox"];
	item_refs: string[];
	kind: string;
	original_text: string;
	recovery_text?: string;
	empty_form?: boolean;
	issues: string[];
	related_figures: string[];
	critical: boolean;
	excludable: boolean;
	assessment: string;
	attempts: Array<{ method: string; outcome: string; input: string }>;
	decision: IntegrityDecision | null;
}
export interface ExtractionSnapshot {
	format: number;
	document_version_id: string;
	checksum: string;
	configuration: ChunkConfiguration;
	revision: number;
	document: Record<string, unknown>;
	regions: IntegrityRegion[];
	prepared: PreparedChunk[];
	[key: string]: unknown;
}
export const PDF_READ_ISSUES = [
	"pdf_encrypted",
	"pdf_page_limit_exceeded",
	"pdf_no_pages",
	"pdf_text_read_failed",
] as const;

type UnreadablePdfReport = {
	status: "NEEDS_REVIEW";
	issues: [(typeof PDF_READ_ISSUES)[number]];
	page_count: null;
};

export interface ChunkFailure {
	error: string;
	retryable: boolean;
	quality?: UnreadablePdfReport;
}

export class IngestionError extends Error {
	constructor(
		readonly code: string,
		readonly retryable = false,
		readonly quality?: UnreadablePdfReport
	) {
		super(code);
	}
}
