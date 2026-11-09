import { createHash, randomUUID } from "node:crypto";
import { ConflictException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { OfflinePackagesService } from "../offline-packages/offline-packages.service";
import {
	PackageFailure,
	PackageReason,
	type ReadyPackageMetadata,
} from "../offline-packages/offline-packages.types";
import type { OfflinePackageAccessRepository } from "./offline-package-access.repository";
import { OfflinePackageDownloadService } from "./offline-package-download.service";
import { packageByteRange } from "./package-byte-range";

describe("CTMS-053 range and private download policy", () => {
	const tripId = randomUUID();
	const userId = randomUUID();
	const bytes = Buffer.from("fictional immutable ZIP transport");
	const sha256 = createHash("sha256").update(bytes).digest("hex");
	const metadata: ReadyPackageMetadata = {
		id: randomUUID(),
		tripId,
		packageVersion: 1,
		generationKey: "private",
		schemaVersion: 1,
		sha256,
		sizeBytes: bytes.length,
		generatedAt: new Date().toISOString(),
		contentType: "application/zip",
	};
	const access = { downloadableTripStatus: jest.fn() };
	const packages = { getReadyMetadata: jest.fn(), readArtifact: jest.fn() };
	let service: OfflinePackageDownloadService;
	beforeEach(() => {
		jest.resetAllMocks();
		access.downloadableTripStatus.mockResolvedValue("published");
		packages.getReadyMetadata.mockResolvedValue(metadata);
		packages.readArtifact.mockResolvedValue(bytes);
		service = new OfflinePackageDownloadService(
			access as unknown as OfflinePackageAccessRepository,
			packages as unknown as OfflinePackagesService
		);
	});
	it.each([
		[undefined, undefined],
		["bytes=0-3", { start: 0, end: 3 }],
		["bytes=3-", { start: 3, end: 9 }],
		["bytes=-3", { start: 7, end: 9 }],
		["bytes=2-99", { start: 2, end: 9 }],
		["bytes=-99", { start: 0, end: 9 }],
		["bytes=10-", null],
		["bytes=5-2", null],
		["bytes=-0", null],
		["bytes=-", null],
		["bytes=0-2,4-6", null],
		["items=0-2", null],
		["bytes=9007199254740992-", null],
	])("parses %s", (header, expected) => expect(packageByteRange(header, 10)).toEqual(expected));
	it("rejects an outsider before reading private metadata", async () => {
		access.downloadableTripStatus.mockResolvedValue(null);
		await expect(service.metadata(userId, tripId)).rejects.toBeInstanceOf(NotFoundException);
		expect(packages.getReadyMetadata).not.toHaveBeenCalled();
	});
	it("returns authenticated size/version/digest without private provenance", async () => {
		const result = await service.metadata(userId, tripId);
		expect(result.etag).toBe(`"${sha256}"`);
		expect(result.sizeBytes).toBe(bytes.length);
		expect(result.activationAllowed).toBe(true);
		expect(result).not.toHaveProperty("generationKey");
	});
	it("allows ongoing Trip transfer without allowing activation", async () => {
		access.downloadableTripStatus.mockResolvedValue("ongoing");
		expect((await service.metadata(userId, tripId)).activationAllowed).toBe(false);
		expect((await service.download(userId, tripId, 1, "bytes=4-")).status).toBe(206);
	});
	it("rejects generation states that have no READY artifact", async () => {
		packages.getReadyMetadata.mockResolvedValue(null);
		await expect(service.download(userId, tripId, 1)).rejects.toBeInstanceOf(ConflictException);
		expect(packages.readArtifact).not.toHaveBeenCalled();
	});
	it.each([
		{ schemaVersion: 2 },
		{ tripId: randomUUID() },
		{ sizeBytes: 0 },
		{ sizeBytes: 21 * 1024 * 1024 },
		{ sha256: "bad" },
		{ packageVersion: 2 },
		{ packageVersion: 0 },
		{ packageVersion: 1.5 },
		{ contentType: "text/html" },
	])("rejects invalid metadata %j", async (change) => {
		packages.getReadyMetadata.mockResolvedValue({ ...metadata, ...change });
		await expect(service.download(userId, tripId, 1)).rejects.toBeInstanceOf(ConflictException);
	});
	it("returns exact full bytes with private cache headers", async () => {
		const result = await service.download(userId, tripId, 1);
		expect(result.status).toBe(200);
		expect(result.bytes).toEqual(bytes);
		expect(result.headers["Content-Length"]).toBe(String(bytes.length));
		expect(result.headers["Cache-Control"]).toContain("no-store");
		expect(result.headers.ETag).toBe(`"${sha256}"`);
	});
	it("resumes an immutable version", async () => {
		const result = await service.download(userId, tripId, 1, "bytes=4-", `"${sha256}"`);
		expect(result.status).toBe(206);
		expect(result.bytes).toEqual(bytes.subarray(4));
		expect(result.headers["Content-Range"]).toBe(`bytes 4-${bytes.length - 1}/${bytes.length}`);
	});
	it("restarts on mismatched or weak If-Range", async () => {
		for (const ifRange of ['"other"', `W/"${sha256}"`]) {
			const result = await service.download(userId, tripId, 1, "bytes=4-", ifRange);
			expect(result.status).toBe(200);
			expect(result.bytes).toEqual(bytes);
		}
	});
	it("returns authorized 416 with total length and no body", async () => {
		const result = await service.download(userId, tripId, 1, "bytes=9999-");
		expect(result.status).toBe(416);
		expect(result.headers["Content-Range"]).toBe(`bytes */${bytes.length}`);
		expect(result.bytes.length).toBe(0);
		expect(packages.readArtifact).not.toHaveBeenCalled();
	});
	it("re-authorizes every resume and 416 request", async () => {
		await service.download(userId, tripId, 1);
		access.downloadableTripStatus.mockResolvedValue(null);
		await expect(service.download(userId, tripId, 1, "bytes=4-")).rejects.toBeInstanceOf(
			NotFoundException
		);
		await expect(service.download(userId, tripId, 1, "bytes=9999-")).rejects.toBeInstanceOf(
			NotFoundException
		);
	});
	it("rejects access withdrawn during private file read", async () => {
		access.downloadableTripStatus.mockResolvedValueOnce("published").mockResolvedValue(null);
		await expect(service.download(userId, tripId, 1)).rejects.toBeInstanceOf(NotFoundException);
	});
	it("never treats storage corruption as valid download bytes", async () => {
		packages.readArtifact.mockRejectedValue(new PackageFailure([PackageReason.ARTIFACT_INVALID]));
		await expect(service.download(userId, tripId, 1)).rejects.toBeInstanceOf(
			ServiceUnavailableException
		);
	});
	it("rejects truncated storage bytes", async () => {
		packages.readArtifact.mockResolvedValue(bytes.subarray(1));
		await expect(service.download(userId, tripId, 1)).rejects.toBeInstanceOf(
			ServiceUnavailableException
		);
	});
});
