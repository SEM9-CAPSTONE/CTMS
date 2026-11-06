import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdir, open, readdir, stat, unlink } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Injectable } from "@nestjs/common";
import { getUploadRoot } from "../../shared/uploads/upload-paths";
import { MAX_PACKAGE_BYTES, PackageFailure, PackageReason } from "./offline-packages.types";
import { digest } from "./package-policy";

export abstract class PackageArtifactStorage {
	abstract put(key: string, bytes: Buffer): Promise<void>;
	abstract read(key: string, sha256: string, sizeBytes: number): Promise<Buffer>;
	abstract remove(key: string): Promise<void>;
	abstract cleanupTemporary(): Promise<void>;
}
@Injectable()
export class LocalPackageArtifactStorage extends PackageArtifactStorage {
	private root(): string {
		const root = resolve(process.env.OFFLINE_PACKAGE_STORAGE_ROOT ?? ".private-offline-packages");
		const path = relative(resolve(getUploadRoot()), root);
		if (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`))
			throw new Error("Package storage must be private");
		return root;
	}
	private path(key: string): string {
		if (!/^[a-f0-9]{64}\.zip$/.test(key))
			throw new PackageFailure([PackageReason.ARTIFACT_INVALID]);
		return resolve(this.root(), key);
	}
	async put(key: string, bytes: Buffer): Promise<void> {
		if (bytes.length > MAX_PACKAGE_BYTES || key !== `${digest(bytes)}.zip`)
			throw new PackageFailure([PackageReason.ARTIFACT_INVALID]);
		await mkdir(this.root(), { recursive: true, mode: 0o700 });
		const staging = resolve(this.root(), `${randomUUID()}.tmp`);
		try {
			const file = await open(staging, "wx", 0o600);
			try {
				await file.writeFile(bytes);
				await file.sync();
			} finally {
				await file.close();
			}
			let collision = false;
			try {
				await copyFile(staging, this.path(key), constants.COPYFILE_EXCL);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
				collision = true;
			}
			// Exclusive copy works on filesystems without hard links and never replaces a key.
			// Files are private/provisional; only the subsequent verified DB commit publishes them.
			// A competing exclusive copy can still be in progress after EEXIST.
			// Bound the wait; an interrupted or corrupted object never becomes READY.
			for (let attempt = 0; ; attempt++) {
				try {
					await this.read(key, digest(bytes), bytes.length);
					break;
				} catch (error) {
					if (!collision || attempt >= 5) throw error;
					await delay(25 * 2 ** attempt);
				}
			}
			const stored = await open(this.path(key), "r+");
			try {
				await stored.sync();
			} finally {
				await stored.close();
			}
		} finally {
			await unlink(staging).catch(() => undefined);
		}
	}
	async read(key: string, sha256: string, sizeBytes: number): Promise<Buffer> {
		try {
			if (sizeBytes > MAX_PACKAGE_BYTES) throw new Error();
			const file = await open(this.path(key), "r");
			try {
				if ((await file.stat()).size !== sizeBytes) throw new Error();
				const bytes = await file.readFile();
				if (bytes.length !== sizeBytes || digest(bytes) !== sha256) throw new Error();
				return bytes;
			} finally {
				await file.close();
			}
		} catch {
			throw new PackageFailure([PackageReason.ARTIFACT_INVALID]);
		}
	}
	async remove(key: string): Promise<void> {
		try {
			await unlink(this.path(key));
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
	}
	async cleanupTemporary(): Promise<void> {
		const root = this.root();
		let names: string[];
		try {
			names = await readdir(root);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
			throw error;
		}
		for (const name of names) {
			if (!/^[a-f0-9-]{36}\.tmp$/.test(name)) continue;
			const path = resolve(root, name);
			try {
				if ((await stat(path)).mtimeMs < Date.now() - 24 * 60 * 60 * 1000) await unlink(path);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			}
		}
	}
}
