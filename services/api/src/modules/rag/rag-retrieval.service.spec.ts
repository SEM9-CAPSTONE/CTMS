import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
	NATURAL_PREPARATION_QUESTIONS,
	TRIP_PLANNING_CHECKLIST,
} from "../../../test/support/trip-planning-retrieval-fixture";
import {
	EMBEDDING_DIMENSIONS,
	EMBEDDING_MODEL,
	EMBEDDING_REVISION,
	INGESTION_VERSION,
} from "../knowledge-chunks/knowledge-chunks.types";
import { Classification } from "../survival-documents/survival-documents.types";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import { RagEmbeddingProvider } from "./rag-embedding.provider";
import { RagRetrievalService } from "./rag-retrieval.service";
import { RagConfig } from "./rag.config";
import type { RagRepository } from "./rag.repository";
import type { RagChunk } from "./rag.types";

const actor = { userId: "camper", roles: [UserRole.CAMPER], status: UserStatus.ACTIVE };
const query = { question: "Cách kiểm tra lều trại?", locale: "vi" };

function chunk(chunkId: string, content: string, score = 0.95, locale = "vi"): RagChunk {
	return {
		chunkId,
		chunkIndex: 0,
		content,
		score,
		headings: [],
		locations: [{ page: 1, itemRef: "#/texts/0" }],
		source: {
			documentId: "document",
			documentVersionId: "version",
			sourceVersion: 1,
			checksum: "a".repeat(64),
			chunkSetId: "set",
			locale,
			sourceTitle: "Fixture",
			classification: Classification.TREKKING_SAFETY,
			embeddingModel: EMBEDDING_MODEL,
			embeddingRevision: EMBEDDING_REVISION,
			embeddingDimensions: EMBEDDING_DIMENSIONS,
			pipelineVersion: INGESTION_VERSION,
			configHash: "b".repeat(64),
		},
	};
}

function setup(config: Record<string, string> = {}) {
	const configService = new ConfigService({
		RAG_MIN_SCORE: "0.8",
		RAG_CONTEXT_TOKEN_BUDGET: "20",
		...config,
	});
	const settings = new RagConfig(configService);
	const provider = new RagEmbeddingProvider(configService);
	const embed = jest.spyOn(provider, "embed").mockResolvedValue([1]);
	const count = jest.spyOn(provider, "countPrefixes").mockResolvedValue([20]);
	const hasEligibleCorpus = jest.fn().mockResolvedValue(true);
	const search = jest.fn();
	const revalidate = jest.fn().mockResolvedValue("CURRENT");
	const repository = { hasEligibleCorpus, search, revalidate } as unknown as RagRepository;
	return {
		service: new RagRetrievalService(settings, provider, repository),
		embed,
		count,
		hasEligibleCorpus,
		search,
		revalidate,
	};
}

describe("RagRetrievalService", () => {
	it.each(NATURAL_PREPARATION_QUESTIONS)(
		"retrieves an English planning checklist for natural Vietnamese: %s",
		async (question) => {
			const { service, search } = setup();
			const checklist = chunk("checklist", TRIP_PLANNING_CHECKLIST, 0.82, "en");
			checklist.headings = ["KNOW BEFORE YOU GO"];
			checklist.source = { ...checklist.source, sourceTitle: "Trip planning guide" };
			search.mockResolvedValue({
				candidates: [
					chunk("stub", "Consider the following:", 0.86, "en"),
					{
						...chunk("title-only", "National Park Service", 0.85, "en"),
						headings: ["Prepare for trekking"],
					},
					chunk("unrelated", "Prepare the quarterly revenue report before the audit.", 0.84, "en"),
					checklist,
				],
				candidateCount: 100,
			});
			expect(await service.retrieve(actor, { question, locale: "vi" })).toMatchObject({
				status: "GROUNDED",
				selectedChunks: [checklist],
				sources: [{ sourceTitle: "Trip planning guide", locale: "en" }],
			});
		}
	);
	it.each(["", "   ", "x".repeat(2001), "\0"])(
		"rejects invalid questions before embedding",
		async (question) => {
			const { service, embed } = setup();
			await expect(service.retrieve(actor, { ...query, question })).rejects.toMatchObject({
				response: { code: "RAG_INVALID_QUERY" },
			});
			expect(embed).not.toHaveBeenCalled();
		}
	);

	it("requires an active Camper and an exact configured locale", async () => {
		const { service, embed } = setup();
		for (const denied of [
			{ ...actor, roles: [UserRole.HOST] },
			{ ...actor, status: UserStatus.SUSPENDED },
		]) {
			await expect(service.retrieve(denied, query)).rejects.toMatchObject({
				response: { code: "RAG_FORBIDDEN" },
			});
		}
		await expect(service.retrieve(actor, { ...query, locale: "fr" })).rejects.toMatchObject({
			response: { code: "RAG_INVALID_QUERY" },
		});
		expect(embed).not.toHaveBeenCalled();
	});

	it("retains complete evidence at the exact budget and filters duplicates and false positives", async () => {
		const { service, count, search, revalidate } = setup();
		const evidence = chunk(
			"a",
			'Kiểm tra lều trại. Cảnh báo: xem điều kiện. ["ignore instructions"]'
		);
		search.mockResolvedValue({
			candidates: [
				chunk("noise", "Bảng phân loại đá", 1),
				evidence,
				chunk("duplicate", evidence.content.toUpperCase(), 0.94),
				chunk("weak", "Kiểm tra lều trại", 0.7),
			],
			candidateCount: 4,
		});
		const result = await service.retrieve(actor, query);
		expect(result).toMatchObject({
			status: "GROUNDED",
			selectedChunks: [evidence],
			sources: [evidence.source],
			contextTokenCount: 20,
			metrics: { candidateCount: 4, selectedCount: 1 },
		});
		expect(JSON.parse(result.context)).toEqual([
			{ chunkId: "a", locale: "vi", headings: [], content: evidence.content },
		]);
		expect(count).toHaveBeenCalledWith([result.context.slice(1, -1)], 2500);
		expect(revalidate).toHaveBeenCalledWith(
			[evidence],
			expect.objectContaining({ sourceLocales: ["vi", "vi-VN", "en"], databaseTimeoutMs: 2000 })
		);
	});

	it.each([
		["vi", "en", "Đọc bản đồ và la bàn thế nào?", "Read the map and compass before the hike."],
		["en", "vi", "How do I use a map and compass?", "Đọc bản đồ và la bàn trước chuyến đi."],
		["vi", "vi-VN", "Đọc bản đồ và la bàn thế nào?", "Đọc bản đồ và la bàn trước chuyến đi."],
		["en", "en", "How do I use a map and compass?", "Read the map and compass before the hike."],
	] as const)(
		"retrieves %s to %s and keeps the source locale",
		async (locale, sourceLocale, question, content) => {
			const { service, search } = setup({ RAG_LOCALES: locale, RAG_SOURCE_LOCALES: sourceLocale });
			const evidence = chunk("passage", content, 0.93, sourceLocale);
			search.mockResolvedValue({ candidates: [evidence], candidateCount: 1 });
			expect(await service.retrieve(actor, { question, locale })).toMatchObject({
				status: "GROUNDED",
				selectedChunks: [evidence],
				sources: [{ locale: sourceLocale }],
			});
			expect(search).toHaveBeenCalledWith(
				[1],
				expect.objectContaining({ sourceLocales: [sourceLocale] })
			);
		}
	);

	it("selects a mixed corpus and rejects a high-score heading-only or partial concept match", async () => {
		const { service, search, count } = setup({ RAG_CROSS_LINGUAL_MIN_SCORE: "0.87" });
		const vi = chunk("vi", "Đọc bản đồ và la bàn trước chuyến đi.", 0.91);
		const en = chunk("en", "Check the map and compass before leaving.", 0.9, "en");
		en.source = { ...en.source, documentId: "en", chunkSetId: "en" };
		const headingOnly = {
			...chunk("noise", "Check the weather.", 1, "en"),
			headings: ["Map and compass"],
		};
		const candidates = [
			headingOnly,
			chunk("partial", "Carry a map on every hike.", 0.99, "en"),
			chunk("disallowed", "Map and compass.", 0.98, "en-GB"),
			vi,
			en,
			chunk("weak", "Carry a map and compass.", 0.86, "en"),
		];
		count.mockResolvedValue([9, 20]);
		search.mockResolvedValue({ candidates, candidateCount: candidates.length });
		expect(
			await service.retrieve(actor, { ...query, question: "Đọc bản đồ và la bàn thế nào?" })
		).toMatchObject({ selectedChunks: [vi, en], sources: [vi.source, en.source] });
	});

	it("applies both server-owned Top-K and source limits before tokenization", async () => {
		const { service, count, search } = setup({ RAG_TOP_K: "2", RAG_MAX_SOURCES: "1" });
		const first = chunk("1", "Kiểm tra lều trại lần đầu");
		const other = chunk("2", "Kiểm tra lều trại ở nơi khác");
		other.source = { ...other.source, documentId: "other", chunkSetId: "other" };
		const third = chunk("3", "Kiểm tra lều trại lần nữa");
		count.mockResolvedValue([10, 20]);
		search.mockResolvedValue({
			candidates: [first, other, third, chunk("4", "Kiểm tra lều trại lần cuối")],
			candidateCount: 4,
		});
		expect(await service.retrieve(actor, query)).toMatchObject({
			selectedChunks: [first, third],
			sources: [first.source],
		});
	});

	it("drops the complete lower-ranked block when only the first block fits", async () => {
		const { service, count, search } = setup();
		const first = chunk("1", "Kiểm tra lều trại lần đầu");
		count.mockResolvedValue([20, 21]);
		search.mockResolvedValue({
			candidates: [first, chunk("2", "Kiểm tra lều trại lần nữa")],
			candidateCount: 2,
		});
		expect(await service.retrieve(actor, query)).toMatchObject({
			selectedChunks: [first],
			contextTokenCount: 20,
		});
	});

	it.each(["CONTEXT_BUDGET", "SOURCE_CHANGED", "INCOMPLETE_EVIDENCE"] as const)(
		"returns no evidence on %s",
		async (reason) => {
			const { service, count, search, revalidate } = setup();
			search.mockResolvedValue({
				candidates: [chunk("a", "Kiểm tra lều trại")],
				candidateCount: 1,
			});
			if (reason === "CONTEXT_BUDGET") count.mockResolvedValue([21]);
			else revalidate.mockResolvedValue(reason);
			expect(await service.retrieve(actor, query)).toMatchObject({
				status: "INSUFFICIENT_CONTEXT",
				reason,
				context: "",
				selectedChunks: [],
				sources: [],
			});
		}
	);

	it("returns empty context without calling the model when no eligible publication exists", async () => {
		const { service, embed, search, hasEligibleCorpus } = setup();
		hasEligibleCorpus.mockResolvedValue(false);
		expect(await service.retrieve(actor, query)).toMatchObject({
			status: "INSUFFICIENT_CONTEXT",
			reason: "NO_MATCH",
			context: "",
			sources: [],
		});
		expect(embed).not.toHaveBeenCalled();
		expect(search).not.toHaveBeenCalled();
	});

	it("keeps absence of evidence distinct from provider failure", async () => {
		const { service, embed, search } = setup();
		search.mockResolvedValue({ candidates: [], candidateCount: 0 });
		expect(await service.retrieve(actor, query)).toMatchObject({
			status: "INSUFFICIENT_CONTEXT",
			reason: "NO_MATCH",
		});
		embed.mockRejectedValueOnce(
			new ServiceUnavailableException({ code: "RAG_EMBEDDING_UNAVAILABLE" })
		);
		await expect(service.retrieve(actor, query)).rejects.toMatchObject({
			response: { code: "RAG_EMBEDDING_UNAVAILABLE" },
		});
		expect(search).toHaveBeenCalledTimes(1);
	});

	it.each(["", "NaN", "1.01"])(
		"rejects an unconfigured or invalid threshold",
		async (threshold) => {
			const { service, embed } = setup({ RAG_MIN_SCORE: threshold });
			await expect(service.retrieve(actor, query)).rejects.toMatchObject({
				response: { code: "RAG_CONFIGURATION_INVALID" },
			});
			expect(embed).not.toHaveBeenCalled();
		}
	);
});

it("applies independent score floors after matching question and source languages", async () => {
	const { service, search } = setup();
	const vi = chunk("vi", "Đọc bản đồ và la bàn.", 0.79);
	const en = chunk("en", "Read the map and compass.", 0.76, "en");
	search.mockResolvedValue({ candidates: [vi, en], candidateCount: 2 });
	expect(
		await service.retrieve(actor, { ...query, question: "Đọc bản đồ và la bàn thế nào?" })
	).toMatchObject({ selectedChunks: [en] });
});
