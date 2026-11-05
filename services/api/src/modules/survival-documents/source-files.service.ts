import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { getUploadRoot } from "../../shared/uploads/upload-paths";
import { invalidSource } from "./dto/source.dto";
import type { StoredSourceFile } from "./survival-documents.types";

@Injectable()
export class SourceFilesService {
	private root(): string {
		const root = resolve(
			process.env.SURVIVAL_DOCUMENT_STORAGE_ROOT ?? ".private-survival-documents"
		);
		const publicRoot = resolve(getUploadRoot());
		const path = relative(publicRoot, root);
		if (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`))
			throw new Error("Survival storage must be outside public uploads");
		return root;
	}
	private path(key: string): string {
		if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key))
			throw invalidSource("Mã tệp không hợp lệ.");
		return resolve(this.root(), key);
	}
	async write(key: string, bytes: Buffer): Promise<void> {
		await mkdir(this.root(), { recursive: true, mode: 0o700 });
		await writeFile(this.path(key), bytes, { flag: "wx", mode: 0o600 });
	}
	async read(file: StoredSourceFile): Promise<Buffer> {
		try {
			const bytes = await readFile(this.path(file.fileRef));
			if (
				bytes.length !== file.size ||
				createHash("sha256").update(bytes).digest("hex") !== file.checksum
			)
				throw new Error("Checksum mismatch");
			return bytes;
		} catch {
			throw new ServiceUnavailableException({
				code: "SOURCE_FILE_UNAVAILABLE",
				message: "Tệp gốc không khả dụng hoặc đã thay đổi. Vui lòng kiểm tra kho lưu trữ.",
			});
		}
	}
	async remove(key: string): Promise<void> {
		try {
			await unlink(this.path(key));
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
	}
}
