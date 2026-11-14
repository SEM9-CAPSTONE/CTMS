export const INGESTION_VERSION = "ctms-hybrid-v1";
export const EMBEDDING_MODEL = "intfloat/multilingual-e5-small";
export const EMBEDDING_REVISION = "614241f622f53c4eeff9890bdc4f31cfecc418b3";
export const EMBEDDING_DIMENSIONS = 384;
export const MAX_TOKENS = 480;
export const MAX_CHUNKS = 10000;
export const MAX_ATTEMPTS = 3;
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
	pipeline_version: string;
	embedding_model: string;
	embedding_revision: string;
	embedding_dimensions: number;
	max_tokens: number;
}
export function chunkConfiguration(): ChunkConfiguration {
	return {
		pipeline_version: INGESTION_VERSION,
		embedding_model: EMBEDDING_MODEL,
		embedding_revision: EMBEDDING_REVISION,
		embedding_dimensions: EMBEDDING_DIMENSIONS,
		max_tokens: MAX_TOKENS,
	};
}

export interface ChunkSet {
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
	quality_report: ChunkOutput["quality"] | null;
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
export interface GeneratedChunk {
	chunk_index: number;
	content: string;
	embedding_text: string;
	token_count: number;
	headings: string[];
	locations: ChunkLocation[];
	embedding: number[];
}
export interface ChunkOutput {
	document_version_id: string;
	source_version: number;
	checksum: string;
	locale: string;
	configuration: ChunkConfiguration;
	quality: { status: "PASSED" | "NEEDS_REVIEW"; issues: string[]; page_count: number };
	chunks: GeneratedChunk[];
}
export class IngestionError extends Error {
	constructor(
		readonly code: string,
		readonly retryable = false
	) {
		super(code);
	}
}
