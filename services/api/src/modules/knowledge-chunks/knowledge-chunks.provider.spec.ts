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
		[401, false],
		[429, true],
		[502, true],
	])("classifies HTTP %i retryability", async (status, retryable) => {
		jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status }));
		await expect(
			provider.generate(set, Buffer.from("pdf"), "Title", new AbortController().signal)
		).rejects.toMatchObject({ code: `ingestion_http_${status}`, retryable });
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
		).rejects.toMatchObject({ code: "ingestion_not_configured", retryable: false });
		expect(fetcher).not.toHaveBeenCalled();
		await expect(
			provider.generate(set, Buffer.from("pdf"), "Title", new AbortController().signal)
		).rejects.toMatchObject({ code: "invalid_ingestion_output", retryable: false });
	});
});
