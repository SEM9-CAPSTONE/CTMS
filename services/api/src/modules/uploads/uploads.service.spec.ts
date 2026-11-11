import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BadRequestException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { UploadsService } from "./uploads.service";

function file(overrides: Partial<Express.Multer.File>): Express.Multer.File {
	return {
		fieldname: "file",
		originalname: "certificate.pdf",
		encoding: "7bit",
		mimetype: "application/pdf",
		size: 10,
		buffer: Buffer.from("%PDF-1.7 test"),
		...overrides,
	} as Express.Multer.File;
}

describe("UploadsService.uploadDocument (local disk fallback)", () => {
	let uploadRoot: string;
	let service: UploadsService;
	const previousRoot = process.env.UPLOAD_ROOT;

	beforeEach(() => {
		uploadRoot = mkdtempSync(join(tmpdir(), "ctms-uploads-"));
		process.env.UPLOAD_ROOT = uploadRoot;
		const config = {
			get: jest.fn((key: string) => (key === "API_PUBLIC_URL" ? "http://api.test" : undefined)),
		};
		service = new UploadsService(config as unknown as ConfigService);
	});

	afterEach(() => {
		rmSync(uploadRoot, { recursive: true, force: true });
		if (previousRoot === undefined) Reflect.deleteProperty(process.env, "UPLOAD_ROOT");
		else process.env.UPLOAD_ROOT = previousRoot;
	});

	it("reserves a deterministic Trip image and deletes its local file idempotently", async () => {
		const prepared = service.prepareTripImage(file({ mimetype: "image/png" }));
		const stored = await prepared.upload();
		expect(stored.url).toBe(prepared.url);
		const name = stored.url.split("/").pop() as string;
		expect(existsSync(join(uploadRoot, "trips", name))).toBe(true);
		await service.deleteStoredImage(stored.url);
		expect(existsSync(join(uploadRoot, "trips", name))).toBe(false);
		await expect(service.deleteStoredImage(stored.url)).resolves.toBeUndefined();
	});

	it("stores a PDF and returns its public URL", async () => {
		const result = await service.uploadDocument(file({}), "porter-verifications");

		expect(result.url).toMatch(
			/^http:\/\/api\.test\/uploads\/porter-verifications\/doc-[\w-]+\.pdf$/
		);
		const fileName = result.url.split("/").pop() as string;
		expect(existsSync(join(uploadRoot, "porter-verifications", fileName))).toBe(true);
	});

	it("accepts JPG, PNG and WEBP images", async () => {
		for (const [mimetype, name] of [
			["image/jpeg", "a.jpg"],
			["image/png", "a.png"],
			["image/webp", "a.webp"],
		]) {
			await expect(
				service.uploadDocument(file({ mimetype, originalname: name, buffer: Buffer.from("x") }))
			).resolves.toHaveProperty("url");
		}
	});

	it("rejects a missing file", async () => {
		await expect(service.uploadDocument(undefined)).rejects.toBeInstanceOf(BadRequestException);
	});

	it("rejects unsupported types such as GIF or Word documents", async () => {
		await expect(
			service.uploadDocument(file({ mimetype: "image/gif", originalname: "a.gif" }))
		).rejects.toBeInstanceOf(BadRequestException);
		await expect(
			service.uploadDocument(file({ mimetype: "application/msword", originalname: "a.doc" }))
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it("rejects a file declared as PDF without a PDF signature", async () => {
		await expect(
			service.uploadDocument(file({ buffer: Buffer.from("<html>not a pdf</html>") }))
		).rejects.toThrow("File PDF không hợp lệ");
	});
});
