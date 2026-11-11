import { createHash } from "node:crypto";
import { PayloadTooLargeException } from "@nestjs/common";
import { PDFArray, PDFDict, PDFDocument, PDFName, type PDFObject, PDFStream } from "pdf-lib";
import { invalidSource } from "./dto/source.dto";
import type { StoredSourceFile } from "./survival-documents.types";

const UNSAFE_PDF_NAME =
	/^(?:JavaScript|JS|Launch|EmbeddedFile|RichMedia|OpenAction|AA|XFA|Encrypt)$/;
const UNSAFE_PDF_MESSAGE =
	"PDF chứa mã hóa, nội dung chủ động hoặc tệp đính kèm không được hỗ trợ.";

async function validatePdfStructure(bytes: Buffer): Promise<void> {
	let document: PDFDocument;
	try {
		document = await PDFDocument.load(bytes, {
			ignoreEncryption: false,
			throwOnInvalidObject: true,
			updateMetadata: false,
		});
		if (document.getPageCount() < 1) throw new Error("PDF has no pages");
	} catch {
		throw invalidSource("Không đọc được cấu trúc PDF. Tệp có thể bị hỏng hoặc được mã hóa.");
	}

	// The parser expands /ObjStm so compressed dictionaries receive the same safety checks.
	const pending: PDFObject[] = document.context
		.enumerateIndirectObjects()
		.map(([, object]) => object);
	const inspected = new Set<PDFObject>();
	while (pending.length) {
		const object = pending.pop();
		if (!object || inspected.has(object)) continue;
		inspected.add(object);
		if (object instanceof PDFName && UNSAFE_PDF_NAME.test(object.decodeText()))
			throw invalidSource(UNSAFE_PDF_MESSAGE);
		if (object instanceof PDFDict)
			for (const [key, value] of object.entries()) pending.push(key, value);
		if (object instanceof PDFArray) for (const value of object.asArray()) pending.push(value);
		if (object instanceof PDFStream) pending.push(object.dict);
	}
}

export function sourceMaxBytes(): number {
	const value = Number(process.env.SURVIVAL_DOCUMENT_MAX_BYTES ?? 10 * 1024 * 1024);
	if (!Number.isSafeInteger(value) || value < 1024 || value > 50 * 1024 * 1024)
		throw new Error("Invalid SURVIVAL_DOCUMENT_MAX_BYTES");
	return value;
}

export function pdfTooLarge(): PayloadTooLargeException {
	return new PayloadTooLargeException({
		code: "FILE_TOO_LARGE",
		message: "Tệp vượt quá dung lượng cho phép.",
	});
}

export function isSafePdfFilename(filename: string): boolean {
	return (
		typeof filename === "string" &&
		filename.length <= 180 &&
		!/[/\\<>:"|?*]/.test(filename) &&
		!Array.from(filename).some(
			(character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
		) &&
		!filename.includes("..") &&
		/\.pdf$/i.test(filename)
	);
}

export async function validatePdf(
	bytes: Buffer,
	originalFilename: string | null
): Promise<Omit<StoredSourceFile, "fileRef">> {
	if (bytes.length > sourceMaxBytes()) throw pdfTooLarge();
	if (originalFilename !== null && !isSafePdfFilename(originalFilename))
		throw invalidSource("Tên tệp PDF không hợp lệ.");

	const text = bytes.toString("latin1");
	if (!/^%PDF-(?:1\.[0-7]|2\.0)[\r\n]/.test(text) || !/%%EOF\s*$/.test(text))
		throw invalidSource("Tệp không phải PDF hợp lệ hoặc đã bị hỏng.");
	// Image/content stream bytes can contain these strings accidentally. Only parsed PDF names
	// identify commands, and PDF names are case-sensitive (for example, /aa is not /AA).
	await validatePdfStructure(bytes);
	const checksum = createHash("sha256").update(bytes).digest("hex");
	return {
		originalFilename: originalFilename ?? `imported-${checksum}.pdf`,
		size: bytes.length,
		checksum,
		contentType: "application/pdf",
	};
}
