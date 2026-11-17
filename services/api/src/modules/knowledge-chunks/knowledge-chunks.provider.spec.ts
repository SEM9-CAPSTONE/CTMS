import { ConfigService } from "@nestjs/config";
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
	it("probes the service with the ingestion token and treats a wrong token as unavailable", async () => {
		const fetcher = jest
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(new Response(null, { status: 401 }))
			.mockResolvedValueOnce(new Response(null, { status: 204 }));
		await expect(provider.isAvailable()).resolves.toBe(false);
		await expect(provider.isAvailable()).resolves.toBe(true);
		expect(fetcher).toHaveBeenCalledWith(
			"http://localhost:8001/readiness",
			expect.objectContaining({
				headers: { "X-CTMS-Knowledge-Token": "internal-test-token" },
			})
		);
	});
});
