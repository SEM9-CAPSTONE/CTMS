import { createHash, randomUUID } from "node:crypto";
import { type INestApplication, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { JwtStrategy } from "../src/modules/auth/jwt.strategy";
import { OfflinePackageAccessRepository } from "../src/modules/offline-package-download/offline-package-access.repository";
import { OfflinePackageDownloadController } from "../src/modules/offline-package-download/offline-package-download.controller";
import { OfflinePackageDownloadService } from "../src/modules/offline-package-download/offline-package-download.service";
import { packageByteRange } from "../src/modules/offline-package-download/package-byte-range";
import { OfflinePackagesService } from "../src/modules/offline-packages/offline-packages.service";
import {
	PackageFailure,
	PackageReason,
	type ReadyPackageMetadata,
} from "../src/modules/offline-packages/offline-packages.types";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { UsersRepository } from "../src/modules/users/users.repository";

describe("CTMS-053 single byte ranges", () => {
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
	])("%s", (header, expected) => expect(packageByteRange(header, 10)).toEqual(expected));
});

describe("CTMS-053 authenticated private transport (HTTP + production JWT and role guards)", () => {
	const tripId = randomUUID();
	const userId = randomUUID();
	const bytes = Buffer.concat([
		Buffer.from("PK-fictional immutable package bytes"),
		Buffer.from([0x00, 0xff, 0x80, 0xc3, 0x28]),
	]);
	const sha256 = createHash("sha256").update(bytes).digest("hex");
	const metadata: ReadyPackageMetadata = {
		id: randomUUID(),
		tripId,
		packageVersion: 1,
		generationKey: "private-provenance",
		schemaVersion: 1,
		sha256,
		sizeBytes: bytes.length,
		generatedAt: new Date().toISOString(),
		contentType: "application/zip",
	};
	const access = { downloadableTripStatus: jest.fn() };
	const packages = { getReadyMetadata: jest.fn(), readArtifact: jest.fn() };
	const users = { findOneWithRolesById: jest.fn(), getGrantedRoles: jest.fn() };
	const secret = "ctms053-test-only-secret";
	const jwt = new JwtService({ secret });
	let app: INestApplication;
	const url = `/trips/${tripId}/offline-packages`;
	const token = () => jwt.sign({ sub: userId, roles: [UserRole.CAMPER] });
	beforeAll(async () => {
		const module = await Test.createTestingModule({
			imports: [PassportModule],
			controllers: [OfflinePackageDownloadController],
			providers: [
				OfflinePackageDownloadService,
				JwtStrategy,
				{ provide: ConfigService, useValue: { get: () => secret } },
				{ provide: UsersRepository, useValue: users },
				{ provide: OfflinePackageAccessRepository, useValue: access },
				{ provide: OfflinePackagesService, useValue: packages },
			],
		}).compile();
		app = module.createNestApplication();
		await app.init();
	});
	afterAll(async () => {
		await app?.close();
	});
	beforeEach(() => {
		jest.resetAllMocks();
		access.downloadableTripStatus.mockResolvedValue("published");
		packages.getReadyMetadata.mockResolvedValue(metadata);
		packages.readArtifact.mockResolvedValue(bytes);
		users.findOneWithRolesById.mockResolvedValue({ id: userId, status: UserStatus.ACTIVE });
		users.getGrantedRoles.mockReturnValue([UserRole.CAMPER]);
	});
	const get = (path: string) =>
		request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${token()}`);
	// Superagent does not default application/zip to a Buffer parser. Preserve raw bytes explicitly.
	const getBytes = (path: string) => get(path).responseType("arraybuffer");
	it("requires authentication for metadata and bytes", async () => {
		await request(app.getHttpServer()).get(`${url}/latest`).expect(401);
		await request(app.getHttpServer()).get(`${url}/1/download`).expect(401);
		expect(access.downloadableTripStatus).not.toHaveBeenCalled();
	});
	it("does not grant Host/Admin a participant bypass", async () => {
		users.getGrantedRoles.mockReturnValue([UserRole.ADMIN]);
		await get(`${url}/latest`).expect(403);
	});
	it("accepts assigned Porter role after participation authorization", async () => {
		users.getGrantedRoles.mockReturnValue([UserRole.PORTER]);
		await get(`${url}/latest`).expect(200);
		expect(access.downloadableTripStatus).toHaveBeenCalledWith(tripId, userId);
	});
	it("exposes only download metadata and a strong digest ETag", async () => {
		const response = await get(`${url}/latest`).expect(200);
		expect(response.body).toEqual({
			id: metadata.id,
			tripId,
			packageVersion: 1,
			schemaVersion: 1,
			sha256,
			sizeBytes: bytes.length,
			generatedAt: metadata.generatedAt,
			activationAllowed: true,
			contentType: "application/zip",
			etag: `"${sha256}"`,
		});
		expect(response.headers["cache-control"]).toContain("no-store");
	});
	it("returns byte-exact 200 with size and private headers", async () => {
		const result = await getBytes(`${url}/1/download`).expect(200);
		expect(result.body).toEqual(bytes);
		expect(result.headers["content-type"]).toBe("application/zip");
		expect(result.headers["content-length"]).toBe(String(bytes.length));
		expect(result.headers.etag).toBe(`"${sha256}"`);
		expect(result.headers["accept-ranges"]).toBe("bytes");
		expect(result.headers["cache-control"]).toContain("no-store");
	});
	it("resumes the same immutable version with 206 and exact Content-Range", async () => {
		const result = await getBytes(`${url}/1/download`)
			.set("Range", "bytes=5-")
			.set("If-Range", `"${sha256}"`)
			.expect(206);
		expect(result.body).toEqual(bytes.subarray(5));
		expect(result.headers["content-range"]).toBe(`bytes 5-${bytes.length - 1}/${bytes.length}`);
	});
	it("returns 200 on mismatched If-Range, never partial unrelated bytes", async () => {
		const result = await getBytes(`${url}/1/download`)
			.set("Range", "bytes=5-")
			.set("If-Range", '"different"')
			.expect(200);
		expect(result.body).toEqual(bytes);
		expect(result.headers["content-range"]).toBeUndefined();
	});
	it.each(["bytes=9999-", "bytes=4-2", "bytes=0-2,4-6"])(
		"returns authorized 416 for %s",
		async (range) => {
			const result = await get(`${url}/1/download`).set("Range", range).expect(416);
			expect(result.headers["content-range"]).toBe(`bytes */${bytes.length}`);
			expect(packages.readArtifact).not.toHaveBeenCalled();
		}
	);
	it("rechecks access on resume, including when requesting 416", async () => {
		await get(`${url}/1/download`).expect(200);
		access.downloadableTripStatus.mockResolvedValue(null);
		await get(`${url}/1/download`).set("Range", "bytes=5-").expect(404);
		await get(`${url}/1/download`).set("Range", "bytes=9999-").expect(404);
		await get(`${url}/latest`).expect(404);
	});
	it("denies bytes if membership is withdrawn during artifact reading", async () => {
		access.downloadableTripStatus.mockResolvedValueOnce("published").mockResolvedValue(null);
		await get(`${url}/1/download`).expect(404);
	});
	it("rejects a disabled account with a previously issued JWT", async () => {
		users.findOneWithRolesById.mockResolvedValue(null);
		await get(`${url}/1/download`).expect(401);
	});
	it("does not turn a missing/blocked/failed generation into a downloadable package", async () => {
		packages.getReadyMetadata.mockResolvedValue(null);
		await get(`${url}/latest`).expect(409);
		await get(`${url}/1/download`).expect(409);
		expect(packages.readArtifact).not.toHaveBeenCalled();
	});
	it.each([
		{ schemaVersion: 2 },
		{ tripId: randomUUID() },
		{ sizeBytes: 0 },
		{ sha256: "bad" },
		{ packageVersion: 2 },
	])("rejects invalid handoff %j", async (change) => {
		packages.getReadyMetadata.mockResolvedValue({ ...metadata, ...change });
		await get(`${url}/1/download`).expect(409);
	});
	it("does not return a damaged private artifact as success", async () => {
		packages.readArtifact.mockRejectedValue(new PackageFailure([PackageReason.ARTIFACT_INVALID]));
		await get(`${url}/1/download`).expect(503);
	});
	it.each(["0", "-1", "1.5", "2147483648"])("rejects invalid version %s", async (version) => {
		await get(`${url}/${version}/download`).expect(422);
	});
	it("does not read package metadata outside the caller's Trip", async () => {
		access.downloadableTripStatus.mockResolvedValue(null);
		const service = new OfflinePackageDownloadService(
			access as unknown as OfflinePackageAccessRepository,
			packages as unknown as OfflinePackagesService
		);
		await expect(service.metadata(userId, randomUUID())).rejects.toBeInstanceOf(NotFoundException);
		expect(packages.getReadyMetadata).not.toHaveBeenCalled();
	});
});
