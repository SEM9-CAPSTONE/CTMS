import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AiAnswersRepository } from "../src/modules/ai-answers/ai-answers.repository";
import { AI_PROMPT_VERSION } from "../src/modules/ai-answers/ai-answers.types";
import { AiGenerationProvider } from "../src/modules/ai-answers/ai-generation.provider";
import { AppModule } from "../src/modules/app.module";
import { KnowledgeChunksProvider } from "../src/modules/knowledge-chunks/knowledge-chunks.provider";
import { KnowledgeChunksRepository } from "../src/modules/knowledge-chunks/knowledge-chunks.repository";
import {
	type ChunkConfiguration,
	type ChunkOutput,
	type ChunkSet,
	ChunkSetStatus,
	IngestionError,
	MAX_ATTEMPTS,
	MAX_RECOVERY_ROUNDS,
} from "../src/modules/knowledge-chunks/knowledge-chunks.types";
import { KnowledgeChunksWorker } from "../src/modules/knowledge-chunks/knowledge-chunks.worker";
import { RagEmbeddingProvider } from "../src/modules/rag/rag-embedding.provider";
import { RagRetrievalService } from "../src/modules/rag/rag-retrieval.service";
import { RagConfig } from "../src/modules/rag/rag.config";
import { RagRepository } from "../src/modules/rag/rag.repository";
import {
	Classification,
	RightsStatus,
} from "../src/modules/survival-documents/survival-documents.types";
import { SurvivalSourceReader } from "../src/modules/survival-documents/survival-source-reader.service";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";
import { providerInferenceTraceFixture } from "./support/inference-trace-fixture";
import {
	integrityFixture,
	verifiedIntegrity,
	withIntegrity,
} from "./support/knowledge-integrity-fixture";
import { prepareSurvivalSourceFixture } from "./support/prepared-survival-source";
import {
	type SourceTestDetail,
	fictionalMetadata,
	fictionalRights,
	uniqueFictionalPdf,
} from "./support/survival-source-fixture";
import {
	NATURAL_PREPARATION_QUESTIONS,
	TRIP_PLANNING_CHECKLIST,
} from "./support/trip-planning-retrieval-fixture";

describe("CTMS-051 durable ingestion and provenance", () => {
	let app: INestApplication;
	let db: DataSource;
	let repo: KnowledgeChunksRepository;
	let configuration: ChunkConfiguration;
	let provider: KnowledgeChunksProvider;
	let worker: KnowledgeChunksWorker;
	let rag: RagRetrievalService;
	let ragConfig: RagConfig;
	const ragProvider = {
		embed: jest.fn(),
		countPrefixes: jest.fn(),
	};
	const generationProvider = { generate: jest.fn() };
	let root: string;
	let auth: string;
	let camperAuth: string;
	const admin = randomUUID();
	const camper = randomUUID();
	const uploadedOriginals = new Map<string, Buffer>();
	const endpoint = "/api/admin/survival-documents";
	const chunkEndpoint = (doc: SourceTestDetail) =>
		`${endpoint}/${doc.id}/versions/${doc.versions[0].id}/chunk-sets`;
	beforeAll(async () => {
		root = await mkdtemp(join(tmpdir(), "ctms51-"));
		process.env.SURVIVAL_DOCUMENT_STORAGE_ROOT = root;
		const module = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(RagEmbeddingProvider)
			.useValue(ragProvider)
			.overrideProvider(AiGenerationProvider)
			.useValue(generationProvider)
			.compile();
		app = module.createNestApplication();
		app.setGlobalPrefix("api");
		app.useGlobalPipes(
			new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
		);
		await app.init();
		db = module.get(DataSource);
		await assertSafeTestDatabase(db);
		repo = module.get(KnowledgeChunksRepository);
		provider = module.get(KnowledgeChunksProvider);
		worker = module.get(KnowledgeChunksWorker);
		configuration = provider.configuration();
		rag = module.get(RagRetrievalService);
		ragConfig = module.get(RagConfig);
		const jwt = module.get(JwtService);
		for (const [id, role] of [
			[admin, "admin"],
			[camper, "camper"],
		]) {
			await db.query(
				"INSERT INTO users(id,email,password_hash,role,status,full_name) VALUES($1,$2,'unused',$3,'active','CTMS51 test')",
				[id, `${id}@example.test`, role]
			);
			await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,$2)", [id, role]);
		}
		auth = `Bearer ${jwt.sign({ sub: admin, roles: ["admin"] })}`;
		camperAuth = `Bearer ${jwt.sign({ sub: camper, roles: ["camper"] })}`;
	}, 90000);
	beforeEach(async () => {
		// Reconcile intentionally scans every eligible current publication. Clearing
		// only derived sets resurrects prior cases' sources as missing work.
		// This connection was checked by assertSafeTestDatabase in beforeAll.
		await db.query(
			"TRUNCATE knowledge_chunk_event_receipts,knowledge_chunk_publications,knowledge_chunks,knowledge_chunk_sets,knowledge_embeddings"
		);
		// Outbox events intentionally have no FK to deleted documents.
		await db.query("TRUNCATE survival_document_outbox,survival_documents CASCADE");
		uploadedOriginals.clear();
	});
	afterAll(async () => {
		await app?.close();
		if (root) await rm(root, { recursive: true, force: true });
		Reflect.deleteProperty(process.env, "SURVIVAL_DOCUMENT_STORAGE_ROOT");
	});
	async function draft(
		previous?: SourceTestDetail,
		classification = Classification.TREKKING_SAFETY,
		locale = fictionalMetadata.locale
	): Promise<SourceTestDetail> {
		const upload = request(app.getHttpServer())
			.post(previous ? `${endpoint}/${previous.id}/versions` : endpoint)
			.set("Authorization", auth)
			.field(
				"metadata",
				JSON.stringify({ ...fictionalMetadata, classification, locale, originalLocale: locale })
			);
		if (previous) upload.field("expectedDocumentRevision", String(previous.revision));
		const bytes = uniqueFictionalPdf();
		const document = (await upload.attach("file", bytes, `${randomUUID()}.pdf`).expect(201))
			.body as SourceTestDetail;
		uploadedOriginals.set(document.versions[0].id, Buffer.from(bytes));
		return document;
	}
	async function restrictedPublication(): Promise<SourceTestDetail> {
		const document = await draft(undefined, Classification.FIRST_AID);
		const version = document.versions[0];
		// Initialize a restricted source while it is still mutable. Publication
		// of a PDF and permission to process its knowledge are separate policies.
		const changed: Array<{ id: string }> = await db.query(
			`WITH changed AS (
				UPDATE survival_document_versions SET rights=$2::jsonb
				WHERE id=$1 AND status='DRAFT' RETURNING id
			) SELECT id FROM changed`,
			[
				version.id,
				JSON.stringify({ ...version.rights, rightsReviewStatus: RightsStatus.RESTRICTED }),
			]
		);
		expect(changed).toEqual([{ id: version.id }]);
		const published = await publish(document, false);
		expect(published.processingSyncStatus).toBe("NOT_PROCESSED");
		return published;
	}
	async function publish(input: SourceTestDetail, rights = true): Promise<SourceTestDetail> {
		const doc = await prepareSurvivalSourceFixture(
			app,
			db,
			auth,
			input,
			rights ? { rights: fictionalRights } : {}
		);
		const published = (
			await request(app.getHttpServer())
				.post(`${endpoint}/${doc.id}/versions/${doc.versions[0].id}/publish`)
				.set("Authorization", auth)
				.send({
					expectedRevision: doc.versions[0].revision,
					expectedDocumentRevision: doc.revision,
					...(rights ? { rights: fictionalRights } : {}),
				})
				.expect(201)
		).body as SourceTestDetail;
		// These existing cases exercise recovery/rebuild of published sources.
		// Remove only this setup extraction so they can claim a fresh generation;
		// the separate draft-lifecycle suite verifies continuity without this setup.
		await db.query("DELETE FROM knowledge_chunk_sets WHERE document_version_id=$1", [
			doc.versions[0].id,
		]);
		await db.query(
			`DELETE FROM knowledge_embeddings e WHERE e.document_id=$1 AND e.embedding_text=$2
		 AND NOT EXISTS(SELECT 1 FROM knowledge_chunks c WHERE c.embedding_id=e.id)`,
			[
				doc.id,
				`passage: ${doc.versions[0].metadata.sourceTitle}\nKiểm tra điều kiện trước khi xuất phát.`,
			]
		);
		return published;
	}
	async function enqueue(doc: SourceTestDetail): Promise<ChunkSet> {
		await repo.consumeEvents(configuration);
		const [set]: ChunkSet[] = await db.query(
			"SELECT * FROM knowledge_chunk_sets WHERE document_version_id=$1",
			[doc.versions[0].id]
		);
		expect(set).toBeDefined();
		return set;
	}
	async function replayPublication(versionId: string): Promise<void> {
		const receipts: Array<{ event_id: string }> = await db.query(
			`WITH replay AS (
			   DELETE FROM knowledge_chunk_event_receipts r USING survival_document_outbox e
			   WHERE r.event_id=e.id AND e.version_id=$1 AND e.event_type='published_version_changed'
			   RETURNING r.event_id
			 ) SELECT event_id FROM replay`,
			[versionId]
		);
		expect(receipts).toHaveLength(1);
	}
	function output(set: ChunkSet): ChunkOutput {
		return withIntegrity({
			extraction_snapshot: integrityFixture(set),
			document_version_id: set.document_version_id,
			source_version: set.source_version,
			checksum: set.checksum,
			locale: set.locale,
			configuration: set.configuration,
			quality: { status: "PASSED", issues: [], page_count: 1, integrity: verifiedIntegrity },
			chunks: [0, 1].map((index) => ({
				chunk_index: index,
				content: `Nguồn thử nghiệm ${index}`,
				embedding_text: `passage: Tiêu đề\nNguồn thử nghiệm ${index}`,
				headings: ["Tiêu đề"],
				token_count: 20,
				locations: [
					{
						page: 1,
						item_ref: `#/texts/${index}`,
						bbox: { l: 0, t: 10, r: 100, b: 0, coord_origin: "BOTTOMLEFT" },
					},
				],
				embedding: Array.from({ length: 384 }, (_, dimension) => (dimension === index ? 1 : 0)),
			})),
		});
	}
	async function claim(): Promise<ChunkSet> {
		const set = await repo.claim(configuration);
		if (!set) throw new Error("Expected queued ingestion");
		return set;
	}
	async function storedStatus(id: string) {
		return (await db.query("SELECT status FROM knowledge_chunk_sets WHERE id=$1", [id]))[0]
			.status as ChunkSetStatus;
	}
	it("audits exact-region verification, restricts access, replays safely and queues only the cached extraction", async () => {
		const doc = await publish(await draft());
		await enqueue(doc);
		const set = await claim();
		const result = output(set);
		const position = {
			id: "a".repeat(64),
			page: 1,
			bbox: result.chunks[0].locations[0].bbox,
			item_refs: ["#/texts/0"],
			kind: "text",
			original_text: "WARNING: check conditions",
			issues: ["ocr_critical_content_unverified"],
			related_figures: [],
			critical: true,
			excludable: false,
			assessment: "requires_manual_verification",
			attempts: [],
			decision: null,
		};
		result.extraction_snapshot = { ...integrityFixture(set), regions: [position] };
		result.quality = {
			status: "NEEDS_REVIEW",
			issues: position.issues,
			page_count: 1,
			integrity: { revision: 0, complete: false, regions: [position] },
		};
		result.chunks = [];
		await repo.finish(set, result);
		const path = `${endpoint}/${doc.id}/versions/${set.document_version_id}/content-verification`;
		await request(app.getHttpServer()).get(path).expect(401);
		await request(app.getHttpServer()).get(path).set("Authorization", camperAuth).expect(403);
		const payload = {
			extractionId: set.id,
			requestId: randomUUID(),
			expectedRevision: 0,
			action: "confirm",
			text: position.original_text,
			source_checked: true,
			context_checked: true,
			visual_checked: false,
		};
		await request(app.getHttpServer())
			.post(`${path}/${position.id}`)
			.set("Authorization", camperAuth)
			.send(payload)
			.expect(403);
		await request(app.getHttpServer())
			.post(`${path}/${position.id}`)
			.set("Authorization", auth)
			.send({
				...payload,
				action: "exclude",
				reason: "An attempted critical instruction exclusion",
			})
			.expect(422);
		await request(app.getHttpServer())
			.post(`${path}/${position.id}`)
			.set("Authorization", auth)
			.send(payload)
			.expect(201);
		await request(app.getHttpServer())
			.post(`${path}/${position.id}`)
			.set("Authorization", auth)
			.send(payload)
			.expect(201);
		await request(app.getHttpServer())
			.post(`${path}/${position.id}`)
			.set("Authorization", auth)
			.send({ ...payload, requestId: randomUUID() })
			.expect(409);
		const [audit] = await db.query(
			`SELECT count(*)::int AS count FROM audit_logs WHERE target_id=$1 AND action='survival_document.content_verify'`,
			[doc.id]
		);
		expect(audit.count).toBe(1);
		const next = await claim();
		expect(next.id).toBe(set.id);
		expect(next.extraction_snapshot?.revision).toBe(1);
		expect(next.extraction_snapshot?.regions[0].decision).toMatchObject({
			action: "confirm",
			text: position.original_text,
		});
		const source = await app.get(SurvivalSourceReader).readPublished(set.document_version_id);
		expect(createHash("sha256").update(source.bytes).digest("hex")).toBe(set.checksum);
	});

	it("distinguishes a same-PDF rebuild from first preparation and fences a superseded active source", async () => {
		const doc = await publish(await draft());
		const legacy = { ...configuration, pipeline_version: "ctms-hybrid-ocr-v4" };
		await repo.consumeEvents(legacy);
		const original = await repo.claim(legacy);
		if (!original) throw new Error("Missing legacy source claim");
		const legacyOutput = output(original);
		Reflect.deleteProperty(legacyOutput, "extraction_snapshot");
		await repo.finish(original, legacyOutput);
		const path = (document: SourceTestDetail) =>
			`${endpoint}/${document.id}/versions/${document.versions[0].id}/content-verification`;
		await request(app.getHttpServer())
			.get(path(doc))
			.set("Authorization", auth)
			.expect(200)
			.expect(({ body }) =>
				expect(body).toMatchObject({
					inUse: true,
					preparing: false,
					complete: true,
					available: false,
				})
			);
		await repo.reconcile(configuration);
		await request(app.getHttpServer())
			.get(path(doc))
			.set("Authorization", auth)
			.expect(200)
			.expect(({ body }) =>
				expect(body).toMatchObject({ inUse: true, preparing: true, complete: false })
			);
		const newer = await publish(await draft(doc));
		await enqueue(newer);
		await request(app.getHttpServer())
			.get(path(newer))
			.set("Authorization", auth)
			.expect(200)
			.expect(({ body }) =>
				expect(body).toMatchObject({ inUse: false, preparing: true, complete: false })
			);
		await request(app.getHttpServer())
			.get(path(doc))
			.set("Authorization", auth)
			.expect(200)
			.expect(({ body }) => expect(body.inUse).toBe(false));
	});
	it("fences superseded V1 while V2 needs review and serves only a complete current V2", async () => {
		// This case is outside the RAG describe's configuration hook. Keep its
		// score policy explicit instead of depending on a developer's .env.
		const settings = new RagConfig(
			new ConfigService({
				RAG_MIN_SCORE: "0.8",
				RAG_LOCALES: "vi,en",
				RAG_SOURCE_LOCALES: "vi,en",
			})
		).settings();
		const doc = await publish(await draft());
		await enqueue(doc);
		const first = await claim();
		await repo.finish(first, output(first));
		const newer = await publish(await draft(doc));
		await enqueue(newer);
		const second = await claim();
		const review = output(second);
		review.quality = { status: "NEEDS_REVIEW", issues: ["ocr_low_confidence"], page_count: 1 };
		review.chunks = [];
		await repo.finish(second, review);
		const repository = app.get(RagRepository);
		expect(await repository.hasEligibleCorpus(settings)).toBe(false);
		const [before] = await db.query(
			"SELECT chunk_set_id FROM knowledge_chunk_publications WHERE document_id=$1",
			[doc.id]
		);
		expect(before.chunk_set_id).toBe(first.id);
		expect((await repo.status(doc.id, first.document_version_id))[0].active).toBe(false);
		// Re-entry here represents a reviewed cached generation, never partial vectors.
		await db.query(
			"UPDATE knowledge_chunk_sets SET status='PENDING',next_attempt_at=clock_timestamp() WHERE id=$1",
			[second.id]
		);
		const complete = await claim();
		await repo.finish(complete, output(complete));
		const [after] = await db.query(
			"SELECT chunk_set_id FROM knowledge_chunk_publications WHERE document_id=$1",
			[doc.id]
		);
		expect(after.chunk_set_id).toBe(second.id);
		expect(await repository.hasEligibleCorpus(settings)).toBe(true);
		expect((await repo.status(doc.id, first.document_version_id))[0].active).toBe(false);
	});

	it("resumes a durable checkpoint after interruption without losing its source-bound extraction", async () => {
		const doc = await publish(await draft());
		await enqueue(doc);
		const set = await claim();
		await repo.checkpoint(set, output(set));
		await repo.finish(set, { error: "ingestion_transport", retryable: true });
		await db.query(
			"UPDATE knowledge_chunk_sets SET next_attempt_at=clock_timestamp() WHERE id=$1",
			[set.id]
		);
		const resumed = await claim();
		expect(resumed.extraction_snapshot).toMatchObject({
			checksum: set.checksum,
			document_version_id: set.document_version_id,
		});
		await repo.finish(resumed, output(resumed));
		expect(await repo.finish(resumed, output(resumed))).toBe(false);
		const [count] = await db.query(
			"SELECT count(*)::int AS count FROM knowledge_chunks WHERE chunk_set_id=$1",
			[set.id]
		);
		expect(count.count).toBe(2);
	});

	it("guards exact-version status and rejects manual enqueue", async () => {
		const doc = await draft();
		await request(app.getHttpServer()).get(chunkEndpoint(doc)).expect(401);
		await request(app.getHttpServer())
			.get(chunkEndpoint(doc))
			.set("Authorization", camperAuth)
			.expect(403);
		const unverified = await draft(undefined, Classification.FIRST_AID);
		await repo.consumeEvents(configuration);
		await request(app.getHttpServer())
			.get(chunkEndpoint(unverified))
			.set("Authorization", auth)
			.expect(200, []);
		const valid = await publish(doc, false);
		await request(app.getHttpServer())
			.post(chunkEndpoint(valid))
			.set("Authorization", auth)
			.expect(404);
		await repo.consumeEvents(configuration);
		const status = await request(app.getHttpServer())
			.get(chunkEndpoint(valid))
			.set("Authorization", auth)
			.expect(200);
		expect(status.body).toMatchObject([
			{ document_version_id: valid.versions[0].id, status: ChunkSetStatus.PENDING },
		]);
		await request(app.getHttpServer())
			.get(`${endpoint}/${valid.id}/versions/${randomUUID()}/chunk-sets`)
			.set("Authorization", auth)
			.expect(404);
	});
	it("replays publication idempotently and claims at most once", async () => {
		const doc = await publish(await draft());
		const initial = await enqueue(doc);
		await replayPublication(initial.document_version_id);
		await Promise.all([repo.consumeEvents(configuration), repo.consumeEvents(configuration)]);
		const summaries = await repo.status(doc.id, initial.document_version_id);
		expect(summaries).toMatchObject([{ id: initial.id, status: ChunkSetStatus.PENDING }]);
		const claims = await Promise.all([
			repo.claim(configuration),
			repo.claim(configuration),
			repo.claim(configuration),
		]);
		expect(claims.filter(Boolean)).toHaveLength(1);
		const set = claims.find((item): item is ChunkSet => item !== null);
		if (!set) throw new Error("Missing claim");
		expect(await repo.finish(set, output(set))).toBe(true);
		expect(await repo.finish(set, output(set))).toBe(false);
		const chunks = await repo.readCurrent(doc.id);
		expect(chunks).toHaveLength(2);
		expect(chunks[0]).toMatchObject({
			source_version: 1,
			document_version_id: doc.versions[0].id,
			chunk_index: 0,
			locale: "vi",
		});
		expect((await enqueue(doc)).id).toBe(set.id);
	});
	it.each(["ctms-hybrid-v1", "ctms-hybrid-ocr-v2", "ctms-hybrid-ocr-v3"])(
		"reprocesses the stored original under the current OCR pipeline once after %s extraction failed",
		async (legacyPipeline) => {
			const doc = await publish(await draft());
			const legacy = { ...configuration, pipeline_version: legacyPipeline };
			await repo.consumeEvents(legacy);
			const old = await repo.claim(legacy);
			expect(old).toBeDefined();
			if (!old) throw new Error("Missing legacy claim");
			expect(old.document_version_id).toBe(doc.versions[0].id);
			expect(old.checksum).toBe(doc.versions[0].checksum);
			await repo.finish(old, {
				...output(old),
				quality: { status: "NEEDS_REVIEW", issues: ["page_text_unverifiable"], page_count: 1 },
				chunks: [],
			});
			await Promise.all([repo.reconcile(configuration), repo.reconcile(configuration)]);
			const sets = await repo.status(doc.id, doc.versions[0].id);
			expect(sets).toHaveLength(2);
			expect(sets.map((set) => set.configuration.pipeline_version).sort()).toEqual(
				[configuration.pipeline_version, legacyPipeline].sort()
			);
			const next = await repo.claim(configuration);
			if (!next) throw new Error("Missing OCR claim");
			expect(next.document_version_id).toBe(old.document_version_id);
			expect(next.checksum).toBe(old.checksum);
			expect(next.config_hash).not.toBe(old.config_hash);
			const source = await app.get(SurvivalSourceReader).readPublished(next.document_version_id);
			expect(source.bytes).toEqual(uploadedOriginals.get(old.document_version_id));
			expect(source.manifest).toMatchObject({
				versionId: old.document_version_id,
				checksum: old.checksum,
			});
			expect(createHash("sha256").update(source.bytes).digest("hex")).toBe(old.checksum);
			expect(next.document_version_id).toBe(old.document_version_id);
			expect(
				await repo.reusableEmbeddings(
					next,
					output(next).chunks.map((c) => c.embedding_text)
				)
			).toEqual(new Map());
			expect(await repo.readCurrent(doc.id)).toEqual([]);
			await repo.finish(next, output(next));
			expect(await storedStatus(old.id)).toBe(ChunkSetStatus.NEEDS_REVIEW);
			expect(await repo.readCurrent(doc.id)).toHaveLength(2);
			await repo.reconcile(configuration);
			expect(await repo.status(doc.id, doc.versions[0].id)).toHaveLength(2);
		}
	);
	it("recovers legacy rollout HTTP 422 failures within the existing recovery cap", async () => {
		const doc = await publish(await draft());
		const rolloutConfiguration = { ...configuration, pipeline_version: "ctms-hybrid-ocr-v2" };
		await repo.consumeEvents(rolloutConfiguration);
		for (let round = 0; round <= MAX_RECOVERY_ROUNDS; round++) {
			const set = await repo.claim(rolloutConfiguration);
			if (!set) throw new Error("Missing legacy rollout claim");
			await repo.finish(set, { error: "ingestion_http_422", retryable: false });
			const [state] = await repo.status(doc.id, set.document_version_id);
			expect(state).toMatchObject({
				status: ChunkSetStatus.FAILED,
				automatic_recovery_pending: round < MAX_RECOVERY_ROUNDS,
			});
			expect(await repo.readCurrent(doc.id)).toEqual([]);
			expect(await repo.hasRecoverableFailures(rolloutConfiguration)).toBe(
				round < MAX_RECOVERY_ROUNDS
			);
			await repo.recoverFailed(rolloutConfiguration);
		}
		expect(await repo.claim(rolloutConfiguration)).toBeNull();
	});
	it("does not publish partial embeddings and retries transport failures", async () => {
		const doc = await publish(await draft());
		await enqueue(doc);
		const set = await claim();
		const invalid = output(set);
		invalid.chunks[1].embedding = [];
		await expect(repo.finish(set, invalid)).rejects.toThrow("invalid_ingestion_output");
		expect(await repo.readCurrent(doc.id)).toEqual([]);
		expect(
			await db.query("SELECT id FROM knowledge_chunks WHERE chunk_set_id=$1", [set.id])
		).toEqual([]);
		await repo.finish(set, { error: "ingestion_transport", retryable: true });
		expect(await storedStatus(set.id)).toBe(ChunkSetStatus.PENDING);
		await db.query("UPDATE knowledge_chunk_sets SET next_attempt_at=now() WHERE id=$1", [set.id]);
		const retry = await claim();
		await repo.finish(retry, output(retry));
		expect(await storedStatus(set.id)).toBe(ChunkSetStatus.READY);
	});
	it("keeps extraction failures visible as NEEDS_REVIEW without chunks", async () => {
		const doc = await publish(await draft());
		await enqueue(doc);
		const set = await claim();
		const result = output(set);
		result.quality = {
			status: "NEEDS_REVIEW",
			issues: ["missing_critical_pdf_text"],
			page_count: 1,
		};
		result.chunks = [];
		await repo.finish(set, result);
		expect(await storedStatus(set.id)).toBe(ChunkSetStatus.NEEDS_REVIEW);
		expect(await repo.readCurrent(doc.id)).toEqual([]);
		const status = await request(app.getHttpServer())
			.get(chunkEndpoint(doc))
			.set("Authorization", auth)
			.expect(200);
		expect(status.body[0].quality_report.issues).toContain("missing_critical_pdf_text");
		await replayPublication(set.document_version_id);
		expect((await enqueue(doc)).status).toBe(ChunkSetStatus.NEEDS_REVIEW);
		expect(await repo.hasRecoverableFailures(configuration)).toBe(false);
		expect(await repo.claim(configuration)).toBeNull();
	});
	it("fences expired workers after a lease is reclaimed", async () => {
		const doc = await publish(await draft());
		await enqueue(doc);
		const old = await claim();
		await db.query(
			"UPDATE knowledge_chunk_sets SET lease_until=now()-interval '1 second' WHERE id=$1",
			[old.id]
		);
		expect(await repo.claim(configuration)).toBeNull();
		expect(await storedStatus(old.id)).toBe(ChunkSetStatus.PENDING);
		await db.query("UPDATE knowledge_chunk_sets SET next_attempt_at=now() WHERE id=$1", [old.id]);
		const replacement = await claim();
		expect(replacement.lease_token).not.toBe(old.lease_token);
		expect(await repo.heartbeat(old)).toBe(false);
		expect(await repo.finish(old, output(old))).toBe(false);
		expect(await repo.heartbeat(replacement)).toBe(true);
		expect(await repo.finish(replacement, output(replacement))).toBe(true);
	});
	it("switches complete V2 atomically and retains exact historical V1 provenance", async () => {
		const v1 = await publish(await draft());
		await enqueue(v1);
		const first = await claim();
		await repo.finish(first, output(first));
		const v2 = await publish(await draft(v1));
		await enqueue(v2);
		const second = await claim();
		expect(await repo.readCurrent(v1.id)).toEqual([]);
		expect(
			await db.query("SELECT chunk_set_id FROM knowledge_chunk_publications WHERE document_id=$1", [
				v1.id,
			])
		).toEqual([]);
		await repo.finish(second, output(second));
		const chunks = await repo.readCurrent(v1.id);
		expect(chunks).toHaveLength(2);
		for (const chunk of chunks)
			expect(chunk).toMatchObject({
				chunk_set_id: second.id,
				source_version: 2,
				document_version_id: v2.versions[0].id,
			});
		expect(
			await db.query("SELECT DISTINCT source_version FROM knowledge_chunks WHERE chunk_set_id=$1", [
				first.id,
			])
		).toEqual([{ source_version: 1 }]);
		expect(
			await db.query("SELECT id FROM knowledge_embeddings WHERE document_id=$1", [v1.id])
		).toHaveLength(2);
	});
	it("reuses an inline historical vector and encodes only changed input through the worker", async () => {
		const v1 = await publish(await draft());
		await enqueue(v1);
		const first = await claim();
		const oldOutput = output(first);
		await repo.finish(first, oldOutput);
		const previous = await repo.readCurrent(v1.id);
		// Simulate chunk rows written before shared storage was introduced.
		await db.query(
			`UPDATE knowledge_chunks c SET embedding=e.embedding,embedding_id=NULL
			FROM knowledge_embeddings e WHERE c.embedding_id=e.id AND c.chunk_set_id=$1`,
			[first.id]
		);
		await db.query("DELETE FROM knowledge_embeddings WHERE document_id=$1", [v1.id]);

		const v2 = await publish(await draft(v1));
		const second = await enqueue(v2);
		const prepared = output(second);
		prepared.quality.page_count = 2;
		prepared.chunks[0].locations[0].page = 2;
		prepared.chunks[1].embedding_text = `passage: Updated heading\n${prepared.chunks[1].content}`;
		const config = app.get(ConfigService);
		const get = config.get.bind(config);
		const configSpy = jest
			.spyOn(config, "get")
			.mockImplementation((key: string) =>
				key === "KNOWLEDGE_SERVICE_TOKEN" ? "test-token" : get(key)
			);
		const fetcher = jest
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(Response.json(withIntegrity(prepared)))
			.mockResolvedValueOnce(Response.json({ embeddings: [prepared.chunks[1].embedding] }));
		try {
			expect(await worker.processOne()).toBe(true);
			expect(fetcher).toHaveBeenCalledTimes(2);
			expect(String(fetcher.mock.calls[1][0])).toMatch(/\/passage-embeddings$/);
			expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).passages).toEqual([
				prepared.chunks[1].embedding_text,
			]);
			const [updated] = await repo.readCurrent(v1.id);
			expect(updated).toMatchObject({
				document_version_id: second.document_version_id,
				embedding: previous[0].embedding,
				metadata: { locations: [expect.objectContaining({ page: 2 })] },
			});
			expect(updated.id).not.toBe(previous[0].id);
		} finally {
			configSpy.mockRestore();
			fetcher.mockRestore();
		}
	});
	it("rejects obsolete output when publication races with completion", async () => {
		const doc = await publish(await draft());
		await enqueue(doc);
		const set = await claim();
		const newer = await draft(doc);
		await Promise.all([publish(newer), repo.finish(set, output(set))]);
		expect(await repo.readCurrent(doc.id)).toEqual([]);
		const status = await storedStatus(set.id);
		expect([ChunkSetStatus.READY, ChunkSetStatus.OBSOLETE]).toContain(status);
	});
	it("prevents a superseded V1 job from writing chunks after V2 publishes", async () => {
		const doc = await publish(await draft());
		await enqueue(doc);
		const set = await claim();
		await publish(await draft(doc));
		await repo.finish(set, output(set));
		expect(await storedStatus(set.id)).toBe(ChunkSetStatus.OBSOLETE);
		expect(
			await db.query("SELECT id FROM knowledge_chunks WHERE chunk_set_id=$1", [set.id])
		).toEqual([]);
	});
	it("rolls back all chunks and the active pointer when persistence fails", async () => {
		const doc = await publish(await draft());
		await enqueue(doc);
		const set = await claim();
		await db.query(
			"ALTER TABLE knowledge_chunks ADD CONSTRAINT ctms51_test_failure CHECK(chunk_index<>1)"
		);
		try {
			await expect(repo.finish(set, output(set))).rejects.toThrow("ctms51_test_failure");
			expect(await storedStatus(set.id)).toBe(ChunkSetStatus.RUNNING);
			expect(
				await db.query("SELECT id FROM knowledge_chunks WHERE chunk_set_id=$1", [set.id])
			).toEqual([]);
			expect(
				await db.query("SELECT id FROM knowledge_embeddings WHERE document_id=$1", [doc.id])
			).toEqual([]);
			expect(await repo.readCurrent(doc.id)).toEqual([]);
		} finally {
			await db.query("ALTER TABLE knowledge_chunks DROP CONSTRAINT ctms51_test_failure");
		}
		await repo.finish(set, output(set));
		expect(await storedStatus(set.id)).toBe(ChunkSetStatus.READY);
	});
	it("runs the worker through the real private-file reader and completes its exact claim", async () => {
		const doc = await publish(await draft(), false);
		await db.query(
			"INSERT INTO knowledge_chunk_event_receipts(event_id) SELECT id FROM survival_document_outbox WHERE document_id<>$1 ON CONFLICT DO NOTHING",
			[doc.id]
		);
		await repo.consumeEvents(configuration);
		const generate = jest.spyOn(provider, "generate").mockImplementation(async (set, bytes) => {
			expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
			expect(set.document_version_id).toBe(doc.versions[0].id);
			return output(set);
		});
		try {
			expect(await worker.processOne()).toBe(true);
			expect(generate).toHaveBeenCalledTimes(1);
			expect(await worker.processOne()).toBe(false);
			expect(await repo.readCurrent(doc.id)).toHaveLength(2);
		} finally {
			generate.mockRestore();
		}
	});
	it("reconciles an old receipt once the same publication has a verified source", async () => {
		const doc = await publish(await draft(), false);
		const version = doc.versions[0];
		const approval = `${endpoint}/${doc.id}/versions/${version.id}/approve-processing`;
		const hosts = jest.replaceProperty(process.env, "SURVIVAL_KNOWLEDGE_APPROVED_HOSTS", "");
		try {
			await db.query(
				"INSERT INTO knowledge_chunk_event_receipts(event_id) SELECT id FROM survival_document_outbox WHERE document_id<>$1 ON CONFLICT DO NOTHING",
				[doc.id]
			);
			await repo.consumeEvents(configuration);
			expect(await repo.status(doc.id, version.id)).toEqual([]);
			await request(app.getHttpServer())
				.post(approval)
				.set("Authorization", auth)
				.send({ expectedRevision: version.revision })
				.expect(404);
		} finally {
			hosts.restore();
		}
		const checksums = jest.replaceProperty(
			process.env,
			"SURVIVAL_KNOWLEDGE_APPROVED_SHA256",
			version.checksum
		);
		try {
			await repo.reconcile(configuration);
			expect(await repo.status(doc.id, version.id)).toEqual([
				expect.objectContaining({ status: ChunkSetStatus.PENDING }),
			]);
		} finally {
			checksums.restore();
		}
	});
	it("backs off failed worker calls, checks service recovery and resumes after a worker restart", async () => {
		const doc = await publish(await draft());
		const set = await enqueue(doc);
		const restart = () =>
			new KnowledgeChunksWorker(
				repo,
				provider,
				app.get(SurvivalSourceReader),
				app.get(ConfigService)
			);
		const reconcile = jest.spyOn(repo, "reconcile").mockResolvedValue({
			candidates: 0,
			queued: 0,
			skipped: [],
			lastDocumentId: null,
		});
		const availability = jest
			.spyOn(provider, "isAvailable")
			.mockResolvedValueOnce(false)
			.mockResolvedValue(true);
		const generate = jest
			.spyOn(provider, "generate")
			.mockRejectedValue(new IngestionError("ingestion_transport", true));
		const due = () =>
			db.query("UPDATE knowledge_chunk_sets SET next_attempt_at=now() WHERE id=$1", [set.id]);
		try {
			for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
				await worker.processOne();
				const [state] = await repo.status(doc.id, set.document_version_id);
				expect(state).toMatchObject({
					attempts: attempt,
					status: attempt < MAX_ATTEMPTS ? ChunkSetStatus.PENDING : ChunkSetStatus.FAILED,
					automatic_recovery_pending: attempt === MAX_ATTEMPTS,
				});
				const [schedule]: Array<{ wait: number }> = await db.query(
					"SELECT extract(epoch FROM (next_attempt_at-clock_timestamp()))::float AS wait FROM knowledge_chunk_sets WHERE id=$1",
					[set.id]
				);
				expect(schedule.wait).toBeGreaterThan([25, 55, 890][attempt - 1]);
				expect(await worker.processOne()).toBe(false);
				await due();
			}
			await restart().tick();
			expect(await storedStatus(set.id)).toBe(ChunkSetStatus.FAILED);
			expect(generate).toHaveBeenCalledTimes(MAX_ATTEMPTS);
			generate.mockImplementation(async (claim) => output(claim));
			await Promise.all([restart().tick(), restart().tick()]);
			expect(generate).toHaveBeenCalledTimes(MAX_ATTEMPTS + 1);
			expect(await repo.readCurrent(doc.id)).toHaveLength(2);
			const [state] = await repo.status(doc.id, set.document_version_id);
			expect(state).toMatchObject({ status: ChunkSetStatus.READY, attempts: 1, active: true });
		} finally {
			generate.mockRestore();
			availability.mockRestore();
			reconcile.mockRestore();
		}
	});
	it("caps recovery rounds and keeps a failed replacement out of current retrieval", async () => {
		const first = await publish(await draft());
		const ready = await enqueue(first);
		await repo.finish(await claim(), output(ready));
		const second = await publish(await draft(first));
		const failed = await enqueue(second);
		for (let round = 0; round <= MAX_RECOVERY_ROUNDS; round++) {
			for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
				await repo.finish(await claim(), { error: "ingestion_http_502", retryable: true });
				await db.query("UPDATE knowledge_chunk_sets SET next_attempt_at=now() WHERE id=$1", [
					failed.id,
				]);
			}
			await Promise.all([repo.recoverFailed(configuration), repo.recoverFailed(configuration)]);
		}
		const [state] = await repo.status(second.id, failed.document_version_id);
		expect(state).toMatchObject({
			status: ChunkSetStatus.FAILED,
			automatic_recovery_pending: false,
		});
		expect(await repo.hasRecoverableFailures(configuration)).toBe(false);
		expect(await repo.readCurrent(first.id)).toEqual([]);
		expect(
			await db.query("SELECT chunk_set_id FROM knowledge_chunk_publications WHERE document_id=$1", [
				first.id,
			])
		).toEqual([{ chunk_set_id: ready.id }]);
	});
	it("cancels work after archive and removes derived rows on document deletion", async () => {
		const doc = await publish(await draft());
		await enqueue(doc);
		const set = await claim();
		const archived = (
			await request(app.getHttpServer())
				.post(`${endpoint}/${doc.id}/versions/${doc.versions[0].id}/archive`)
				.set("Authorization", auth)
				.send({
					expectedRevision: doc.versions[0].revision,
					reason: "Nguồn thử nghiệm ngừng sử dụng",
				})
				.expect(201)
		).body as SourceTestDetail;
		await repo.finish(set, output(set));
		expect(await storedStatus(set.id)).toBe(ChunkSetStatus.OBSOLETE);
		expect(await repo.readCurrent(doc.id)).toEqual([]);
		await request(app.getHttpServer())
			.delete(`${endpoint}/${doc.id}?expectedRevision=${archived.revision}`)
			.set("Authorization", auth)
			.expect(204);
		expect(
			await db.query("SELECT id FROM knowledge_chunk_sets WHERE document_id=$1", [doc.id])
		).toEqual([]);
	});
	it("consumes publication outbox exactly once independently of other consumers", async () => {
		const eligible = await publish(await draft(), false);
		await restrictedPublication();
		await Promise.all([repo.consumeEvents(configuration), repo.consumeEvents(configuration)]);
		await repo.consumeEvents(configuration);
		expect(
			await db.query("SELECT document_id FROM knowledge_chunk_sets ORDER BY document_id")
		).toEqual([{ document_id: eligible.id }]);
		expect(
			await db.query("SELECT id FROM survival_document_outbox WHERE document_id=$1", [eligible.id])
		).toHaveLength(1);
	});
	it("processes an Admin-published medical source without treating NOT_REVIEWED as explicit rejection", async () => {
		const document = await publish(await draft(undefined, Classification.FIRST_AID), false);
		expect(document.versions[0].rights.medicalContentReviewStatus).toBe("NOT_REVIEWED");
		await Promise.all([repo.consumeEvents(configuration), repo.consumeEvents(configuration)]);
		expect(await repo.status(document.id, document.versions[0].id)).toMatchObject([
			{ status: ChunkSetStatus.PENDING, document_version_id: document.versions[0].id },
		]);
	});
	it("reconciles only eligible current versions with missing sets across concurrent reruns", async () => {
		const a1 = await publish(await draft(), false);
		const a2 = await publish(await draft(a1), false);
		const a3 = await publish(await draft(a2), false);
		const b1 = await publish(await draft(), false);
		const blocked = await restrictedPublication();
		const ids = [a3.id, b1.id, blocked.id];
		await db.query(
			"INSERT INTO knowledge_chunk_event_receipts(event_id) SELECT id FROM survival_document_outbox ON CONFLICT DO NOTHING"
		);
		const runs = await Promise.all([repo.reconcile(configuration), repo.reconcile(configuration)]);
		expect(runs.reduce((sum, result) => sum + result.queued, 0)).toBe(2);
		expect(await repo.reconcile(configuration)).toEqual({
			candidates: 1,
			queued: 0,
			lastDocumentId: blocked.id,
			skipped: [
				{ versionId: blocked.versions[0].id, reason: expect.stringContaining("hạn chế sử dụng") },
			],
		});
		const sets: Array<{ document_version_id: string }> = await db.query(
			"SELECT document_version_id FROM knowledge_chunk_sets WHERE document_id=ANY($1::uuid[])",
			[ids]
		);
		expect(sets.map((set) => set.document_version_id).sort()).toEqual(
			[a3.versions[0].id, b1.versions[0].id].sort()
		);
	});
	it.each([ChunkSetStatus.FAILED, ChunkSetStatus.NEEDS_REVIEW])(
		"does not collect V1 when V2 is %s",
		async (failure) => {
			const v1 = await publish(await draft(), false);
			await enqueue(v1);
			const first = await claim();
			await repo.finish(first, output(first));
			const v2 = await publish(await draft(v1), false);
			await enqueue(v2);
			const second = await claim();
			await repo.finish(
				second,
				failure === ChunkSetStatus.FAILED
					? { error: "ingestion_transport", retryable: false }
					: {
							...output(second),
							quality: {
								status: "NEEDS_REVIEW",
								issues: ["missing_critical_pdf_text"],
								page_count: 1,
							},
							chunks: [],
						}
			);
			expect(await storedStatus(second.id)).toBe(failure);
			expect(await repo.readCurrent(v1.id)).toEqual([]);
			expect(await repo.cleanupHistory(7)).toEqual({ deleted: 0, retainedByDependency: 0 });
			expect(await storedStatus(first.id)).toBe(ChunkSetStatus.READY);
		}
	);
	it("waits for replacement retention, document readers and restrictive approval references", async () => {
		const v1 = await publish(await draft(), false);
		await enqueue(v1);
		const first = await claim();
		await repo.finish(first, output(first));
		const [firstChunk] = await repo.readCurrent(v1.id);
		const v2 = await publish(await draft(v1), false);
		await enqueue(v2);
		const second = await claim();
		const replacement = output(second);
		replacement.chunks[1].embedding_text = `passage: New heading\n${replacement.chunks[1].content}`;
		await repo.finish(second, withIntegrity(replacement));
		expect(
			await db.query("SELECT id FROM knowledge_embeddings WHERE document_id=$1", [v1.id])
		).toHaveLength(3);
		expect(await repo.cleanupHistory(7)).toEqual({ deleted: 0, retainedByDependency: 0 });
		await db.query(
			"UPDATE knowledge_chunk_sets SET completed_at=now()-interval '8 days' WHERE id=$1",
			[second.id]
		);
		await db.query(`CREATE TABLE ctms51_test_guidance_reference (
			set_id uuid REFERENCES knowledge_chunk_sets(id) ON DELETE RESTRICT,
			chunk_id uuid REFERENCES knowledge_chunks(id) ON DELETE RESTRICT
		)`);
		try {
			await db.query("INSERT INTO ctms51_test_guidance_reference VALUES($1,$2)", [
				first.id,
				firstChunk.id,
			]);
			expect(await repo.cleanupHistory(7)).toEqual({ deleted: 0, retainedByDependency: 1 });
			await db.query("UPDATE ctms51_test_guidance_reference SET set_id=NULL");
			expect(await repo.cleanupHistory(7)).toEqual({ deleted: 0, retainedByDependency: 1 });
			await db.query("DELETE FROM ctms51_test_guidance_reference");

			const runner = db.createQueryRunner();
			await runner.startTransaction();
			try {
				await runner.query("SELECT id FROM survival_documents WHERE id=$1 FOR SHARE", [v1.id]);
				expect(await repo.cleanupHistory(7)).toEqual({ deleted: 0, retainedByDependency: 0 });
			} finally {
				await runner.rollbackTransaction();
				await runner.release();
			}
			const [firstCleanup, secondCleanup, currentChunks] = await Promise.all([
				repo.cleanupHistory(7),
				repo.cleanupHistory(7),
				repo.readCurrent(v1.id),
			]);
			// SKIP LOCKED can defer both attempts while retrieval holds a shared lock.
			const afterReaders = await repo.cleanupHistory(7);
			expect(firstCleanup.deleted + secondCleanup.deleted + afterReaders.deleted).toBe(1);
			expect(currentChunks).toHaveLength(2);
			for (const chunk of currentChunks) expect(chunk.chunk_set_id).toBe(second.id);
			expect(
				await db.query("SELECT id FROM knowledge_embeddings WHERE document_id=$1", [v1.id])
			).toHaveLength(2);
			expect(await repo.cleanupHistory(7)).toEqual({ deleted: 0, retainedByDependency: 0 });
			expect(
				await db.query("SELECT id FROM knowledge_chunks WHERE chunk_set_id=$1", [first.id])
			).toEqual([]);
			expect(
				await db.query("SELECT id FROM survival_document_versions WHERE id=$1", [v1.versions[0].id])
			).toEqual([{ id: v1.versions[0].id }]);
		} finally {
			await db.query("DROP TABLE ctms51_test_guidance_reference");
		}
	});
	describe("CTMS-068 RAG service boundary", () => {
		const question = { question: "Nguồn thử nghiệm", locale: "vi" };
		const retrieve = (input = question) =>
			rag.retrieve({ userId: camper, roles: [UserRole.CAMPER], status: UserStatus.ACTIVE }, input);

		beforeEach(() => {
			ragProvider.embed
				.mockReset()
				.mockResolvedValue(
					Array.from({ length: configuration.embedding_dimensions }, (_, index) =>
						Number(index === 0)
					)
				);
			ragProvider.countPrefixes.mockReset().mockResolvedValue([30]);
			const settings = new RagConfig(
				new ConfigService({
					RAG_MIN_SCORE: "0.8",
					RAG_LOCALES: "vi,en",
					RAG_SOURCE_LOCALES: "vi,en",
				})
			).settings();
			jest.spyOn(ragConfig, "settings").mockReturnValue(settings);
			jest.spyOn(ragConfig, "sourceLocales").mockReturnValue(settings.sourceLocales);
		});

		afterEach(() => jest.restoreAllMocks());

		async function ready(doc: SourceTestDetail, content?: string) {
			await enqueue(doc);
			const set = await claim();
			expect(set.document_version_id).toBe(doc.versions[0].id);
			const generated = output(set);
			if (content) {
				generated.chunks[0].content = content;
				generated.chunks[0].embedding_text = `passage: ${content}`;
			}
			expect(await repo.finish(set, withIntegrity(generated))).toBe(true);
			return set;
		}

		async function archive(doc: SourceTestDetail) {
			await request(app.getHttpServer())
				.post(`${endpoint}/${doc.id}/versions/${doc.versions[0].id}/archive`)
				.set("Authorization", auth)
				.send({ expectedRevision: doc.versions[0].revision, reason: "Withdraw fictional source" })
				.expect(201);
		}

		describe("CTMS-069 generation against real PostgreSQL and RAG", () => {
			const postAnswer = (
				requestId: string,
				authorization = camperAuth,
				text = question.question
			) =>
				request(app.getHttpServer())
					.post("/api/ai/answers")
					.set("Authorization", authorization)
					.send({ ...question, question: text, requestId });

			beforeEach(async () => {
				await db.query("DELETE FROM ai_answer_request_limits WHERE user_id=$1", [camper]);
				generationProvider.generate.mockReset().mockImplementation(async (raw: string) => {
					const { evidence } = JSON.parse(raw) as { evidence: Array<{ chunkId: string }> };
					return {
						status: "ANSWERED",
						answerText: "Hãy xem chú giải để hiểu ký hiệu bản đồ.",
						usedEvidenceIds: [evidence[0].chunkId],
						provider: "openai",
						model: "test-model",
						promptVersion: AI_PROMPT_VERSION,
						trace: providerInferenceTraceFixture,
					};
				});
			});

			it("answers from a PDF with recorded provenance and rights without a configured source host", async () => {
				const hosts = jest.replaceProperty(process.env, "SURVIVAL_KNOWLEDGE_APPROVED_HOSTS", "");
				try {
					const doc = await publish(await draft());
					await ready(doc);
					const answer = await postAnswer(randomUUID()).expect(200);
					expect(answer.body).toMatchObject({
						status: "ANSWERED",
						sources: [{ documentVersionId: doc.versions[0].id }],
					});
				} finally {
					hosts.restore();
				}
			});

			it("answers in Vietnamese from English evidence and keeps its citations after withdrawal", async () => {
				const doc = await publish(await draft(undefined, Classification.TREKKING_SAFETY, "en"));
				const content = "Read the map legend and check your compass before choosing a route.";
				const set = await ready(doc, content);
				const requestId = randomUUID();
				const ask = () => postAnswer(requestId, camperAuth, "Đọc bản đồ và la bàn thế nào?");
				const answer = await ask().expect(200);
				expect(answer.body).toMatchObject({
					status: "ANSWERED",
					answer: expect.stringContaining("Hãy xem chú giải"),
					sources: [
						{
							documentVersionId: set.document_version_id,
							sourceVersion: set.source_version,
							locale: "en",
							locations: [{ page: 1, itemRef: "#/texts/0" }],
						},
					],
				});
				expect(JSON.parse(generationProvider.generate.mock.calls[0][0])).toMatchObject({
					locale: "vi",
					evidence: [{ locale: "en", content }],
				});
				const [stored] = await db.query("SELECT generation FROM ai_answers WHERE id=$1", [
					answer.body.answerId,
				]);
				expect(stored.generation.trace).toMatchObject({
					responseLocale: "vi",
					sourceLocales: ["en"],
				});
				expect((await ask().expect(200)).body).toEqual(answer.body);
				await archive(doc);
				expect((await ask().expect(200)).body.status).toBe("INSUFFICIENT_CONTEXT");
				const historical = await request(app.getHttpServer())
					.get(`/api/ai/answers/${answer.body.answerId}/sources`)
					.set("Authorization", camperAuth)
					.expect(200);
				expect(historical.body.sources).toEqual(answer.body.sources);
			});

			it("persists exact provenance once across concurrent POSTs and retries, and restricts source access", async () => {
				const doc = await publish(await draft());
				const set = await ready(doc);
				const requestId = randomUUID();
				const concurrent = await Promise.all([postAnswer(requestId), postAnswer(requestId)]);
				const success = concurrent.find(({ status }) => status === 200);
				expect(success?.body).toMatchObject({
					status: "ANSWERED",
					answerId: expect.any(String),
					sources: [
						{
							documentVersionId: doc.versions[0].id,
							chunkSetId: set.id,
							sourceVersion: 1,
							locations: [{ page: 1, itemRef: "#/texts/0" }],
						},
					],
				});
				const retry = await postAnswer(requestId).expect(200);
				expect(retry.body).toEqual(success?.body);
				expect(retry.body).not.toHaveProperty("generation");
				expect(retry.body).not.toHaveProperty("trace");
				expect(generationProvider.generate).toHaveBeenCalledTimes(1);
				await postAnswer(requestId, camperAuth, "Một câu hỏi khác").expect(409);
				const rows: Array<{
					retrieved_evidence: unknown[];
					generation: unknown;
					retention_days: number;
				}> = await db.query(
					`SELECT retrieved_evidence, generation,
					 FLOOR(EXTRACT(epoch FROM (expires_at - created_at)) / 86400 + 0.5)::int AS retention_days
					 FROM ai_answers WHERE user_id=$1 AND request_id=$2`,
					[camper, requestId]
				);
				expect(rows).toHaveLength(1);
				expect(rows[0].retrieved_evidence).toMatchObject([{ source: { checksum: set.checksum } }]);
				expect(rows[0]).toMatchObject({
					generation: {
						trace: {
							...providerInferenceTraceFixture,
							schemaVersion: 1,
							retrievalSettings: { minScore: 0.8 },
							safetyPolicyVersion: "ctms-069-answer-safety-v1",
						},
					},
					retention_days: 30,
				});
				const sources = `/api/ai/answers/${retry.body.answerId}/sources`;
				await request(app.getHttpServer()).get(sources).set("Authorization", auth).expect(403);
				const ownerSources = await request(app.getHttpServer())
					.get(sources)
					.set("Authorization", camperAuth)
					.expect(200);
				expect(ownerSources.body.sources).toEqual(retry.body.sources);
				const v2 = await publish(await draft(doc));
				await ready(v2);
				expect(v2.versions[0].id).not.toBe(doc.versions[0].id);
				const withdrawn = await postAnswer(requestId).expect(200);
				expect(withdrawn.body).toMatchObject({ status: "INSUFFICIENT_CONTEXT", sources: [] });
				const supersededSources = await request(app.getHttpServer())
					.get(sources)
					.set("Authorization", camperAuth)
					.expect(200);
				expect(supersededSources.body).toEqual(ownerSources.body);
				await archive(v2);
				const archivedSources = await request(app.getHttpServer())
					.get(sources)
					.set("Authorization", camperAuth)
					.expect(200);
				expect(archivedSources.body).toEqual(ownerSources.body);
			});

			it("rejects a selection that leaves out part of a PDF item", async () => {
				const set = await ready(await publish(await draft()));
				await db.query(
					"UPDATE knowledge_chunks SET embedding=$2,embedding_id=NULL WHERE chunk_set_id=$1",
					[
						set.id,
						Array.from({ length: configuration.embedding_dimensions }, (_, index) =>
							Number(index === 0)
						),
					]
				);
				await db.query(
					"UPDATE knowledge_chunks SET metadata=jsonb_set(metadata,'{locations,0,item_ref}',to_jsonb($2::text)) WHERE chunk_set_id=$1 AND chunk_index=1",
					[set.id, "#/texts/0"]
				);
				ragProvider.countPrefixes.mockResolvedValue([20, 40]);
				const result = await postAnswer(randomUUID()).expect(200);
				expect(generationProvider.generate).toHaveBeenCalledTimes(1);
				expect(result.body).toMatchObject({ status: "INSUFFICIENT_CONTEXT", sources: [] });
			});

			it("rolls back the answer and trace when the write transaction fails", async () => {
				await ready(await publish(await draft()));
				const answers = app.get(AiAnswersRepository);
				const save = answers.save.bind(answers);
				jest.spyOn(answers, "save").mockImplementationOnce(async (...args) => {
					await save(...args);
					throw new Error("Simulate failure before commit");
				});
				const requestId = randomUUID();
				await postAnswer(requestId).expect(503);
				expect(
					await db.query("SELECT id FROM ai_answers WHERE request_id=$1", [requestId])
				).toEqual([]);
			});

			it.each(["supersede", "archive", "delete"])(
				"withholds a source changed by %s during generation",
				async (action) => {
					const doc = await publish(await draft());
					await ready(doc);
					const select = generationProvider.generate.getMockImplementation();
					generationProvider.generate.mockImplementationOnce(async (raw: string) => {
						if (action === "supersede") await publish(await draft(doc));
						else {
							await archive(doc);
							if (action === "delete") {
								const detail = await request(app.getHttpServer())
									.get(`${endpoint}/${doc.id}`)
									.set("Authorization", auth)
									.expect(200);
								await request(app.getHttpServer())
									.delete(`${endpoint}/${doc.id}?expectedRevision=${detail.body.revision}`)
									.set("Authorization", auth)
									.expect(204);
							}
						}
						return select?.(raw);
					});
					const requestId = randomUUID();
					const result = await postAnswer(requestId).expect(200);
					expect(result.body).toMatchObject({
						status: "INSUFFICIENT_CONTEXT",
						answer: null,
						sources: [],
					});
					expect(
						await db.query("SELECT id FROM ai_answers WHERE request_id=$1", [requestId])
					).toEqual([]);
				}
			);
		});

		it("retrieves English preparation guidance for a natural Vietnamese trekking question with exact provenance", async () => {
			const doc = await publish(await draft(undefined, Classification.TREKKING_SAFETY, "en"));
			const set = await ready(doc, TRIP_PLANNING_CHECKLIST);
			const result = await retrieve({ question: NATURAL_PREPARATION_QUESTIONS[0], locale: "vi" });
			expect(result).toMatchObject({
				status: "GROUNDED",
				sources: [{ documentVersionId: set.document_version_id, locale: "en" }],
			});
			if (result.status !== "GROUNDED") throw new Error("Expected eligible preparation evidence");
			expect(result.selectedChunks[0]).toMatchObject({
				content: TRIP_PLANNING_CHECKLIST,
				locations: [{ page: 1, itemRef: "#/texts/0" }],
			});
			await archive(doc);
			expect(
				await retrieve({ question: NATURAL_PREPARATION_QUESTIONS[0], locale: "vi" })
			).toMatchObject({ status: "INSUFFICIENT_CONTEXT", sources: [] });
		});
		it("searches across an eligible mixed corpus with a global candidate limit", async () => {
			const en = await ready(
				await publish(await draft(undefined, Classification.TREKKING_SAFETY, "en")),
				"Read the map legend. Pack your compass."
			);
			const vi = await ready(
				await publish(await draft()),
				"Xem chú giải bản đồ và kiểm tra la bàn."
			);
			ragProvider.countPrefixes.mockResolvedValue([20, 40]);
			const result = await retrieve({ question: "Cách đọc bản đồ và la bàn?", locale: "vi" });
			expect(result).toMatchObject({
				status: "GROUNDED",
				metrics: { candidateCount: 4, selectedCount: 2 },
				sources: expect.arrayContaining([
					expect.objectContaining({ locale: "en", chunkSetId: en.id }),
					expect.objectContaining({ locale: "vi", chunkSetId: vi.id }),
				]),
			});
			const original = result.selectedChunks.find(({ source }) => source.locale === "en");
			if (!original) throw new Error("Expected the original English chunk");
			const relabeled = { ...original, source: { ...original.source, locale: "vi" } };
			await expect(
				app.get(RagRepository).revalidate([relabeled], ragConfig.settings())
			).resolves.toBe("SOURCE_CHANGED");
			const settings = { ...ragConfig.settings(), maxCandidates: 3 };
			jest.spyOn(ragConfig, "settings").mockReturnValue(settings);
			await expect(retrieve()).rejects.toMatchObject({ response: { code: "RAG_CORPUS_LIMIT" } });
		});

		it("keeps a published medical PDF out of retrieval until automatic extraction is READY", async () => {
			const unreviewed = await publish(
				await draft(undefined, Classification.FIRST_AID, "en"),
				false
			);
			await repo.consumeEvents(configuration);
			expect(await repo.status(unreviewed.id, unreviewed.versions[0].id)).toMatchObject([
				{ status: ChunkSetStatus.PENDING },
			]);
			expect(await retrieve({ question: "Sơ cứu bong gân thế nào?", locale: "vi" })).toMatchObject({
				status: "INSUFFICIENT_CONTEXT",
				reason: "NO_MATCH",
				sources: [],
			});
			expect(ragProvider.embed).not.toHaveBeenCalled();
		});

		it("serves only active READY versions with verified provenance, fencing V1 during V2 rebuild", async () => {
			const v1 = await publish(await draft());
			const s1 = await ready(v1);
			const result = await retrieve();
			expect(result).toMatchObject({
				status: "GROUNDED",
				contextTokenCount: 30,
				selectedChunks: [
					{ chunkIndex: 0, score: 1, locations: [{ page: 1, itemRef: "#/texts/0" }] },
				],
				sources: [
					{ documentVersionId: v1.versions[0].id, sourceVersion: 1, checksum: s1.checksum },
				],
			});
			const v2 = await publish(await draft(v1));
			await enqueue(v2);
			expect(await retrieve()).toMatchObject({
				status: "INSUFFICIENT_CONTEXT",
				reason: "NO_MATCH",
			});
			await ready(v2);
			expect(await retrieve()).toMatchObject({
				status: "GROUNDED",
				sources: [{ documentVersionId: v2.versions[0].id, sourceVersion: 2 }],
			});
			await archive(v2);
			expect(await retrieve()).toMatchObject({ status: "INSUFFICIENT_CONTEXT", sources: [] });
		});

		it("drops the entire snapshot if one selected publication is withdrawn during tokenization", async () => {
			const first = await publish(await draft());
			await ready(first);
			const second = await publish(await draft());
			const queuedSecond = await enqueue(second);
			const set = await claim();
			expect(set.id).toBe(queuedSecond.id);
			const generated = output(set);
			generated.chunks[0].content += " nguồn thứ hai";
			generated.chunks[0].embedding_text += " nguồn thứ hai";
			expect(await repo.finish(set, withIntegrity(generated))).toBe(true);
			ragProvider.countPrefixes.mockImplementationOnce(async (blocks: string[]) => {
				expect(blocks).toHaveLength(2);
				await archive(first);
				return [20, 40];
			});
			expect(await retrieve()).toMatchObject({
				status: "INSUFFICIENT_CONTEXT",
				reason: "SOURCE_CHANGED",
				context: "",
				sources: [],
			});
		});

		it("rejects partial source items, invalid locations and stale chunk counts", async () => {
			const doc = await publish(await draft());
			const set = await ready(doc);
			await db.query(
				"UPDATE knowledge_chunks SET metadata=jsonb_set(metadata,'{locations,0,item_ref}',to_jsonb($2::text)) WHERE chunk_set_id=$1 AND chunk_index=1",
				[set.id, "#/texts/0"]
			);
			expect(await retrieve()).toMatchObject({
				status: "INSUFFICIENT_CONTEXT",
				reason: "INCOMPLETE_EVIDENCE",
			});
			await db.query(
				"UPDATE knowledge_chunks SET metadata=jsonb_set(metadata,'{locations}','[]'::jsonb) WHERE chunk_set_id=$1 AND chunk_index=0",
				[set.id]
			);
			expect(await retrieve()).toMatchObject({
				status: "INSUFFICIENT_CONTEXT",
				reason: "NO_MATCH",
			});
			await db.query("DELETE FROM knowledge_chunks WHERE chunk_set_id=$1 AND chunk_index=1", [
				set.id,
			]);
			expect(await retrieve()).toMatchObject({
				status: "INSUFFICIENT_CONTEXT",
				reason: "NO_MATCH",
			});
		});

		it("fails closed when the approved-host policy is removed", async () => {
			await ready(await publish(await draft(), false));
			const hosts = process.env.SURVIVAL_KNOWLEDGE_APPROVED_HOSTS;
			process.env.SURVIVAL_KNOWLEDGE_APPROVED_HOSTS = "";
			try {
				expect(await retrieve()).toMatchObject({ status: "INSUFFICIENT_CONTEXT", sources: [] });
			} finally {
				if (hosts === undefined)
					Reflect.deleteProperty(process.env, "SURVIVAL_KNOWLEDGE_APPROVED_HOSTS");
				else process.env.SURVIVAL_KNOWLEDGE_APPROVED_HOSTS = hosts;
			}
		});

		it("ranks deterministically and excludes malformed embeddings and incompatible sets", async () => {
			const first = await ready(await publish(await draft()));
			const second = await ready(await publish(await draft()));
			const winner = [first.id, second.id].sort()[0];
			expect(await retrieve()).toMatchObject({
				status: "GROUNDED",
				sources: [{ chunkSetId: winner }],
			});
			const loser = first.id === winner ? second.id : first.id;
			await db.query(
				`UPDATE knowledge_embeddings e SET embedding=ARRAY['NaN'::float8] || e.embedding[2:384]
				 FROM knowledge_chunks c WHERE c.embedding_id=e.id AND c.chunk_set_id=$1 AND c.chunk_index=0`,
				[winner]
			);
			expect(await retrieve()).toMatchObject({
				status: "GROUNDED",
				sources: [{ chunkSetId: loser }],
			});
			await db.query(
				"UPDATE knowledge_chunk_sets SET configuration=jsonb_set(configuration,'{embedding_revision}',to_jsonb('other'::text)) WHERE id=$1",
				[loser]
			);
			expect(await retrieve()).toMatchObject({ status: "INSUFFICIENT_CONTEXT", sources: [] });
		});

		const benchmark = process.env.RUN_RAG_BENCHMARK === "true" ? it : it.skip;
		benchmark(
			"reports synthetic latency and Node heap change for 2,000 vectors",
			async () => {
				const doc = await publish(await draft());
				await enqueue(doc);
				const set = await claim();
				const generated = output(set);
				const sample = generated.chunks[0];
				generated.chunks = Array.from({ length: 2000 }, (_, index) => ({
					...sample,
					chunk_index: index,
					locations: sample.locations.map((location) => ({
						...location,
						item_ref: `#/texts/${index}`,
					})),
					content: `${sample.content} ${index}`,
					embedding_text: `${sample.embedding_text} ${index}`,
				}));
				expect(await repo.finish(set, withIntegrity(generated))).toBe(true);
				ragProvider.countPrefixes.mockResolvedValue([20, 40, 60, 80, 100]);
				const before = process.memoryUsage().heapUsed;
				const durations: number[] = [];
				for (let attempt = 0; attempt < 10; attempt++) {
					const result = await retrieve();
					expect(result).toMatchObject({
						status: "GROUNDED",
						metrics: { candidateCount: 2000, selectedCount: 5 },
					});
					durations.push(result.metrics.durationMs);
				}
				durations.sort((a, b) => a - b);
				process.stdout.write(
					`${JSON.stringify({
						fixtureChunks: 2000,
						samples: durations.length,
						p50Ms: durations[4],
						p95Ms: durations[9],
						heapDeltaBytes: process.memoryUsage().heapUsed - before,
					})}\n`
				);
			},
			30000
		);

		it("treats a corpus limit as operational failure before embedding", async () => {
			await ready(await publish(await draft()));
			const settings = ragConfig.settings();
			jest.spyOn(ragConfig, "settings").mockReturnValue({ ...settings, maxCandidates: 1 });
			await expect(retrieve()).rejects.toMatchObject({ response: { code: "RAG_CORPUS_LIMIT" } });
			expect(ragProvider.embed).not.toHaveBeenCalled();
		});

		it("exposes no public RAG or chat route", async () => {
			for (const path of ["/api/rag/retrieve", "/api/ai/chat"]) {
				await request(app.getHttpServer())
					.post(path)
					.set("Authorization", camperAuth)
					.send(question)
					.expect(404);
			}
		});
	});
});
