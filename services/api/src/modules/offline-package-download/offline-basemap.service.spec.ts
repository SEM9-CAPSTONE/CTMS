import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { DataSource } from "typeorm";
import { type BasemapMetadata, OfflineBasemapService } from "./offline-basemap.service";
import type { OfflinePackageAccessRepository } from "./offline-package-access.repository";

describe("private immutable basemap sidecars", () => {
	const db = { query: jest.fn() };
	const access = { downloadableTripStatus: jest.fn() };
	let service: OfflineBasemapService;
	let root: string;
	let oldRoot: string | undefined;
	const bytes = Buffer.from("fixture sqlite transport");
	const meta: BasemapMetadata = {
		packageId: "package",
		tripId: "trip",
		packageVersion: 2,
		sha256: createHash("sha256").update(bytes).digest("hex"),
		sizeBytes: bytes.length,
		bounds: [108, 16, 109, 17],
		minZoom: 12,
		maxZoom: 16,
		attribution: "OSM",
		licenseUrl: "license",
	};
	beforeEach(async () => {
		jest.resetAllMocks();
		access.downloadableTripStatus.mockResolvedValue("published");
		db.query.mockResolvedValue([meta]);
		service = new OfflineBasemapService(
			db as unknown as DataSource,
			access as unknown as OfflinePackageAccessRepository
		);
		root = await mkdtemp(join(tmpdir(), "ctms-basemap-"));
		oldRoot = process.env.OFFLINE_BASEMAP_STORAGE_ROOT;
		process.env.OFFLINE_BASEMAP_STORAGE_ROOT = root;
		await writeFile(join(root, `${meta.sha256}.mbtiles`), bytes);
	});
	afterEach(async () => {
		if (oldRoot === undefined) {
			// biome-ignore lint/performance/noDelete: assigning undefined creates a string in process.env
			delete process.env.OFFLINE_BASEMAP_STORAGE_ROOT;
		} else process.env.OFFLINE_BASEMAP_STORAGE_ROOT = oldRoot;
		await rm(root, { recursive: true, force: true });
	});
	it("denies revoked or unrelated participants before querying assets", async () => {
		access.downloadableTripStatus.mockResolvedValue(null);
		await expect(service.metadata("other", "trip", 2)).rejects.toBeInstanceOf(NotFoundException);
		expect(db.query).not.toHaveBeenCalled();
	});
	it("looks up the exact immutable core version", async () => {
		expect(await service.metadata("user", "trip", 2)).toEqual(meta);
		expect(db.query.mock.calls[0][1]).toEqual(["trip", 2]);
	});
	it("reports not-ready rather than substituting a different region", async () => {
		db.query.mockResolvedValue([]);
		await expect(service.metadata("user", "trip", 5)).rejects.toBeInstanceOf(ConflictException);
	});
	it("streams the checked file without buffering the map into memory", async () => {
		const file = await service.download("user", "trip", 2);
		const chunks: Buffer[] = [];
		for await (const chunk of file.getStream()) chunks.push(Buffer.from(chunk));
		expect(Buffer.concat(chunks)).toEqual(bytes);
		expect(file.getHeaders().length).toBe(bytes.length);
	});
	it("rejects altered bytes with the same length", async () => {
		await writeFile(join(root, `${meta.sha256}.mbtiles`), Buffer.alloc(bytes.length));
		await expect(service.download("user", "trip", 2)).rejects.toBeInstanceOf(ConflictException);
	});
});
