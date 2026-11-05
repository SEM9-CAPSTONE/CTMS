import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { DocumentStatus } from "../src/modules/survival-documents/survival-documents.types";
import {
	createSurvivalE2eApp,
	sourceTestEmail,
	sourceTestPassword,
} from "./support/survival-e2e-app";
import {
	type SourceTestDetail,
	fictionalMetadata,
	fictionalRights,
	uniqueFictionalPdf,
} from "./support/survival-source-fixture";

describe("CTMS-050 HTTP E2E with real login", () => {
	let app: INestApplication;
	let root: string;
	let bearer: string;
	const endpoint = "/api/admin/survival-documents";
	beforeAll(async () => {
		const setup = await createSurvivalE2eApp();
		app = setup.app;
		root = setup.storageRoot;
		const login = await request(app.getHttpServer())
			.post("/api/auth/login")
			.send({ identifier: sourceTestEmail("admin"), password: sourceTestPassword })
			.expect(200);
		bearer = `Bearer ${login.body.accessToken}`;
	}, 90000);
	afterAll(async () => {
		await app?.close();
		if (root) await rm(root, { recursive: true, force: true });
	});
	it("uploads, publishes, downloads and stops using an exact source version", async () => {
		const pdf = uniqueFictionalPdf();
		const metadata = { ...fictionalMetadata, sourceTitle: "HTTP E2E fictional source" };
		const filename = `fictional-${randomUUID()}.pdf`;
		const upload = (filename: string, bytes = pdf) =>
			request(app.getHttpServer())
				.post(endpoint)
				.set("Authorization", bearer)
				.field("metadata", JSON.stringify(metadata))
				.attach("file", bytes, filename);
		let doc = (await upload(filename).expect(201)).body as SourceTestDetail;
		const id = doc.versions[0].id;
		expect(doc.versions[0].status).toBe(DocumentStatus.DRAFT);
		doc = (
			await request(app.getHttpServer())
				.post(`${endpoint}/${doc.id}/versions/${id}/publish`)
				.set("Authorization", bearer)
				.send({ expectedRevision: doc.versions[0].revision, rights: fictionalRights })
				.expect(201)
		).body as SourceTestDetail;
		expect(doc.currentPublishedVersionId).toBe(id);
		expect(doc.versions[0].rights.offlineRedistributionAllowed).toBe(false);
		await request(app.getHttpServer()).get(`${endpoint}/${doc.id}/versions/${id}/file`).expect(401);
		const bytes = await request(app.getHttpServer())
			.get(`${endpoint}/${doc.id}/versions/${id}/file`)
			.set("Authorization", bearer)
			.expect(200);
		expect(bytes.body).toEqual(pdf);
		doc = (
			await request(app.getHttpServer())
				.post(`${endpoint}/${doc.id}/versions/${id}/archive`)
				.set("Authorization", bearer)
				.send({ expectedRevision: doc.versions[0].revision, reason: "Test source withdrawn" })
				.expect(201)
		).body as SourceTestDetail;
		expect(doc.currentPublishedVersionId).toBeNull();
		expect(doc.versions[0].status).toBe(DocumentStatus.ARCHIVED);
		const duplicate = await upload(`renamed-${randomUUID()}.pdf`).expect(409);
		expect(duplicate.body).toMatchObject({
			code: "SOURCE_DUPLICATE_PDF",
			documentId: doc.id,
			versionId: id,
			versionNumber: 1,
			sourceTitle: metadata.sourceTitle,
		});
		const duplicateBoth = await upload(filename).expect(409);
		expect(duplicateBoth.body).toMatchObject({
			code: "SOURCE_DUPLICATE_PDF_NAME_AND_CONTENT",
			versionId: id,
		});
		const duplicateName = await upload(filename, uniqueFictionalPdf()).expect(409);
		expect(duplicateName.body).toMatchObject({
			code: "SOURCE_DUPLICATE_PDF_NAME",
			versionId: id,
		});
	});
	it.each(["camper", "host", "porter"])("rejects a real authenticated %s session", async (role) => {
		const login = await request(app.getHttpServer())
			.post("/api/auth/login")
			.send({ identifier: sourceTestEmail(role), password: sourceTestPassword })
			.expect(200);
		await request(app.getHttpServer())
			.get(endpoint)
			.set("Authorization", `Bearer ${login.body.accessToken}`)
			.expect(403);
	});
});
