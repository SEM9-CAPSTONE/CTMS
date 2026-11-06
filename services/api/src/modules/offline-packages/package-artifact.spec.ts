import { access, mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { unzipSync } from "fflate";
import {
	fictionalPackageCore,
	fictionalPackageSafety,
} from "../../../test/support/offline-package-fixture";
import type { PackageSnapshot } from "./offline-packages.types";
import { PackageArtifactBuilder } from "./package-artifact.builder";
import { LocalPackageArtifactStorage } from "./package-artifact.storage";
import { TripSafetyContextResolver, canonical, digest, sourceFingerprint } from "./package-policy";

describe("CTMS-052 immutable ZIP, privacy and integrity (BR-230/428)", () => {
	const builder = new PackageArtifactBuilder();
	const storage = new LocalPackageArtifactStorage();
	let snapshot: PackageSnapshot;
	let root: string;
	let originalRoot: string | undefined;
	const testRoot = resolve(__dirname, "../../../test-results");
	beforeAll(async () => {
		originalRoot = process.env.OFFLINE_PACKAGE_STORAGE_ROOT;
		await mkdir(testRoot, { recursive: true });
		root = await mkdtemp(join(testRoot, "ctms52-"));
		process.env.OFFLINE_PACKAGE_STORAGE_ROOT = root;
	});
	afterAll(async () => {
		if (originalRoot === undefined)
			Reflect.deleteProperty(process.env, "OFFLINE_PACKAGE_STORAGE_ROOT");
		else process.env.OFFLINE_PACKAGE_STORAGE_ROOT = originalRoot;
		if (dirname(root) !== testRoot) throw new Error("Unexpected test cleanup path");
		await rm(root, { recursive: true, force: true });
	});
	beforeEach(() => {
		const core = fictionalPackageCore();
		const safety = fictionalPackageSafety();
		snapshot = {
			core,
			safety,
			coreFingerprint: digest(canonical(core)),
			sourceFingerprint: sourceFingerprint(safety),
			nextVersion: 1,
		};
	});
	function build() {
		return builder.build(
			snapshot,
			new TripSafetyContextResolver().resolve(snapshot.core, snapshot.safety),
			[],
			snapshot.safety.guidance,
			"2026-11-06T00:00:00.000Z"
		);
	}
	it("writes the six-entry schema with deterministic ZIP bytes and external SHA-256", () => {
		const artifact = build();
		expect(build().bytes.equals(artifact.bytes)).toBe(true);
		expect(artifact.sha256).toBe(digest(artifact.bytes));
		const entries = unzipSync(artifact.bytes);
		expect(Object.keys(entries).sort()).toEqual([
			"checkpoints.json",
			"guidance.json",
			"hazards.geojson",
			"manifest.json",
			"route.geojson",
			"waypoints.json",
		]);
		expect(artifact.manifest.hazardSourceSummary[0].outcome).toBe("NO_ACTIVE_ALERT");
		expect(artifact.manifest).not.toHaveProperty("sha256");
	});
	it("does not serialize arbitrary metadata or Admin/reporter identities", () => {
		Object.assign(snapshot.core, { medical: "SECRET_MEDICAL", reporterId: "SECRET_REPORTER" });
		Object.assign(snapshot.core.waypoints[0], { metadata: { medical: "SECRET_MEDICAL" } });
		Object.assign(snapshot.core.geometry, { medical: "SECRET_MEDICAL" });
		Object.assign(snapshot.safety.feeds[0], { reporterId: "SECRET_REPORTER" });
		const entries = unzipSync(build().bytes);
		const body = Object.values(entries)
			.map((bytes) => Buffer.from(bytes).toString())
			.join("\n");
		for (const secret of ["SECRET_MEDICAL", "SECRET_REPORTER", "private-admin", "private-pdf"])
			expect(body).not.toContain(secret);
	});
	it("rejects corrupted ZIP payloads and manifest hashes", () => {
		const artifact = build();
		const corrupted = Buffer.from(artifact.bytes);
		corrupted[50] ^= 255;
		expect(() => builder.verify(corrupted, artifact.manifest)).toThrow();
		artifact.manifest.files[0].sha256 = "0".repeat(64);
		expect(() => builder.verify(artifact.bytes, artifact.manifest)).toThrow();
	});
	it("preserves v1 when v2 is created", () => {
		const first = build();
		snapshot.nextVersion = 2;
		const second = build();
		expect(first.manifest.packageVersion).toBe(1);
		expect(second.manifest.packageVersion).toBe(2);
		expect(first.sha256).not.toBe(second.sha256);
		expect(() => builder.verify(first.bytes, first.manifest)).not.toThrow();
	});
	it("stores identical concurrent writes without replacing bytes", async () => {
		const artifact = build();
		const key = `${artifact.sha256}.zip`;
		await Promise.all([storage.put(key, artifact.bytes), storage.put(key, artifact.bytes)]);
		expect(
			(await storage.read(key, artifact.sha256, artifact.bytes.length)).equals(artifact.bytes)
		).toBe(true);
	});
	it("refuses a corrupted existing object and checks size/hash on every read", async () => {
		const artifact = build();
		const key = `${artifact.sha256}.zip`;
		await writeFile(join(root, key), "bad");
		await expect(storage.put(key, artifact.bytes)).rejects.toThrow();
		await expect(storage.read(key, artifact.sha256, artifact.bytes.length)).rejects.toThrow();
		await storage.remove(key);
	});
	it("rejects traversal and publicly mounted storage", async () => {
		await expect(storage.remove("../artifact.zip")).rejects.toThrow();
		const artifact = build();
		const previousUpload = process.env.UPLOAD_ROOT;
		process.env.UPLOAD_ROOT = root;
		try {
			await expect(storage.put(`${artifact.sha256}.zip`, artifact.bytes)).rejects.toThrow(
				"private"
			);
		} finally {
			if (previousUpload === undefined) Reflect.deleteProperty(process.env, "UPLOAD_ROOT");
			else process.env.UPLOAD_ROOT = previousUpload;
		}
	});
	it("collects crash-left staging files without touching fresh files or ZIPs", async () => {
		const old = join(root, "00000000-0000-0000-0000-000000000000.tmp");
		const fresh = join(root, "11111111-1111-1111-1111-111111111111.tmp");
		await writeFile(old, "interrupted");
		await writeFile(fresh, "active");
		await utimes(old, new Date(0), new Date(0));
		await storage.cleanupTemporary();
		await expect(access(old)).rejects.toThrow();
		await expect(access(fresh)).resolves.toBeUndefined();
	});
});
