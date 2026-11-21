import { ConfigService } from "@nestjs/config";
import {
	integrityFixture,
	verifiedIntegrity,
	withIntegrity,
} from "../../../test/support/knowledge-integrity-fixture";
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
		recovery_round: 0,
		lease_token: "token",
	};
	const output = (): ChunkOutput =>
		withIntegrity({
			extraction_snapshot: integrityFixture(set),
			document_version_id: set.document_version_id,
			source_version: 1,
			checksum: set.checksum,
			locale: set.locale,
			configuration: { ...configuration },
			quality: { status: "PASSED", issues: [], page_count: 2, integrity: verifiedIntegrity },
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
	it("validates OCR page evidence and rejects a PASSED result with unverified pages", () => {
		const value = output();
		value.quality.pages = [1, 2].map((page) => ({
			page,
			mode: "ocr",
			ocr_words: 10,
			minimum_confidence: 0.95,
			text_coverage: 1,
			issues: [],
		}));
		expect(validateChunkOutput(value, set)).toBe(value);
		value.quality.pages[1].issues = ["ocr_low_confidence"];
		expect(() => validateChunkOutput(value, set)).toThrow();
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
	it("compares JSON evidence by values after transport and JSONB key reordering", () => {
		const value = structuredClone(output());
		if (!value.extraction_snapshot) throw new Error("Missing fixture evidence");
		value.extraction_snapshot = structuredClone(value.extraction_snapshot);
		const location = value.extraction_snapshot.prepared[0].locations[0];
		location.bbox = { coord_origin: "BOTTOMLEFT", b: 0, r: 1, t: 1, l: 0 };
		expect(validateChunkOutput(value, set)).toBe(value);
	});
	it.each(["content", "location"])(
		"rejects %s that differs from the verified extraction snapshot",
		(change) => {
			const value = structuredClone(output());
			if (!value.extraction_snapshot) throw new Error("Missing fixture evidence");
			value.extraction_snapshot = structuredClone(value.extraction_snapshot);
			if (change === "content") {
				value.chunks[0].content = "A changed instruction";
				value.chunks[0].embedding_text = "passage: A changed instruction";
			} else value.chunks[0].locations[0].bbox.l = 0.5;
			expect(() => validateChunkOutput(value, set)).toThrow("invalid_ingestion_output");
		}
	);
	it("rejects a null chunk as invalid output without a destructuring error", () => {
		const value = output();
		(value.chunks as unknown[])[0] = null;
		expect(() => validateChunkOutput(value, set)).toThrow("invalid_ingestion_output");
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
	it("requires version-bound integrity evidence for a v5 activation", () => {
		for (const mutate of [
			(value: ChunkOutput) => {
				Reflect.deleteProperty(value, "extraction_snapshot");
			},
			(value: ChunkOutput) => {
				Reflect.deleteProperty(value.quality, "integrity");
			},
			(value: ChunkOutput) => {
				if (value.quality.integrity) value.quality.integrity.complete = false;
			},
			(value: ChunkOutput) => {
				if (value.extraction_snapshot) value.extraction_snapshot.checksum = "b".repeat(64);
			},
		]) {
			const value = structuredClone(output());
			mutate(value);
			expect(() => validateChunkOutput(value, set)).toThrow();
		}
	});
});
