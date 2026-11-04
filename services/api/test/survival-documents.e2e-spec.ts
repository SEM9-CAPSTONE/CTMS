import { rm } from "node:fs/promises";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import {
	createSurvivalE2eApp,
	sourceTestEmail,
	sourceTestPassword,
} from "./support/survival-e2e-app";
import {
	type SourceTestDetail,
	fictionalMetadata,
	fictionalPdf,
	fictionalRights,
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
	it("uploads, reviews, publishes, downloads and stops using an exact source version", async () => {
		let doc = (
			await request(app.getHttpServer())
				.post(endpoint)
				.set("Authorization", bearer)
				.field(
					"metadata",
					JSON.stringify({ ...fictionalMetadata, sourceTitle: "HTTP E2E fictional source" })
				)
				.attach("file", fictionalPdf, "fictional.pdf")
				.expect(201)
		).body as SourceTestDetail;
		const id = doc.versions[0].id;
		for (const [action, extra] of [
			["submit", {}],
			["review", { decision: "approve", rights: fictionalRights }],
			["publish", {}],
		] as const) {
			doc = (
				await request(app.getHttpServer())
					.post(`${endpoint}/${doc.id}/versions/${id}/${action}`)
					.set("Authorization", bearer)
					.send({ expectedRevision: doc.versions[0].revision, ...extra })
					.expect(201)
			).body as SourceTestDetail;
		}
		expect(doc.currentPublishedVersionId).toBe(id);
		expect(doc.versions[0].rights.offlineRedistributionAllowed).toBe(false);
		await request(app.getHttpServer()).get(`${endpoint}/${doc.id}/versions/${id}/file`).expect(401);
		const bytes = await request(app.getHttpServer())
			.get(`${endpoint}/${doc.id}/versions/${id}/file`)
			.set("Authorization", bearer)
			.expect(200);
		expect(bytes.body).toEqual(fictionalPdf);
		doc = (
			await request(app.getHttpServer())
				.post(`${endpoint}/${doc.id}/versions/${id}/archive`)
				.set("Authorization", bearer)
				.send({ expectedRevision: doc.versions[0].revision, reason: "Test source withdrawn" })
				.expect(201)
		).body as SourceTestDetail;
		expect(doc.currentPublishedVersionId).toBeNull();
		expect(doc.versions[0].status).toBe("ARCHIVED");
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
