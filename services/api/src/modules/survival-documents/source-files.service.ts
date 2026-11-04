import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { Injectable, PayloadTooLargeException, ServiceUnavailableException } from "@nestjs/common";
import { getUploadRoot } from "../../shared/uploads/upload-paths";
import { invalidSource } from "./dto/source.dto";
import type { StoredSourceFile } from "./survival-documents.types";

export function sourceMaxBytes(): number {
	const value = Number(process.env.SURVIVAL_DOCUMENT_MAX_BYTES ?? 10 * 1024 * 1024);
	if (!Number.isSafeInteger(value) || value < 1024 || value > 50 * 1024 * 1024)
		throw new Error("Invalid SURVIVAL_DOCUMENT_MAX_BYTES");
	return value;
}
@Injectable()
export class SourceFilesService {
	private root(): string {
		const root = resolve(
			process.env.SURVIVAL_DOCUMENT_STORAGE_ROOT ?? ".private-survival-documents"
		);
		const publicRoot = resolve(getUploadRoot());
		const path = relative(publicRoot, root);
		if (!path || (!path.startsWith("..") && !isAbsolute(path)))
			throw new Error("Survival storage must be outside public uploads");
		return root;
	}
	private path(key: string): string {
		if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key))
			throw invalidSource("Mã tệp không hợp lệ.");
		return resolve(this.root(), key);
	}
	validate(file?: Express.Multer.File): Omit<StoredSourceFile, "fileRef"> {
		if (!file) throw invalidSource("Vui lòng chọn tệp PDF.");
		const bytes = file.buffer;
		if (bytes.length > sourceMaxBytes())
			throw new PayloadTooLargeException({
				code: "FILE_TOO_LARGE",
				message: "Tệp vượt quá dung lượng cho phép.",
			});
		if (
			!file.originalname ||
			file.originalname.length > 180 ||
			/[\\/<>:"|?*]/.test(file.originalname) ||
			Array.from(file.originalname).some(
				(character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
			) ||
			file.originalname.includes("..") ||
			!/\.pdf$/i.test(file.originalname)
		)
			throw invalidSource("Tên tệp PDF không hợp lệ.");
		const text = bytes
			.toString("latin1")
			.replace(/#([a-f0-9]{2})/gi, (_match, hex: string) =>
				String.fromCharCode(Number.parseInt(hex, 16))
			);
		if (
			file.mimetype !== "application/pdf" ||
			!/^%PDF-(?:1\.[0-7]|2\.0)[\r\n]/.test(text) ||
			!/%%EOF\s*$/.test(text) ||
			/\/\s*(?:JavaScript|JS|Launch|EmbeddedFile|RichMedia|OpenAction|AA|XFA|Encrypt|ObjStm)\b/i.test(
				text
			) ||
			/<script\b/i.test(text)
		)
			throw invalidSource(
				"Chỉ nhận PDF hợp lệ, không mã hóa hoặc chứa nội dung chủ động/tệp đính kèm."
			);
		return {
			originalFilename: file.originalname,
			size: bytes.length,
			checksum: createHash("sha256").update(bytes).digest("hex"),
			contentType: "application/pdf",
		};
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
