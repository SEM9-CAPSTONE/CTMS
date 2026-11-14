import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fictionalPdf as pdf } from "../../../test/support/survival-source-fixture";
import { parseMetadata } from "./dto/source.dto";
import { PdfSourceService } from "./pdf-source.service";
import { SourceFilesService } from "./source-files.service";
import {
	assertApprovedSource,
	assertRights,
	validatePublicationMetadata,
	validateSourceMetadata,
} from "./source-policy";
import {
	Classification,
	MedicalStatus,
	RightsStatus,
	type SourceMetadata,
	UNREVIEWED_RIGHTS,
} from "./survival-documents.types";

const metadata: SourceMetadata = {
	sourceTitle: "Fictional test manual",
	publisher: "Fictional test publisher",
	sourceUrl: "https://example.org/manual",
	classification: Classification.TREKKING_SAFETY,
	locale: "vi",
	originalLocale: "vi",
	retrievedAt: "2026-01-01",
	licenseType: "Test permission",
	permissionEvidence: "Fictional owner permits test use",
	changeSummary: "First test edition",
	attribution: "Fictional author",
};
const permitted = {
	...UNREVIEWED_RIGHTS,
	rightsReviewStatus: RightsStatus.PERMITTED,
	sourceReviewConfirmed: true,
	internalRagUseAllowed: true,
	evidence: "Owner permission verified for exact test PDF",
};
const file = (changes: Partial<Express.Multer.File> = {}) =>
	({
		buffer: pdf,
		originalname: "fictional.pdf",
		mimetype: "application/pdf",
		...changes,
	}) as Express.Multer.File;

describe("CTMS-050 source policy and private storage", () => {
	it("matches only approved exact hostnames and permits an uploaded PDF by exact checksum", () => {
		const checksum = createHash("sha256").update(pdf).digest("hex");
		const source = (sourceUrl?: string, hash = checksum) => ({
			metadata: { ...metadata, sourceUrl },
			checksum: hash,
		});
		expect(() => assertApprovedSource(source("https://example.org/manual.pdf"))).not.toThrow();
		expect(() => assertApprovedSource(source("http://example.org/manual.pdf"))).toThrow();
		for (const host of ["sub.example.org", "example.org.other.com", "unlisted.example.com"])
			expect(() => assertApprovedSource(source(`https://${host}/manual.pdf`))).toThrow();
		expect(() => assertApprovedSource(source())).toThrow();
		const previous = process.env.SURVIVAL_KNOWLEDGE_APPROVED_SHA256;
		try {
			process.env.SURVIVAL_KNOWLEDGE_APPROVED_SHA256 = checksum.toUpperCase();
			expect(() => assertApprovedSource(source())).not.toThrow();
			expect(() => assertApprovedSource(source(undefined, "0".repeat(64)))).toThrow();
		} finally {
			process.env.SURVIVAL_KNOWLEDGE_APPROVED_SHA256 = previous ?? "";
		}
	});
	it("accepts today's Vietnam calendar date before UTC midnight, but rejects tomorrow", () => {
		jest.useFakeTimers().setSystemTime(new Date("2026-11-03T18:00:00Z"));
		try {
			expect(() =>
				validateSourceMetadata({
					...metadata,
					retrievedAt: "2026-11-04",
					sourcePublishedAt: "2026-11-04",
				})
			).not.toThrow();
			expect(() => validateSourceMetadata({ ...metadata, retrievedAt: "2026-11-05" })).toThrow();
			expect(() =>
				parseMetadata(JSON.stringify({ ...metadata, retrievedAt: "2026-02-31" }))
			).toThrow();
		} finally {
			jest.useRealTimers();
		}
	});
	it("validates exact-work metadata but never clears rights based on official publisher", () => {
		expect(parseMetadata(JSON.stringify(metadata))).toEqual(metadata);
		expect(() => validateSourceMetadata(metadata)).not.toThrow();
		expect(() =>
			assertRights({ ...metadata, publisher: "World Health Organization" }, UNREVIEWED_RIGHTS)
		).toThrow();
	});
	it.each([
		"http://example.org/doc",
		"https://user:secret@example.org/doc",
		"https://localhost/doc",
		"https://127.0.0.1/doc",
		"https://[::1]/doc",
		"file:///tmp/file",
		"https://example.org:8080/file",
	])("rejects unsafe URL %s", (sourceUrl) =>
		expect(() => validateSourceMetadata({ ...metadata, sourceUrl })).toThrow()
	);
	it.each([{ sourceTitle: "" }, { locale: "../../vi" }, { isApproved: true }])(
		"rejects invalid or injected metadata %j",
		(changes) => expect(() => parseMetadata(JSON.stringify({ ...metadata, ...changes }))).toThrow()
	);
	it("accepts minimal draft metadata and requires license, permission evidence and attribution at publication", () => {
		const draft = {
			sourceTitle: metadata.sourceTitle,
			classification: metadata.classification,
			locale: metadata.locale,
		};
		expect(parseMetadata(JSON.stringify(draft))).toMatchObject(draft);
		expect(() => validateSourceMetadata(draft)).not.toThrow();
		expect(() => validatePublicationMetadata(draft)).toThrow();
		expect(() => validatePublicationMetadata(metadata)).not.toThrow();
	});
	it("rejects future provenance and blocks publication of translations lacking original/disclaimer", () => {
		expect(() => validateSourceMetadata({ ...metadata, retrievedAt: "2999-01-01" })).toThrow();
		expect(() =>
			validateSourceMetadata({ ...metadata, sourcePublishedAt: "2027-01-01" })
		).toThrow();
		expect(() => validatePublicationMetadata({ ...metadata, originalLocale: "en" })).toThrow();
	});
	it("separates AI, offline, translation and medical decisions", () => {
		expect(() => assertRights(metadata, permitted)).not.toThrow();
		expect(() => assertRights(metadata, permitted, "OFFLINE")).toThrow();
		expect(() => assertRights(metadata, permitted, "TRANSLATION")).toThrow();
		expect(() =>
			assertRights(metadata, { ...permitted, offlineRedistributionAllowed: true }, "OFFLINE")
		).not.toThrow();
		expect(() =>
			assertRights({ ...metadata, classification: Classification.FIRST_AID }, permitted)
		).toThrow();
		expect(() =>
			assertRights(
				{ ...metadata, classification: Classification.FIRST_AID },
				{ ...permitted, medicalContentReviewStatus: MedicalStatus.APPROVED }
			)
		).not.toThrow();
	});
	it.each([
		{ originalname: "../secret.pdf" },
		{ originalname: "evil.pdf.exe" },
		{ originalname: "bad\u0000.pdf" },
		{ mimetype: "image/png" },
		{ buffer: Buffer.from("not a PDF") },
		{ buffer: Buffer.from("%PDF-1.4\n/JavaScript (alert())\n%%EOF") },
		{ buffer: Buffer.from("%PDF-1.4\n/J#61vaScript (alert())\n%%EOF") },
		{ buffer: Buffer.from("%PDF-1.4\n/EmbeddedFile 1 0 R\n%%EOF") },
		{ buffer: Buffer.from("%PDF-1.4\n/Encrypt 1 0 R\n%%EOF") },
		{ buffer: Buffer.alloc(10485761) },
	])(
		"rejects invalid or dangerous PDF case %#",
		async (changes) =>
			await expect(new PdfSourceService().fromUpload(file(changes))).rejects.toThrow()
	);
	it("stores privately, verifies checksum, rejects traversal and detects missing/tampered bytes", async () => {
		const root = await mkdtemp(join(tmpdir(), "ctms50-unit-"));
		const old = process.env.SURVIVAL_DOCUMENT_STORAGE_ROOT;
		process.env.SURVIVAL_DOCUMENT_STORAGE_ROOT = root;
		try {
			const storage = new SourceFilesService();
			const stored = {
				...(await new PdfSourceService().fromUpload(file())),
				fileRef: randomUUID(),
			};
			expect(stored.checksum).toBe(createHash("sha256").update(pdf).digest("hex"));
			await storage.write(stored.fileRef, pdf);
			expect(await storage.read(stored)).toEqual(pdf);
			await expect(storage.write("../escape", pdf)).rejects.toThrow();
			await writeFile(join(root, stored.fileRef), "tampered");
			await expect(storage.read(stored)).rejects.toThrow();
			await storage.remove(stored.fileRef);
			await expect(storage.read(stored)).rejects.toThrow();
		} finally {
			if (old === undefined) Reflect.deleteProperty(process.env, "SURVIVAL_DOCUMENT_STORAGE_ROOT");
			else process.env.SURVIVAL_DOCUMENT_STORAGE_ROOT = old;
			await rm(root, { recursive: true, force: true });
		}
	});
});
