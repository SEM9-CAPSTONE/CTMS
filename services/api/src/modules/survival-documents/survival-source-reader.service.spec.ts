import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	fictionalMetadata,
	fictionalRights,
	uniqueFictionalPdf,
} from "../../../test/support/survival-source-fixture";
import { SourceFilesService } from "./source-files.service";
import type { SurvivalDocumentsRepository } from "./survival-documents.repository";
import { DocumentStatus, type SourceVersion } from "./survival-documents.types";
import { SurvivalSourceReader } from "./survival-source-reader.service";

describe("Immutable original PDF reader", () => {
	let root: string;
	let previousRoot: string | undefined;
	beforeEach(async () => {
		previousRoot = process.env.SURVIVAL_DOCUMENT_STORAGE_ROOT;
		root = await mkdtemp(join(tmpdir(), "ctms-original-reader-"));
		process.env.SURVIVAL_DOCUMENT_STORAGE_ROOT = root;
	});
	afterEach(async () => {
		if (previousRoot === undefined)
			Reflect.deleteProperty(process.env, "SURVIVAL_DOCUMENT_STORAGE_ROOT");
		else process.env.SURVIVAL_DOCUMENT_STORAGE_ROOT = previousRoot;
		await rm(root, { recursive: true, force: true });
	});
	async function fixture() {
		const bytes = uniqueFictionalPdf();
		const version = {
			id: randomUUID(),
			documentId: randomUUID(),
			versionNumber: 1,
			status: DocumentStatus.PUBLISHED,
			publishedBy: randomUUID(),
			publishedAt: new Date().toISOString(),
			metadata: fictionalMetadata,
			rights: fictionalRights,
			fileRef: randomUUID(),
			originalFilename: "guide.pdf",
			contentType: "application/pdf",
			size: bytes.length,
			checksum: createHash("sha256").update(bytes).digest("hex"),
		} as SourceVersion;
		const storage = new SourceFilesService();
		await storage.write(version.fileRef, bytes);
		const manager = {
			query: jest.fn(async (sql: string) =>
				sql.startsWith("SELECT document_id AS") ? [{ documentId: version.documentId }] : [version]
			),
		};
		const repository = {
			db: { transaction: (work: (value: typeof manager) => unknown) => work(manager) },
			document: jest.fn(async () => ({
				id: version.documentId,
				currentPublishedVersionId: version.id,
			})),
		} as unknown as SurvivalDocumentsRepository;
		return {
			bytes,
			version,
			storage,
			repository,
			reader: new SurvivalSourceReader(repository, storage),
		};
	}
	it("returns identical original bytes and source identity across repeated processing reads", async () => {
		const { bytes, version, reader } = await fixture();
		for (let attempt = 0; attempt < 3; attempt++) {
			const source = await reader.readPublished(version.id);
			expect(source.bytes).toEqual(bytes);
			expect(source.manifest).toMatchObject({
				versionId: version.id,
				checksum: version.checksum,
				sourceVersion: 1,
			});
			expect(createHash("sha256").update(source.bytes).digest("hex")).toBe(version.checksum);
		}
	});
	it("rejects changed source bytes instead of repairing or replacing the recorded checksum", async () => {
		const { version, reader } = await fixture();
		const originalChecksum = version.checksum;
		await writeFile(join(root, version.fileRef), uniqueFictionalPdf());
		await expect(reader.readPublished(version.id)).rejects.toMatchObject({
			response: { code: "SOURCE_FILE_UNAVAILABLE" },
		});
		expect(version.checksum).toBe(originalChecksum);
	});
	it("does not read a superseded or non-current original for new ingestion", async () => {
		const { version, reader, storage, repository } = await fixture();
		const read = jest.spyOn(storage, "read");
		version.status = DocumentStatus.SUPERSEDED;
		await expect(reader.readPublished(version.id)).rejects.toMatchObject({ status: 409 });
		version.status = DocumentStatus.PUBLISHED;
		jest.mocked(repository.document).mockResolvedValue({
			id: version.documentId,
			currentPublishedVersionId: randomUUID(),
		} as never);
		await expect(reader.readPublished(version.id)).rejects.toMatchObject({ status: 409 });
		expect(read).not.toHaveBeenCalled();
	});
});
