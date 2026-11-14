import { ConfigService } from "@nestjs/config";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_REVISION } from "../knowledge-chunks/knowledge-chunks.types";
import { RagEmbeddingProvider } from "./rag-embedding.provider";

const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => Number(index === 0));
const identity = { model: EMBEDDING_MODEL, revision: EMBEDDING_REVISION, dimensions: EMBEDDING_DIMENSIONS };
const config = new ConfigService({
	KNOWLEDGE_SERVICE_TOKEN: "test-token",
	KNOWLEDGE_SERVICE_URL: "http://localhost:8001",
});
const provider = new RagEmbeddingProvider(config);
const response = (data: object) => new Response(JSON.stringify(data));

describe("RagEmbeddingProvider", () => {
	afterEach(() => jest.restoreAllMocks());

	it("calls only the authenticated knowledge boundary and validates the pinned vector", async () => {
		const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(response({ ...identity, embedding: vector }));
		expect(await provider.embed("question", 100)).toEqual(vector);
		expect(fetchMock).toHaveBeenCalledWith("http://localhost:8001/query-embedding", expect.objectContaining({
			headers: { "Content-Type": "application/json", "X-CTMS-Knowledge-Token": "test-token" },
			body: '{"question":"question"}',
			redirect: "error",
		}));
	});

	it.each([
		{ ...identity, revision: "main", embedding: vector },
		{ ...identity, embedding: [1] },
		{ ...identity, embedding: [Number.NaN, ...vector.slice(1)] },
		{ ...identity, embedding: vector.map(() => 0) },
	])("rejects malformed or incompatible model responses", async (data) => {
		jest.spyOn(globalThis, "fetch").mockResolvedValue(response(data));
		await expect(provider.embed("question", 100)).rejects.toMatchObject({
			response: { code: "RAG_EMBEDDING_UNAVAILABLE" },
		});
	});

	it("caps response size and sanitizes transport failures", async () => {
		const fetchMock = jest.spyOn(globalThis, "fetch");
		fetchMock.mockResolvedValueOnce(new Response("x".repeat(20000)));
		fetchMock.mockRejectedValueOnce(new DOMException("private endpoint", "TimeoutError"));
		for (let attempt = 0; attempt < 2; attempt++) {
			await expect(provider.embed("private question", 100)).rejects.toMatchObject({
				response: { code: "RAG_EMBEDDING_UNAVAILABLE" },
			});
		}
	});

	it("distinguishes rejected question input from an unavailable provider", async () => {
		const fetchMock = jest.spyOn(globalThis, "fetch");
		fetchMock.mockResolvedValueOnce(new Response(null, { status: 422 }));
		fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
		await expect(provider.embed("query", 100)).rejects.toMatchObject({ response: { code: "RAG_INVALID_QUERY" } });
		await expect(provider.embed("query", 100)).rejects.toMatchObject({
			response: { code: "RAG_EMBEDDING_UNAVAILABLE" },
		});
	});
});
