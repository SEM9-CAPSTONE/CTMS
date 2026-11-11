import { ConfigService } from "@nestjs/config";
import { validateChunkOutput } from "./knowledge-chunks.policy";
import { KnowledgeChunksProvider } from "./knowledge-chunks.provider";
import { type ChunkOutput, type ChunkSet, ChunkSetStatus } from "./knowledge-chunks.types";

describe("CTMS-051 worker response validation", () => {
	const configuration = new KnowledgeChunksProvider(new ConfigService()).configuration();
	const set: ChunkSet = {
		id: "set",
		document_id: "doc",
		document_version_id: "version",
		source_version: 1,
		checksum: "0".repeat(64),
		locale: "vi-VN",
		configuration,
		config_hash: "hash",
		status: ChunkSetStatus.RUNNING,
		attempts: 1,
		lease_token: "token",
	};
	const output = (): ChunkOutput => ({
		document_version_id: set.document_version_id,
		source_version: 1,
		checksum: set.checksum,
		locale: set.locale,
		configuration: { ...configuration },
		quality: { status: "PASSED", issues: [], page_count: 2 },
		chunks: [
			{
				chunk_index: 0,
				content: "Nội dung nguồn",
				embedding_text: "passage: Tiêu đề\nNội dung nguồn",
				token_count: 20,
				headings: ["Tiêu đề"],
				locations: [
					{
						page: 1,
						item_ref: "#/texts/0",
						bbox: { l: 0, t: 1, r: 1, b: 0, coord_origin: "BOTTOMLEFT" },
					},
				],
				embedding: Array.from({ length: 384 }, (_, index) => (index === 0 ? 1 : 0)),
			},
		],
	});
	it("accepts complete vectors with exact provenance and a populated review report", () => {
		expect(validateChunkOutput(output(), set).chunks).toHaveLength(1);
		const review = output();
		review.quality = {
			status: "NEEDS_REVIEW",
			issues: ["missing_critical_content"],
			page_count: 2,
		};
		review.chunks = [];
		expect(validateChunkOutput(review, set).quality.status).toBe("NEEDS_REVIEW");
	});
	it.each<[(value: ChunkOutput) => void]>([
		[
			(value) => {
				value.document_version_id = "another-version";
			},
		],
		[
			(value) => {
				value.source_version = 2;
			},
		],
		[
			(value) => {
				value.checksum = "1".repeat(64);
			},
		],
		[
			(value) => {
				value.locale = "en";
			},
		],
		[
			(value) => {
				value.configuration.embedding_revision = "main";
			},
		],
		[
			(value) => {
				value.chunks[0].embedding = [];
			},
		],
		[
			(value) => {
				value.chunks[0].embedding[0] = Number.NaN;
			},
		],
		[
			(value) => {
				value.chunks[0].embedding.fill(0);
			},
		],
		[
			(value) => {
				value.chunks[0].chunk_index = 1;
			},
		],
		[
			(value) => {
				value.chunks[0].token_count = 481;
			},
		],
		[
			(value) => {
				value.chunks[0].locations = [];
			},
		],
		[
			(value) => {
				value.chunks[0].locations[0].page = 3;
			},
		],
		[
			(value) => {
				value.chunks[0].embedding_text = "Invented content";
			},
		],
		[
			(value) => {
				value.quality.status = "NEEDS_REVIEW";
			},
		],
		[
			(value) => {
				value.quality.issues = ["warning_missing"];
			},
		],
		[
			(value) => {
				value.chunks = [];
			},
		],
	])("rejects mixed provenance or incomplete/unsafe output (%#)", (mutate) => {
		const value = output();
		mutate(value);
		expect(() => validateChunkOutput(value, set)).toThrow("invalid_ingestion_output");
	});
	it.each([null, {}, [], { quality: null }])("rejects malformed responses (%#)", (value) => {
		expect(() => validateChunkOutput(value, set)).toThrow("invalid_ingestion_output");
	});
});
