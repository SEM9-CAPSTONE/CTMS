import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { KnowledgeChunksProvider } from "../src/modules/knowledge-chunks/knowledge-chunks.provider";
import { KnowledgeChunksRepository } from "../src/modules/knowledge-chunks/knowledge-chunks.repository";
import {
	type ChunkConfiguration,
	type ChunkOutput,
	type ChunkSet,
	ChunkSetStatus,
} from "../src/modules/knowledge-chunks/knowledge-chunks.types";
import { KnowledgeChunksWorker } from "../src/modules/knowledge-chunks/knowledge-chunks.worker";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";
import {
	type SourceTestDetail,
	fictionalMetadata,
	fictionalRights,
	uniqueFictionalPdf,
} from "./support/survival-source-fixture";

describe("CTMS-051 durable ingestion and provenance", () => {
	let app: INestApplication;
	let db: DataSource;
	let repo: KnowledgeChunksRepository;
	let configuration: ChunkConfiguration;
	let provider: KnowledgeChunksProvider;
	let worker: KnowledgeChunksWorker;
	let root: string;
	let auth: string;
	let camperAuth: string;
	const admin = randomUUID();
	const camper = randomUUID();
	const endpoint = "/api/admin/survival-documents";
	const chunkEndpoint = (doc: SourceTestDetail) =>
		`${endpoint}/${doc.id}/versions/${doc.versions[0].id}/chunk-sets`;
	beforeAll(async () => {
		root = await mkdtemp(join(tmpdir(), "ctms51-"));
		process.env.SURVIVAL_DOCUMENT_STORAGE_ROOT = root;
		const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
		// Only this feature's queue is used by these serial integration tests.
		await db.query(
			"TRUNCATE knowledge_chunk_event_receipts,knowledge_chunk_publications,knowledge_chunks,knowledge_chunk_sets"
		);
	});
	afterAll(async () => {
		await app?.close();
		if (root) await rm(root, { recursive: true, force: true });
		Reflect.deleteProperty(process.env, "SURVIVAL_DOCUMENT_STORAGE_ROOT");
	});
	async function draft(previous?: SourceTestDetail): Promise<SourceTestDetail> {
		const upload = request(app.getHttpServer())
			.post(previous ? `${endpoint}/${previous.id}/versions` : endpoint)
			.set("Authorization", auth)
			.field("metadata", JSON.stringify(fictionalMetadata));
		if (previous) upload.field("expectedDocumentRevision", String(previous.revision));
		return (await upload.attach("file", uniqueFictionalPdf(), `${randomUUID()}.pdf`).expect(201))
			.body as SourceTestDetail;
	}
	async function publish(doc: SourceTestDetail, rights = true): Promise<SourceTestDetail> {
		return (
			await request(app.getHttpServer())
				.post(`${endpoint}/${doc.id}/versions/${doc.versions[0].id}/publish`)
				.set("Authorization", auth)
				.send({
					expectedRevision: doc.versions[0].revision,
					...(rights ? { rights: fictionalRights } : {}),
				})
				.expect(201)
		).body as SourceTestDetail;
	}
	async function enqueue(doc: SourceTestDetail): Promise<ChunkSet> {
		return repo.enqueue(doc.id, doc.versions[0].id, configuration);
	}
	function output(set: ChunkSet): ChunkOutput {
		return {
			document_version_id: set.document_version_id,
			source_version: set.source_version,
			checksum: set.checksum,
			locale: set.locale,
			configuration: set.configuration,
			quality: { status: "PASSED", issues: [], page_count: 1 },
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
		};
	}
	async function claim(): Promise<ChunkSet> {
		const set = await repo.claim();
		if (!set) throw new Error("Expected queued ingestion");
		return set;
	}
	async function storedStatus(id: string) {
		return (await db.query("SELECT status FROM knowledge_chunk_sets WHERE id=$1", [id]))[0]
			.status as ChunkSetStatus;
	}

	it("allows only active Admin and eligible exact-version publications", async () => {
		const doc = await draft();
		await request(app.getHttpServer()).post(chunkEndpoint(doc)).expect(401);
		await request(app.getHttpServer())
			.post(chunkEndpoint(doc))
			.set("Authorization", camperAuth)
			.expect(403);
		await request(app.getHttpServer())
			.post(chunkEndpoint(doc))
			.set("Authorization", auth)
			.expect(409);
		const unverified = await publish(doc, false);
		await request(app.getHttpServer())
			.post(chunkEndpoint(unverified))
			.set("Authorization", auth)
			.expect(409);
		const valid = await publish(await draft());
		await request(app.getHttpServer())
			.post(chunkEndpoint(valid))
			.set("Authorization", auth)
			.expect(202);
		await request(app.getHttpServer())
			.get(chunkEndpoint(valid))
			.set("Authorization", auth)
			.expect(200);
		await request(app.getHttpServer())
			.get(`${endpoint}/${valid.id}/versions/${randomUUID()}/chunk-sets`)
			.set("Authorization", auth)
			.expect(404);
	});
	it("enqueues idempotently under concurrent requests and claims at most once", async () => {
		const doc = await publish(await draft());
		const sets = await Promise.all([enqueue(doc), enqueue(doc), enqueue(doc)]);
		expect(new Set(sets.map((set) => set.id)).size).toBe(1);
		const claims = await Promise.all([repo.claim(), repo.claim(), repo.claim()]);
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
		expect((await enqueue(doc)).status).toBe(ChunkSetStatus.PENDING);
	});
	it("fences expired workers after a lease is reclaimed", async () => {
		const doc = await publish(await draft());
		await enqueue(doc);
		const old = await claim();
		await db.query(
			"UPDATE knowledge_chunk_sets SET lease_until=now()-interval '1 second' WHERE id=$1",
			[old.id]
		);
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
		).toEqual([{ chunk_set_id: first.id }]);
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
			expect(await repo.readCurrent(doc.id)).toEqual([]);
		} finally {
			await db.query("ALTER TABLE knowledge_chunks DROP CONSTRAINT ctms51_test_failure");
		}
		await repo.finish(set, output(set));
		expect(await storedStatus(set.id)).toBe(ChunkSetStatus.READY);
	});
	it("runs the worker through the real private-file reader and completes its exact claim", async () => {
		const doc = await publish(await draft());
		await enqueue(doc);
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
		const eligible = await publish(await draft());
		const unverified = await publish(await draft(), false);
		// Exclude prior tests' events so this test is isolated from their retained source history.
		await db.query(
			"INSERT INTO knowledge_chunk_event_receipts(event_id) SELECT id FROM survival_document_outbox WHERE document_id<>ALL($1::uuid[]) ON CONFLICT DO NOTHING",
			[[eligible.id, unverified.id]]
		);
		await Promise.all([repo.consumeEvents(configuration), repo.consumeEvents(configuration)]);
		await repo.consumeEvents(configuration);
		expect(
			await db.query("SELECT document_id FROM knowledge_chunk_sets ORDER BY document_id")
		).toEqual([{ document_id: eligible.id }]);
		expect(
			await db.query("SELECT id FROM survival_document_outbox WHERE document_id=$1", [eligible.id])
		).toHaveLength(1);
	});
});
