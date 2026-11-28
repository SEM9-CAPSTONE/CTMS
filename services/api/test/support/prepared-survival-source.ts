import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { DataSource } from "typeorm";
import { KnowledgeChunksRepository } from "../../src/modules/knowledge-chunks/knowledge-chunks.repository";
import {
	type ChunkSet,
	chunkConfiguration,
} from "../../src/modules/knowledge-chunks/knowledge-chunks.types";
import { withIntegrity } from "./knowledge-integrity-fixture";
import type { SourceTestDetail } from "./survival-source-fixture";

export function survivalSourceFixtureOutput(set: ChunkSet, title: string) {
	return withIntegrity({
		document_version_id: set.document_version_id,
		source_version: set.source_version,
		checksum: set.checksum,
		locale: set.locale,
		configuration: set.configuration,
		quality: { status: "PASSED", issues: [], page_count: 2 },
		chunks: [
			{
				chunk_index: 0,
				content: "Kiểm tra điều kiện trước khi xuất phát.",
				embedding_text: `passage: ${title}\nKiểm tra điều kiện trước khi xuất phát.`,
				headings: [],
				token_count: 30,
				locations: [
					{
						page: 1,
						item_ref: "#/texts/0",
						bbox: { l: 0, t: 10, r: 100, b: 0, coord_origin: "BOTTOMLEFT" },
					},
				],
				embedding: Array.from({ length: 384 }, (_, i) => Number(i === 0)),
			},
		],
	});
}

/** Existing HTTP suites test document policy independently of the Python parser.
 * Supply validated extraction evidence through the real repository/lease boundary;
 * never mutate a production PDF or mark runtime extraction evidence as reviewed. */
export async function prepareSurvivalSourceFixture(
	app: INestApplication,
	db: DataSource,
	auth: string,
	document: SourceTestDetail,
	decision: Record<string, unknown> = {}
): Promise<SourceTestDetail> {
	const version = document.versions[0];
	const response = await request(app.getHttpServer())
		.post(`/api/admin/survival-documents/${document.id}/versions/${version.id}/prepare`)
		.set("Authorization", auth)
		.send({
			...decision,
			expectedRevision: version.revision,
			expectedDocumentRevision: document.revision,
		});
	// Non-RAG categories retain their publication policy. A restricted source
	// must not receive fixture knowledge merely to satisfy the publication gate.
	if (response.status === 422) return document;
	expect(response.status).toBe(201);
	const prepared = response.body as SourceTestDetail;
	const repo = app.get(KnowledgeChunksRepository);
	await repo.consumeEvents(chunkConfiguration());
	const [set]: ChunkSet[] = await db.query(
		`UPDATE knowledge_chunk_sets SET status='RUNNING',attempts=attempts+1,
	 lease_token=$2,lease_until=clock_timestamp()+interval '2 minutes' WHERE document_version_id=$1 AND status='PENDING' RETURNING *`,
		[version.id, randomUUID()]
	);
	if (set) {
		await repo.finish(
			set,
			withIntegrity({
				document_version_id: set.document_version_id,
				source_version: set.source_version,
				checksum: set.checksum,
				locale: set.locale,
				configuration: set.configuration,
				quality: { status: "PASSED", issues: [], page_count: 1 },
				chunks: [
					{
						chunk_index: 0,
						content: "Kiểm tra điều kiện trước khi xuất phát.",
						embedding_text: `passage: ${version.metadata.sourceTitle}\nKiểm tra điều kiện trước khi xuất phát.`,
						headings: [],
						token_count: 30,
						locations: [
							{
								page: 1,
								item_ref: "#/texts/0",
								bbox: { l: 0, t: 10, r: 100, b: 0, coord_origin: "BOTTOMLEFT" },
							},
						],
						embedding: Array.from({ length: 384 }, (_, i) => Number(i === 0)),
					},
				],
			})
		);
	}
	return prepared;
}
