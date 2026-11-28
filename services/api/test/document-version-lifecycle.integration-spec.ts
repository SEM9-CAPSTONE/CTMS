import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource, type QueryRunner } from "typeorm";
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from "undici";
import { PrepareDraftKnowledge1799000000000 } from "../src/migrations/1799000000000-PrepareDraftKnowledge";
import { AppModule } from "../src/modules/app.module";
import { KnowledgeChunksProvider } from "../src/modules/knowledge-chunks/knowledge-chunks.provider";
import { KnowledgeChunksRepository } from "../src/modules/knowledge-chunks/knowledge-chunks.repository";
import {
	type ChunkSet,
	IngestionError,
	chunkConfiguration,
} from "../src/modules/knowledge-chunks/knowledge-chunks.types";
import { KnowledgeChunksWorker } from "../src/modules/knowledge-chunks/knowledge-chunks.worker";
import { RagRepository } from "../src/modules/rag/rag.repository";
import { SurvivalDocumentsService } from "../src/modules/survival-documents/survival-documents.service";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";
import { withIntegrity } from "./support/knowledge-integrity-fixture";
import {
	type SourceTestDetail,
	fictionalMetadata,
	uniqueFictionalPdf,
} from "./support/survival-source-fixture";

describe("Document version preparation, atomic publication and retained embeddings", () => {
	let app: INestApplication;
	let db: DataSource;
	let repo: KnowledgeChunksRepository;
	let documents: SurvivalDocumentsService;
	let worker: KnowledgeChunksWorker;
	let provider: KnowledgeChunksProvider;
	let rag: RagRepository;
	let root: string;
	let auth: string;
	const labels = new Map<string, string[]>();
	const generated: string[][] = [];
	const bytes = new Map<string, Buffer>();
	const origin = getGlobalDispatcher();
	const agent = new MockAgent();
	const configuration = chunkConfiguration();
	const endpoint = "/api/admin/survival-documents";
	const text = (label: string) => `Hướng dẫn ${label}: kiểm tra điều kiện trước khi xuất phát.`;
	const vector = (input: string) =>
		Array.from({ length: 384 }, (_, i) =>
			Number(i === createHash("sha256").update(input).digest()[0])
		);
	beforeAll(async () => {
		root = await mkdtemp(join(tmpdir(), "ctms-version-lifecycle-"));
		process.env.SURVIVAL_DOCUMENT_STORAGE_ROOT = root;
		process.env.KNOWLEDGE_SERVICE_TOKEN = "lifecycle-integration-token";
		process.env.KNOWLEDGE_SERVICE_URL = "http://localhost:8001";
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
		worker = module.get(KnowledgeChunksWorker);
		provider = module.get(KnowledgeChunksProvider);
		rag = module.get(RagRepository);
		documents = module.get(SurvivalDocumentsService);
		const [admin]: Array<{ id: string }> = await db.query(
			`INSERT INTO users(id,email,password_hash,role,status,full_name)
		 VALUES($1,'admin@ctms.local','unused','admin','active','Nguyễn Minh Anh') ON CONFLICT(email) DO UPDATE SET email=excluded.email RETURNING id`,
			[randomUUID()]
		);
		await db.query(
			"INSERT INTO user_roles(user_id,role) VALUES($1,'admin') ON CONFLICT DO NOTHING",
			[admin.id]
		);
		auth = `Bearer ${module.get(JwtService).sign({ sub: admin.id, roles: ["admin"] })}`;
		agent.disableNetConnect();
		setGlobalDispatcher(agent);
		const pool = agent.get("http://localhost:8001");
		pool
			.intercept({ path: "/knowledge-chunks/prepare", method: "POST" })
			.reply((options) => {
				const input = JSON.parse(String(options.body));
				const result = withIntegrity({
					document_version_id: input.document_version_id,
					source_version: input.source_version,
					checksum: input.checksum,
					locale: input.locale,
					configuration: input.configuration,
					quality: { status: "PASSED" as const, issues: [], page_count: 1 },
					chunks: (labels.get(input.document_version_id) ?? ["A", "B", "C", "D"]).map(
						(label, index) => ({
							chunk_index: index,
							content: text(label),
							embedding_text: `passage: ${input.title}\n${text(label)}`,
							headings: [],
							token_count: 40,
							locations: [
								{
									page: 1,
									item_ref: `#/texts/${index}`,
									bbox: {
										l: 0,
										t: index * 20 + 10,
										r: 100,
										b: index * 20,
										coord_origin: "BOTTOMLEFT" as const,
									},
								},
							],
						})
					),
				});
				return { statusCode: 200, data: JSON.stringify(result) };
			})
			.persist();
		pool
			.intercept({ path: "/passage-embeddings", method: "POST" })
			.reply((options) => {
				const input = JSON.parse(String(options.body)) as { passages: string[] };
				generated.push(input.passages);
				return {
					statusCode: 200,
					data: JSON.stringify({ embeddings: input.passages.map(vector) }),
				};
			})
			.persist();
	}, 90000);
	beforeEach(async () => {
		jest.restoreAllMocks();
		labels.clear();
		generated.length = 0;
		bytes.clear();
		await db.query("TRUNCATE survival_document_outbox,survival_documents CASCADE");
	});
	afterAll(async () => {
		setGlobalDispatcher(origin);
		await agent.close();
		await app?.close();
		if (root) await rm(root, { recursive: true, force: true });
		Reflect.deleteProperty(process.env, "SURVIVAL_DOCUMENT_STORAGE_ROOT");
		Reflect.deleteProperty(process.env, "KNOWLEDGE_SERVICE_TOKEN");
		Reflect.deleteProperty(process.env, "KNOWLEDGE_SERVICE_URL");
	});
	async function draft(previous?: SourceTestDetail, content = ["A", "B", "C", "D"]) {
		const source = uniqueFictionalPdf();
		const upload = request(app.getHttpServer())
			.post(previous ? `${endpoint}/${previous.id}/versions` : endpoint)
			.set("Authorization", auth)
			.field("metadata", JSON.stringify(fictionalMetadata));
		if (previous) upload.field("expectedDocumentRevision", String(previous.revision));
		const document = (
			await upload.attach("file", source, `huong-dan-${randomUUID()}.pdf`).expect(201)
		).body as SourceTestDetail;
		labels.set(document.versions[0].id, content);
		bytes.set(document.versions[0].id, source);
		return document;
	}
	async function prepare(document: SourceTestDetail): Promise<SourceTestDetail> {
		await repo.consumeEvents(configuration);
		expect(await worker.processOne()).toBe(true);
		return (await documents.detail(document.id)) as unknown as SourceTestDetail;
	}
	function publication(document: SourceTestDetail) {
		return request(app.getHttpServer())
			.post(`${endpoint}/${document.id}/versions/${document.versions[0].id}/publish`)
			.set("Authorization", auth)
			.send({
				expectedRevision: document.versions[0].revision,
				expectedDocumentRevision: document.revision,
				confirmSource: true,
			});
	}
	async function publish(document: SourceTestDetail) {
		return (await publication(document).expect(201)).body as SourceTestDetail;
	}
	async function chunks(documentId: string, versionId: string) {
		return db.query(
			`SELECT c.id,c.embedding_id,c.embedding_text,c.chunk_index,c.metadata FROM knowledge_chunks c
		 JOIN knowledge_chunk_sets s ON s.id=c.chunk_set_id WHERE s.document_id=$1 AND c.document_version_id=$2 ORDER BY c.chunk_index`,
			[documentId, versionId]
		);
	}
	async function restore(document: SourceTestDetail, historicalId: string) {
		const historical = document.versions.find((item) => item.id === historicalId);
		if (!historical) throw new Error("Missing historical version");
		return (
			await request(app.getHttpServer())
				.post(`${endpoint}/${document.id}/versions/${historicalId}/restore`)
				.set("Authorization", auth)
				.send({
					expectedRevision: historical.revision,
					expectedDocumentRevision: document.revision,
					reason: "Khôi phục hướng dẫn phù hợp với điều kiện tổ chức hiện tại.",
				})
				.expect(201)
		).body as SourceTestDetail;
	}

	it("T01/T03/T07/T25/T26: prepares once, isolates draft knowledge and explicitly activates the first publication", async () => {
		const document = await draft();
		await publication(document).expect(409);
		const ready = await prepare(document);
		expect(ready.versions[0].status).toBe("DRAFT");
		expect(await repo.readCurrent(document.id)).toEqual([]);
		expect(await rag.hasEligibleDocument(document.id, document.versions[0].id)).toBe(false);
		await repo.consumeEvents(configuration);
		expect(await worker.processOne()).toBe(false);
		expect(
			(await db.query("SELECT count(*)::int AS count FROM knowledge_chunk_sets"))[0].count
		).toBe(1);
		const active = await publish(ready);
		expect(await repo.readCurrent(document.id)).toHaveLength(4);
		expect(await rag.hasEligibleDocument(document.id, active.versions[0].id)).toBe(true);
	});
	it("T02/T04: V1 remains eligible during running V2 and a failed replacement", async () => {
		const active = await publish(await prepare(await draft()));
		const replacement = await draft(active, ["A", "B", "E", "D"]);
		await repo.consumeEvents(configuration);
		let release!: () => void;
		let entered!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const started = new Promise<void>((resolve) => {
			entered = resolve;
		});
		jest.spyOn(provider, "generate").mockImplementationOnce(async () => {
			entered();
			await gate;
			throw new IngestionError("ingestion_transport", false);
		});
		const running = worker.processOne();
		await started;
		try {
			expect(await rag.hasEligibleDocument(active.id, active.versions[0].id)).toBe(true);
			expect(await rag.hasEligibleDocument(active.id, replacement.versions[0].id)).toBe(false);
		} finally {
			release();
		}
		await running;
		expect(await rag.hasEligibleDocument(active.id, active.versions[0].id)).toBe(true);
		expect((await documents.detail(active.id)).currentPublishedVersionId).toBe(
			active.versions[0].id
		);
	});
	it("T05/T06/T10: rolls publication back on activation failure and serializes competing valid publications", async () => {
		const active = await publish(await prepare(await draft()));
		const ready = await prepare(await draft(active, ["A", "B", "E", "D"]));
		const activation = jest
			.spyOn(repo, "activatePrepared")
			.mockRejectedValueOnce(new Error("Injected transaction failure"));
		await publication(ready).expect(500);
		activation.mockRestore();
		expect((await documents.detail(active.id)).currentPublishedVersionId).toBe(
			active.versions[0].id
		);
		expect(await rag.hasEligibleDocument(active.id, active.versions[0].id)).toBe(true);
		expect(
			(
				await db.query(
					"SELECT count(*)::int AS count FROM survival_document_outbox WHERE version_id=$1 AND event_type='published_version_changed'",
					[ready.versions[0].id]
				)
			)[0].count
		).toBe(0);
		const results = await Promise.all([publication(ready), publication(ready)]);
		expect(results.map((item) => item.status).sort()).toEqual([201, 409]);
		expect(await rag.hasEligibleDocument(active.id, ready.versions[0].id)).toBe(true);
		expect(await rag.hasEligibleDocument(active.id, active.versions[0].id)).toBe(false);
	});
	it("T08/T09: changing a prepared draft or a running draft fences the old result", async () => {
		let document = await prepare(await draft());
		const oldVersion = document.versions[0];
		await request(app.getHttpServer())
			.patch(`${endpoint}/${document.id}/versions/${oldVersion.id}/metadata`)
			.set("Authorization", auth)
			.send({
				expectedRevision: oldVersion.revision,
				metadata: { ...oldVersion.metadata, sourceTitle: "Hướng dẫn chuẩn bị cho hành trình" },
			})
			.expect(200);
		document = (await documents.detail(document.id)) as unknown as SourceTestDetail;
		await publication(document).expect(409);
		await repo.consumeEvents(configuration);
		const running = await repo.claim(configuration);
		expect(running).not.toBeNull();
		const version = document.versions[0];
		await request(app.getHttpServer())
			.patch(`${endpoint}/${document.id}/versions/${version.id}/metadata`)
			.set("Authorization", auth)
			.send({
				expectedRevision: version.revision,
				metadata: { ...version.metadata, sourceTitle: "Hướng dẫn hành trình đã cập nhật" },
			})
			.expect(200);
		expect(
			await repo.finish(running as ChunkSet, { error: "ingestion_cancelled", retryable: true })
		).toBe(false);
		expect(await repo.readCurrent(document.id)).toEqual([]);
	});
	it("T12/T13/T14/T23: ABCD → ABED → ABCD reuses historical C through independent chunk records", async () => {
		const first = await publish(await prepare(await draft()));
		const original = await chunks(first.id, first.versions[0].id);
		expect(generated.flat()).toHaveLength(4);
		generated.length = 0;
		const second = await publish(await prepare(await draft(first, ["A", "B", "E", "D"])));
		expect(generated.flat()).toEqual([`passage: ${fictionalMetadata.sourceTitle}\n${text("E")}`]);
		const changed = await chunks(second.id, second.versions[0].id);
		expect(changed[0].embedding_id).toBe(original[0].embedding_id);
		expect(changed[0].id).not.toBe(original[0].id);
		generated.length = 0;
		const restored = await restore(second, first.versions[0].id);
		expect(restored.versions[0].status).toBe("DRAFT");
		expect(restored.versions[0].versionNumber).toBe(3);
		expect(restored.versions[0].checksum).toBe(first.versions[0].checksum);
		expect(restored.versions[0].rights.medicalContentReviewStatus).toBe("NOT_REVIEWED");
		const ready = await prepare(restored);
		expect(generated).toEqual([]);
		const recovered = await chunks(ready.id, ready.versions[0].id);
		expect(recovered[2].embedding_id).toBe(original[2].embedding_id);
		expect(
			recovered.every((item: { id: string }) =>
				original.every((old: { id: string }) => item.id !== old.id)
			)
		).toBe(true);
		expect(ready.currentPublishedVersionId).toBe(second.versions[0].id);
		await expect(
			db.transaction(async (manager) =>
				new PrepareDraftKnowledge1799000000000().down(manager as unknown as QueryRunner)
			)
		).rejects.toThrow();
		expect(await chunks(ready.id, ready.versions[0].id)).toEqual(recovered);
		await publish(ready);
	});
	it("T15: absent historical vectors are encoded again without losing restored source history", async () => {
		const first = await publish(await prepare(await draft()));
		const second = await publish(await prepare(await draft(first, ["A", "B", "E", "D"])));
		await db.query("DELETE FROM knowledge_chunk_sets WHERE document_version_id=$1", [
			first.versions[0].id,
		]);
		await db.query(
			"DELETE FROM knowledge_embeddings e WHERE NOT EXISTS(SELECT 1 FROM knowledge_chunks c WHERE c.embedding_id=e.id)"
		);
		generated.length = 0;
		await prepare(await restore(second, first.versions[0].id));
		expect(generated.flat()).toEqual([`passage: ${fictionalMetadata.sourceTitle}\n${text("C")}`]);
	});
	it("T16/T17: configuration and changed complete chunk inputs cannot reuse incompatible vectors", async () => {
		const first = await publish(await prepare(await draft()));
		const [stored]: ChunkSet[] = await db.query(
			"SELECT * FROM knowledge_chunk_sets WHERE document_version_id=$1",
			[first.versions[0].id]
		);
		const old = await chunks(first.id, first.versions[0].id);
		const changed = {
			...stored,
			configuration: { ...stored.configuration, pipeline_version: "future-parser-identity" },
		};
		expect(
			await repo.reusableEmbeddings(
				changed,
				old.map((item: { embedding_text: string }) => item.embedding_text)
			)
		).toEqual(new Map());
		generated.length = 0;
		await prepare(await draft(first, ["AB", "C", "D"]));
		expect(generated.flat()).toEqual([`passage: ${fictionalMetadata.sourceTitle}\n${text("AB")}`]);
	});
	it("T18/T19/T20: withdrawal excludes active and historical knowledge despite delayed deliveries", async () => {
		const first = await publish(await prepare(await draft()));
		const second = await publish(await prepare(await draft(first, ["A", "B", "E", "D"])));
		await request(app.getHttpServer())
			.post(`${endpoint}/${second.id}/versions/${second.versions[0].id}/archive`)
			.set("Authorization", auth)
			.send({
				expectedRevision: second.versions[0].revision,
				reason: "Cần rà soát lại hướng dẫn trước khi tiếp tục sử dụng.",
			})
			.expect(201);
		await db.query("DELETE FROM knowledge_chunk_event_receipts");
		await repo.consumeEvents(configuration);
		expect(await worker.processOne()).toBe(false);
		expect(await repo.readCurrent(first.id)).toEqual([]);
		expect(await rag.hasEligibleDocument(first.id, first.versions[0].id)).toBe(false);
		expect(await rag.hasEligibleDocument(first.id, second.versions[0].id)).toBe(false);
	});
	it("T22: migration preserves publication, chunk identities and shared embedding references", async () => {
		const active = await publish(await prepare(await draft()));
		const before = await chunks(active.id, active.versions[0].id);
		const migration = new PrepareDraftKnowledge1799000000000();
		await db.transaction(async (manager) => {
			await migration.down(manager as unknown as QueryRunner);
			await migration.up(manager as unknown as QueryRunner);
		});
		expect(await chunks(active.id, active.versions[0].id)).toEqual(before);
		expect(await rag.hasEligibleDocument(active.id, active.versions[0].id)).toBe(true);
	});
	it("T24: duplicate bytes in an unrelated document and a no-op current restoration remain blocked", async () => {
		const first = await publish(await prepare(await draft()));
		await request(app.getHttpServer())
			.post(endpoint)
			.set("Authorization", auth)
			.field("metadata", JSON.stringify(fictionalMetadata))
			.attach("file", bytes.get(first.versions[0].id) as Buffer, "ban-sao.pdf")
			.expect(409);
		await request(app.getHttpServer())
			.post(`${endpoint}/${first.id}/versions/${first.versions[0].id}/restore`)
			.set("Authorization", auth)
			.send({
				expectedRevision: first.versions[0].revision,
				expectedDocumentRevision: first.revision,
				reason: "Khôi phục hướng dẫn được lựa chọn từ lịch sử.",
			})
			.expect(422);
	});
});
