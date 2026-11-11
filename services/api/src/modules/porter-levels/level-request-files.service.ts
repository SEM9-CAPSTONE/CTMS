import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";

export const LEVEL_EVIDENCE_MAX_SIZE = 5 * 1024 * 1024;
export const LEVEL_EVIDENCE_MAX_COUNT = 5;
export interface StoredLevelFile {
	fileRef: string;
	fileName: string;
	mimeType: string;
	size: number;
	checksum: string;
}
@Injectable()
export class LevelRequestFilesService {
	private root() {
		return join(process.cwd(), ".private-porter-level-evidence");
	}
	async store(file: Express.Multer.File): Promise<StoredLevelFile> {
		const bytes = file.buffer;
		let mimeType = "";
		if (bytes.subarray(0, 5).toString() === "%PDF-") mimeType = "application/pdf";
		if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
			mimeType = "image/png";
		if (bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
			mimeType = "image/jpeg";
		if (!mimeType || !bytes.length || bytes.length > LEVEL_EVIDENCE_MAX_SIZE)
			throw new UnprocessableEntityException({
				code: "INVALID_EVIDENCE_FILE",
				message: "Chỉ nhận PDF, PNG hoặc JPEG, tối đa 5 MB mỗi tệp.",
			});
		const fileRef = randomUUID();
		await mkdir(this.root(), { recursive: true });
		await writeFile(join(this.root(), fileRef), bytes, { flag: "wx", mode: 0o600 });
		return {
			fileRef,
			fileName: Array.from(file.originalname)
				.map((character) =>
					character.charCodeAt(0) < 32 || character === "/" || character === "\\" ? "_" : character
				)
				.join("")
				.slice(0, 255),
			mimeType,
			size: bytes.length,
			checksum: createHash("sha256").update(bytes).digest("hex"),
		};
	}
	async read(file: StoredLevelFile): Promise<Buffer> {
		try {
			const bytes = await readFile(join(this.root(), file.fileRef));
			if (createHash("sha256").update(bytes).digest("hex") !== file.checksum)
				throw new Error("Evidence checksum mismatch");
			return bytes;
		} catch {
			throw new NotFoundException("Không tìm thấy minh chứng nguyên bản.");
		}
	}
	// Only remove newly written files when their database transaction failed. Retained evidence has no delete API.
	async rollback(files: StoredLevelFile[]): Promise<void> {
		for (const file of files) await unlink(join(this.root(), file.fileRef)).catch(() => undefined);
	}
}
