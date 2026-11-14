import { Resolver } from "node:dns/promises";
import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import { type RequestOptions, get } from "node:https";
import { Readable } from "node:stream";
import { PDFDocument } from "pdf-lib";
import { fictionalPdf as pdf } from "../../../test/support/survival-source-fixture";
import { PdfSourceService } from "./pdf-source.service";

jest.mock("node:dns/promises");
jest.mock("node:https", () => ({ get: jest.fn() }));

const resolve4 = jest.mocked(Resolver.prototype.resolve4);
const resolve6 = jest.mocked(Resolver.prototype.resolve6);
const getRequest = jest.mocked(get);
const service = new PdfSourceService();
const url = "https://example.org/download";

function respond(statusCode: number, headers = {}, chunks: Buffer[] = []) {
	const message = Object.assign(Readable.from(chunks), { statusCode, headers });
	getRequest.mockImplementationOnce((...args: unknown[]) => {
		const callback = args[2] as (response: IncomingMessage) => void;
		callback(message as unknown as IncomingMessage);
		return new EventEmitter() as ReturnType<typeof get>;
	});
}

beforeEach(() => {
	jest.resetAllMocks();
	resolve4.mockResolvedValue(["93.184.215.14"]);
	resolve6.mockRejectedValue(Object.assign(new Error("No AAAA record"), { code: "ENODATA" }));
});

describe("PDF URL ingestion", () => {
	it("pins a checked IP while retaining the HTTPS hostname and validates bytes", async () => {
		respond(200, { "content-type": "application/octet-stream" }, [pdf]);
		await expect(service.fromUrl(url)).resolves.toMatchObject({
			bytes: pdf,
			contentType: "application/pdf",
			size: pdf.length,
			originalFilename: expect.stringMatching(/^imported-[a-f0-9]{64}\.pdf$/),
		});
		expect(resolve4).toHaveBeenCalledWith("example.org.");
		const [target, options] = getRequest.mock.calls[0] as unknown as [URL, RequestOptions];
		expect(target.hostname).toBe("example.org");
		expect(options).toMatchObject({
			family: 4,
			agent: false,
			rejectUnauthorized: true,
			headers: { "User-Agent": "CTMS-PDF-Importer/1.0" },
		});
		const lookupCallback = jest.fn();
		options.lookup?.("example.org", {}, lookupCallback);
		expect(lookupCallback).toHaveBeenCalledWith(null, "93.184.215.14", 4);
	});

	it.each([403, 404, 429, 500])("reports the actual source HTTP status %i", async (status) => {
		respond(status, { "content-type": "text/html" }, [Buffer.from("Source error")]);
		await expect(service.fromUrl(url)).rejects.toThrow(`HTTP ${status}`);
		expect(getRequest).toHaveBeenCalledTimes(1);
	});

	it("imports an ordinary PDF with compressed object streams", async () => {
		const document = await PDFDocument.create();
		document.addPage([200, 200]);
		const bytes = Buffer.from(await document.save({ useObjectStreams: true }));
		respond(200, { "content-type": "application/pdf" }, [bytes]);
		await expect(service.fromUrl(`${url}.pdf`)).resolves.toMatchObject({
			bytes,
			originalFilename: "download.pdf",
		});
	});

	it("uses a safe decoded PDF filename from the final URL", async () => {
		respond(302, { location: "/c%E1%BA%A9m-nang.PDF?download=1" });
		respond(200, {}, [pdf]);
		await expect(service.fromUrl(url)).resolves.toMatchObject({
			originalFilename: "cẩm-nang.PDF",
			finalSourceUrl: "https://example.org/c%E1%BA%A9m-nang.PDF",
		});
	});

	it("falls back to the requested filename when the final path has no safe PDF name", async () => {
		respond(302, { location: "/unsafe%2Ffilename.pdf" });
		respond(200, {}, [pdf]);
		await expect(service.fromUrl(`${url}.pdf`)).resolves.toMatchObject({
			originalFilename: "download.pdf",
		});
	});

	it.each([
		"http://example.org/a",
		"https://user:pass@example.org/a",
		"https://example.org:8443/a",
		"https://0x7f000001/a",
		"https://[::1]/a",
		"https://foo.localhost./a",
	])("rejects unsafe URLs before resolving DNS (%s)", async (input) => {
		await expect(service.fromUrl(input)).rejects.toThrow();
		expect(resolve4).not.toHaveBeenCalled();
		expect(getRequest).not.toHaveBeenCalled();
	});

	it.each(["127.0.0.1", "169.254.169.254", "100.64.0.5", "10.0.0.4", "168.63.129.16"])(
		"rejects mixed DNS answers containing %s",
		async (address) => {
			resolve4.mockResolvedValue(["93.184.215.14", address]);
			await expect(service.fromUrl(url)).rejects.toThrow();
			expect(getRequest).not.toHaveBeenCalled();
		}
	);

	it.each(["::ffff:127.0.0.1", "fc00::1", "64:ff9b::a00:1", "2002:7f00:1::"])(
		"rejects non-public or transitional IPv6 address %s",
		async (address) => {
			resolve6.mockResolvedValue([address]);
			await expect(service.fromUrl(url)).rejects.toThrow();
			expect(getRequest).not.toHaveBeenCalled();
		}
	);

	it("checks every redirect target before making a request", async () => {
		respond(302, { location: "https://other.example.org/private.pdf" });
		resolve4.mockResolvedValueOnce(["93.184.215.14"]).mockResolvedValueOnce(["192.168.1.1"]);
		await expect(service.fromUrl(url)).rejects.toThrow();
		expect(resolve4).toHaveBeenLastCalledWith("other.example.org.");
		expect(getRequest).toHaveBeenCalledTimes(1);
	});

	it("caps redirect depth, including relative redirects", async () => {
		for (let i = 0; i < 4; i++) respond(302, { location: "/another.pdf" });
		await expect(service.fromUrl(url)).rejects.toThrow();
		expect(getRequest).toHaveBeenCalledTimes(4);
	});

	it("cancels DNS on the same deadline used for the download", async () => {
		const deadline = new AbortController();
		const timeout = jest.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
		let failLookup: (reason: Error) => void = () => undefined;
		resolve4.mockReturnValueOnce(
			new Promise((_resolve, reject) => {
				failLookup = reject;
			})
		);
		const cancel = jest.mocked(Resolver.prototype.cancel);
		cancel.mockImplementationOnce(() => failLookup(new Error("Cancelled")));
		try {
			const result = service.fromUrl(url);
			deadline.abort();
			await expect(result).rejects.toThrow("Đã hết thời gian tải PDF từ URL.");
			expect(timeout).toHaveBeenCalledWith(15_000);
			expect(cancel).toHaveBeenCalledTimes(1);
			expect(getRequest).not.toHaveBeenCalled();
		} finally {
			timeout.mockRestore();
		}
	});

	it("rejects deceptive extensions and content types", async () => {
		respond(200, { "content-type": "application/pdf" }, [Buffer.from("<html>Not a PDF</html>")]);
		await expect(service.fromUrl(`${url}.pdf`)).rejects.toThrow();
	});

	it("enforces the byte limit for chunked responses", async () => {
		const previous = process.env.SURVIVAL_DOCUMENT_MAX_BYTES;
		process.env.SURVIVAL_DOCUMENT_MAX_BYTES = "1024";
		try {
			respond(200, {}, [Buffer.alloc(600), Buffer.alloc(600)]);
			await expect(service.fromUrl(url)).rejects.toMatchObject({ status: 413 });
		} finally {
			if (previous === undefined)
				Reflect.deleteProperty(process.env, "SURVIVAL_DOCUMENT_MAX_BYTES");
			else process.env.SURVIVAL_DOCUMENT_MAX_BYTES = previous;
		}
	});
});
