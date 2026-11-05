import { createHash } from "node:crypto";
import { PDFDocument, PDFName } from "pdf-lib";
import { fictionalPdf } from "../../../test/support/survival-source-fixture";
import { validatePdf } from "./pdf-file-validator";
import { PdfSourceService } from "./pdf-source.service";

async function compressedPdf(
	edit?: (document: PDFDocument) => void | Promise<void>
): Promise<Buffer> {
	const document = await PDFDocument.create();
	document.addPage([200, 200]);
	await edit?.(document);
	return Buffer.from(await document.save({ useObjectStreams: true }));
}

async function pdfWithImagePixels(marker: string): Promise<Buffer> {
	const document = await PDFDocument.create();
	const page = document.addPage([200, 200]);
	const pixels = Buffer.alloc(Math.ceil(Buffer.byteLength(marker) / 3) * 3);
	pixels.write(marker);
	const image = document.context.register(
		document.context.stream(pixels, {
			Type: "XObject",
			Subtype: "Image",
			Width: pixels.length / 3,
			Height: 1,
			ColorSpace: "DeviceRGB",
			BitsPerComponent: 8,
		})
	);
	page.node.set(PDFName.of("Resources"), document.context.obj({ XObject: { Im1: image } }));
	page.node.set(
		PDFName.of("Contents"),
		document.context.register(document.context.stream("q 100 0 0 100 0 0 cm /Im1 Do Q"))
	);
	return Buffer.from(await document.save({ useObjectStreams: false }));
}

describe("PDF structure validation", () => {
	it("accepts compressed object streams and retains the original bytes and SHA-256", async () => {
		const bytes = await compressedPdf();
		expect(bytes.toString("latin1")).toContain("/ObjStm");
		const uploaded = await new PdfSourceService().fromUpload({
			buffer: bytes,
			originalname: "compressed.pdf",
			mimetype: "application/pdf",
		} as Express.Multer.File);
		expect(uploaded).toMatchObject({
			originalFilename: "compressed.pdf",
			size: bytes.length,
			checksum: createHash("sha256").update(bytes).digest("hex"),
		});
		expect(uploaded.bytes.equals(bytes)).toBe(true);
	});

	it("accepts the CR line endings used by the Weather.gov PDF", async () => {
		const bytes = Buffer.from(fictionalPdf.toString("latin1").replaceAll("\n", "\r"), "latin1");
		await expect(validatePdf(bytes, "cr-lines.pdf")).resolves.toMatchObject({ size: bytes.length });
	});

	it.each([
		"/aa",
		"/AA",
		"/JavaScript",
		"/JS",
		"/Launch",
		"/EmbeddedFile",
		"/RichMedia",
		"/OpenAction",
		"/XFA",
		"/Encrypt",
		"<script>",
	])("does not mistake image pixels containing %s for a PDF action", async (marker) => {
		const bytes = await pdfWithImagePixels(marker);
		expect(bytes.includes(Buffer.from(marker))).toBe(true);
		await expect(validatePdf(bytes, "image.pdf")).resolves.toMatchObject({
			checksum: createHash("sha256").update(bytes).digest("hex"),
		});
	});

	it("rejects JavaScript hidden in a compressed object stream", async () => {
		const bytes = await compressedPdf((document) =>
			document.addJavaScript("unsafe", "app.alert(1)")
		);
		expect(bytes.toString("latin1")).not.toMatch(/\/JavaScript|\/JS\b/);
		await expect(validatePdf(bytes, "script.pdf")).rejects.toThrow("nội dung chủ động");
	});

	it("rejects additional actions in compressed page dictionaries", async () => {
		const bytes = await compressedPdf((document) => {
			document
				.getPage(0)
				.node.set(PDFName.of("AA"), document.context.obj({ O: { S: "Launch", F: "program.exe" } }));
		});
		expect(bytes.toString("latin1")).not.toMatch(/\/AA\b|\/Launch\b/);
		await expect(validatePdf(bytes, "action.pdf")).rejects.toThrow("nội dung chủ động");
	});

	it("rejects escaped action names after parsing instead of scanning the raw bytes", async () => {
		const document = await PDFDocument.create();
		document.addPage([200, 200]);
		document.addJavaScript("unsafe", "app.alert(1)");
		const bytes = Buffer.from(await document.save({ useObjectStreams: false }));
		const escaped = Buffer.from(
			bytes.toString("latin1").replaceAll("/JavaScript", "/J#61vaScript"),
			"latin1"
		);
		await expect(validatePdf(escaped, "escaped-action.pdf")).rejects.toThrow("nội dung chủ động");
	});

	it("continues to reject embedded attachments", async () => {
		const bytes = await compressedPdf(async (document) => {
			await document.attach(Buffer.from("attachment"), "attachment.txt");
		});
		await expect(validatePdf(bytes, "attachment.pdf")).rejects.toThrow("tệp đính kèm");
	});

	it("rejects a document declaring encryption in its trailer", async () => {
		const document = await PDFDocument.create();
		document.addPage([200, 200]);
		document.context.trailerInfo.Encrypt = document.context.register(
			document.context.obj({ Filter: "Standard", V: 1, R: 2, P: -4 })
		);
		const bytes = Buffer.from(await document.save({ useObjectStreams: false }));
		await expect(validatePdf(bytes, "encrypted.pdf")).rejects.toThrow("mã hóa");
	});

	it("rejects a forged PDF header and EOF without a readable document", async () => {
		await expect(validatePdf(Buffer.from("%PDF-1.4\n%%EOF\n"), "broken.pdf")).rejects.toThrow(
			"cấu trúc PDF"
		);
	});
});
