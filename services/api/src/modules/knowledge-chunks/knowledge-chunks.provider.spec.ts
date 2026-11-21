import { ConfigService } from "@nestjs/config";
import {
	integrityFixture,
	verifiedIntegrity,
	withIntegrity,
} from "../../../test/support/knowledge-integrity-fixture";
import { KnowledgeChunksProvider } from "./knowledge-chunks.provider";
import { type ChunkSet, ChunkSetStatus } from "./knowledge-chunks.types";

describe("Knowledge ingestion provider boundary", () => {
	const provider = new KnowledgeChunksProvider(
		new ConfigService({ KNOWLEDGE_SERVICE_TOKEN: "internal-test-token" })
	);
	const set: ChunkSet = {
		id: "set",
		document_id: "doc",
		document_version_id: "exact-version",
		source_version: 2,
		checksum: "0".repeat(64),
		locale: "vi-VN",
		configuration: provider.configuration(),
		config_hash: "hash",
		status: ChunkSetStatus.RUNNING,
		attempts: 1,
		recovery_round: 0,
		lease_token: "token",
	};
	afterEach(() => jest.restoreAllMocks());
	it("sends immutable identity and private PDF bytes through the authenticated boundary", async () => {
		const fetcher = jest.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					document_version_id: set.document_version_id,
					source_version: 2,
					checksum: set.checksum,
					locale: set.locale,
					configuration: set.configuration,
					quality: { status: "NEEDS_REVIEW", issues: ["missing_critical_content"], page_count: 1 },
					chunks: [],
				}),
				{ status: 200 }
			)
		);
		expect(
			(
				await provider.generate(
					set,
					Buffer.from("private-pdf"),
					"Nguồn",
					new AbortController().signal
				)
			).quality.status
		).toBe("NEEDS_REVIEW");
		const options = fetcher.mock.calls[0][1];
		expect(options?.headers).toMatchObject({ "X-CTMS-Knowledge-Token": "internal-test-token" });
		expect(JSON.parse(String(options?.body))).toMatchObject({
			document_version_id: "exact-version",
			source_version: 2,
			locale: "vi-VN",
			pdf_base64: Buffer.from("private-pdf").toString("base64"),
		});
	});
	it.each([
		[422, false],
		[401, true],
		[429, true],
		[502, true],
	])("classifies HTTP %i retryability", async (status, retryable) => {
		jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status }));
		await expect(
			provider.generate(set, Buffer.from("pdf"), "Title", new AbortController().signal)
		).rejects.toMatchObject({ code: `ingestion_http_${status}`, retryable });
	});
	it("classifies a failed network connection as transient", async () => {
		jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("connection refused"));
		await expect(
			provider.generate(set, Buffer.from("pdf"), "Title", new AbortController().signal)
		).rejects.toMatchObject({ code: "ingestion_transport", retryable: true });
	});
	it("retries a pipeline contract mismatch while keeping unrelated validation errors permanent", async () => {
		const fetcher = jest.spyOn(globalThis, "fetch");
		fetcher.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					detail: [{ type: "literal_error", loc: ["body", "configuration", "pipeline_version"] }],
				}),
				{ status: 422 }
			)
		);
		await expect(
			provider.generate(set, Buffer.from("pdf"), "Title", new AbortController().signal)
		).rejects.toMatchObject({ code: "ingestion_configuration_mismatch", retryable: true });
		fetcher.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					detail: [{ type: "string_pattern_mismatch", loc: ["body", "checksum"] }],
				}),
				{ status: 422 }
			)
		);
		await expect(
			provider.generate(set, Buffer.from("pdf"), "Title", new AbortController().signal)
		).rejects.toMatchObject({ code: "ingestion_http_422", retryable: false });
	});
	it("distinguishes a missing OCR runtime from content requiring technical review", async () => {
		jest.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ detail: { code: "ocr_runtime_unavailable" } }), {
				status: 503,
			})
		);
		await expect(
			provider.generate(set, Buffer.from("pdf"), "Title", new AbortController().signal)
		).rejects.toMatchObject({ code: "ocr_runtime_unavailable", retryable: true });
	});
	it("fails explicitly when unconfigured and rejects mismatched worker output", async () => {
		const fetcher = jest
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response("{}", { status: 200 }));
		await expect(
			new KnowledgeChunksProvider(new ConfigService()).generate(
				set,
				Buffer.from("pdf"),
				"Title",
				new AbortController().signal
			)
		).rejects.toMatchObject({ code: "ingestion_not_configured", retryable: true });
		expect(fetcher).not.toHaveBeenCalled();
		await expect(
			provider.generate(set, Buffer.from("pdf"), "Title", new AbortController().signal)
		).rejects.toMatchObject({ code: "invalid_ingestion_output", retryable: false });
	});
	it("persists the reported PDF issue without guessing a page count or retrying", async () => {
		jest.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					detail: { code: "invalid_pdf", issue: "pdf_text_read_failed" },
				}),
				{ status: 422 }
			)
		);
		await expect(
			provider.generate(set, Buffer.from("pdf"), "Title", new AbortController().signal)
		).rejects.toMatchObject({
			retryable: false,
			quality: { status: "NEEDS_REVIEW", issues: ["pdf_text_read_failed"], page_count: null },
		});
	});
	it("requires an authenticated readiness probe matching the current pipeline", async () => {
		const fetcher = jest
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(new Response(null, { status: 401 }))
			.mockResolvedValueOnce(new Response(null, { status: 204 }))
			.mockResolvedValueOnce(
				new Response(null, {
					status: 204,
					headers: { "X-CTMS-Pipeline-Version": "ctms-hybrid-v1" },
				})
			)
			.mockResolvedValueOnce(
				new Response(null, {
					status: 204,
					headers: { "X-CTMS-Pipeline-Version": set.configuration.pipeline_version },
				})
			);
		await expect(provider.isAvailable()).resolves.toBe(false);
		await expect(provider.isAvailable()).resolves.toBe(false);
		await expect(provider.isAvailable()).resolves.toBe(false);
		await expect(provider.isAvailable()).resolves.toBe(true);
		expect(fetcher).toHaveBeenCalledWith(
			"http://localhost:8001/readiness",
			expect.objectContaining({
				headers: { "X-CTMS-Knowledge-Token": "internal-test-token" },
			})
		);
	});
	it("encodes unique misses in order and keeps the prepared locations for each chunk", async () => {
		const matchingInput = "passage: Title\nUnchanged";
		const changedInput = "passage: New heading\nUnchanged";
		const vector = (index: number) => Array.from({ length: 384 }, (_, i) => Number(i === index));
		const response = {
			...set,
			extraction_snapshot: integrityFixture(set),
			quality: { status: "PASSED", issues: [], page_count: 3, integrity: verifiedIntegrity },
			chunks: [matchingInput, changedInput, changedInput].map((input, index) => ({
				chunk_index: index,
				content: "Unchanged",
				embedding_text: input,
				token_count: 7,
				headings: [],
				locations: [
					{
						page: index + 1,
						item_ref: `#/texts/${index}`,
						bbox: { l: 0, t: 10, r: 100, b: 0, coord_origin: "BOTTOMLEFT" },
					},
				],
			})),
		};
		response.extraction_snapshot.prepared = response.chunks;
		const find = jest.fn().mockResolvedValue(
			new Map([
				[matchingInput, vector(0)],
				[changedInput, [0]],
			])
		);
		const fetcher = jest
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(Response.json(response))
			.mockResolvedValueOnce(Response.json({ embeddings: [vector(1)] }));
		const checkpoint = jest.fn().mockResolvedValue(undefined);
		const result = await provider.generate(
			set,
			Buffer.from("pdf"),
			"Title",
			new AbortController().signal,
			find,
			checkpoint
		);
		expect(checkpoint).toHaveBeenCalledWith(
			expect.objectContaining({ extraction_snapshot: expect.any(Object) })
		);
		expect(checkpoint.mock.invocationCallOrder[0]).toBeLessThan(find.mock.invocationCallOrder[0]);
		expect(find).toHaveBeenCalledWith([matchingInput, changedInput]);
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({
			configuration: set.configuration,
			passages: [changedInput],
		});
		expect(result.chunks.map(({ embedding, locations }) => [embedding, locations[0].page])).toEqual(
			[
				[vector(0), 1],
				[vector(1), 2],
				[vector(1), 3],
			]
		);
	});
	it("rejects changed prepared text before checkpointing or looking up vectors", async () => {
		const prepared = withIntegrity({
			...set,
			quality: { status: "PASSED" as const, issues: [], page_count: 1 },
			chunks: [
				{
					chunk_index: 0,
					content: "Verified instruction",
					embedding_text: "passage: Verified instruction",
					token_count: 7,
					headings: [],
					locations: [
						{
							page: 1,
							item_ref: "#/texts/0",
							bbox: { l: 0, t: 10, r: 100, b: 0, coord_origin: "BOTTOMLEFT" as const },
						},
					],
				},
			],
		});
		prepared.chunks[0].embedding_text = "passage: Changed heading\nVerified instruction";
		const fetcher = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json(prepared));
		const find = jest.fn();
		const checkpoint = jest.fn();
		await expect(
			provider.generate(
				set,
				Buffer.from("pdf"),
				"Title",
				new AbortController().signal,
				find,
				checkpoint
			)
		).rejects.toMatchObject({ code: "invalid_ingestion_output", retryable: false });
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(checkpoint).not.toHaveBeenCalled();
		expect(find).not.toHaveBeenCalled();
	});
	it("stops after extraction when the new version fails quality checks", async () => {
		const fetcher = jest.spyOn(globalThis, "fetch").mockResolvedValue(
			Response.json({
				...set,
				quality: { status: "NEEDS_REVIEW", issues: ["missing_critical_content"], page_count: 1 },
				chunks: [],
			})
		);
		const find = jest.fn();
		await expect(
			provider.generate(set, Buffer.from("pdf"), "Title", new AbortController().signal, find)
		).resolves.toMatchObject({ quality: { status: "NEEDS_REVIEW" }, chunks: [] });
		expect(find).not.toHaveBeenCalled();
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
});
