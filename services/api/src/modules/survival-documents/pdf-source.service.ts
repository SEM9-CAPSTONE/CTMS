import { Resolver } from "node:dns/promises";
import type { IncomingMessage } from "node:http";
import { get } from "node:https";
import { BlockList, isIP } from "node:net";
import { HttpException, Injectable } from "@nestjs/common";
import { invalidSource } from "./dto/source.dto";
import { isSafePdfFilename, pdfTooLarge, sourceMaxBytes, validatePdf } from "./pdf-file-validator";
import type { StoredSourceFile } from "./survival-documents.types";

const MAX_REDIRECTS = 3;
const DOWNLOAD_TIMEOUT_MS = 15_000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// Deny IANA special-use ranges, multicast and reserved IPv4 space.
const restricted = new BlockList();
for (const [network, prefix] of [
	["0.0.0.0", 8],
	["10.0.0.0", 8],
	["100.64.0.0", 10],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["172.16.0.0", 12],
	["192.0.0.0", 24],
	["192.0.2.0", 24],
	["192.88.99.0", 24],
	["192.168.0.0", 16],
	["198.18.0.0", 15],
	["198.51.100.0", 24],
	["203.0.113.0", 24],
	["224.0.0.0", 3],
] as const)
	restricted.addSubnet(network, prefix);
// Azure's virtual host endpoint uses an address outside the usual private ranges.
restricted.addAddress("168.63.129.16");

const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
for (const [network, prefix] of [
	["2001::", 23],
	["2001:db8::", 32],
	["2002::", 16],
	["3fff::", 20],
] as const)
	restricted.addSubnet(network, prefix, "ipv6");

function isPublicAddress(address: string): boolean {
	const family = isIP(address);
	if (family === 4) return !restricted.check(address);
	// Excludes local, mapped IPv4, NAT64, and other non-global IPv6 prefixes.
	return family === 6 && globalV6.check(address, "ipv6") && !restricted.check(address, "ipv6");
}

function publicPdfUrl(value: string, base?: URL): URL {
	const url = new URL(value, base);
	const host = url.hostname.replace(/\.$/, "");
	if (
		url.href.length > 2000 ||
		url.protocol !== "https:" ||
		url.port ||
		url.username ||
		url.password ||
		isIP(host) ||
		!/^[a-z0-9.-]+\.[a-z0-9-]+$/i.test(host) ||
		/(?:^|\.)(?:localhost|local|internal|test|invalid|onion|home\.arpa)$/i.test(host)
	)
		throw invalidSource("Chỉ chấp nhận URL PDF HTTPS công khai, không chứa tài khoản.");
	return url;
}

async function resolvePublicAddress(hostname: string, signal: AbortSignal): Promise<string> {
	signal.throwIfAborted();
	const resolver = new Resolver();
	const cancel = () => resolver.cancel();
	signal.addEventListener("abort", cancel, { once: true });
	const fqdn = hostname.endsWith(".") ? hostname : `${hostname}.`;
	try {
		const results = await Promise.allSettled([resolver.resolve4(fqdn), resolver.resolve6(fqdn)]);
		signal.throwIfAborted();
		const addresses = results.flatMap((result) => {
			if (result.status === "fulfilled") return result.value;
			if (result.reason?.code === "ENODATA") return [];
			throw invalidSource("Không thể xác minh địa chỉ máy chủ PDF.");
		});
		if (!addresses.length || addresses.some((address) => !isPublicAddress(address)))
			throw invalidSource("URL PDF trỏ đến địa chỉ mạng không được phép.");
		return addresses[0];
	} finally {
		signal.removeEventListener("abort", cancel);
	}
}

function requestPdf(url: URL, address: string, signal: AbortSignal): Promise<IncomingMessage> {
	const family = isIP(address);
	return new Promise((resolve, reject) => {
		// Keep the URL hostname for certificate verification and pin the socket to the checked IP.
		const request = get(
			url,
			{
				agent: false,
				rejectUnauthorized: true,
				family,
				lookup: (_hostname, _options, callback) => callback(null, address, family),
				signal,
				headers: {
					"User-Agent": "CTMS-PDF-Importer/1.0",
					Accept: "application/pdf, application/octet-stream",
					"Accept-Encoding": "identity",
				},
			},
			resolve
		);
		request.on("error", reject);
	});
}

async function readPdfResponse(response: IncomingMessage, limit: number): Promise<Buffer> {
	try {
		if (response.statusCode !== 200)
			throw invalidSource(
				`Máy chủ nguồn không cho tải PDF (HTTP ${response.statusCode ?? "không xác định"}). Kiểm tra đường dẫn hoặc tải tệp về máy rồi tải lên.`
			);
		const encoding = response.headers["content-encoding"];
		if (encoding && encoding.toLowerCase() !== "identity")
			throw invalidSource("Máy chủ PDF trả về định dạng nén không được hỗ trợ.");
		if (Number(response.headers["content-length"]) > limit) throw pdfTooLarge();

		const chunks: Buffer[] = [];
		let received = 0;
		for await (const chunk of response as AsyncIterable<Buffer>) {
			received += chunk.length;
			if (received > limit) throw pdfTooLarge();
			chunks.push(chunk);
		}
		return Buffer.concat(chunks, received);
	} finally {
		response.destroy();
	}
}

export type PdfSource = Omit<StoredSourceFile, "fileRef"> & { bytes: Buffer };

function pdfFilenameFromUrl(url: URL): string | undefined {
	try {
		const filename = decodeURIComponent(url.pathname.slice(url.pathname.lastIndexOf("/") + 1));
		return isSafePdfFilename(filename) ? filename : undefined;
	} catch {
		return undefined;
	}
}

function decodeUploadFilename(filename: string): string {
	// The Nest Multer interceptor decodes raw browser filename bytes as Latin-1.
	const raw = Buffer.from(filename, "latin1");
	if (raw.toString("latin1") !== filename) return filename;
	const decoded = raw.toString("utf8");
	return Buffer.from(decoded, "utf8").equals(raw) ? decoded : filename;
}

@Injectable()
export class PdfSourceService {
	async fromUpload(file?: Express.Multer.File): Promise<PdfSource> {
		if (!file) throw invalidSource("Vui lòng chọn tệp PDF.");
		if (file.mimetype !== "application/pdf") throw invalidSource("Chỉ nhận tệp PDF.");
		const filename = decodeUploadFilename(file.originalname);
		return { ...(await validatePdf(file.buffer, filename)), bytes: file.buffer };
	}

	async fromUrl(value: string): Promise<PdfSource & { finalSourceUrl?: string }> {
		const signal = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS);
		const limit = sourceMaxBytes();
		try {
			let url = publicPdfUrl(value);
			const requestedFilename = pdfFilenameFromUrl(url);
			for (let redirects = 0; ; redirects++) {
				const address = await resolvePublicAddress(url.hostname, signal);
				const response = await requestPdf(url, address, signal);
				if (!REDIRECT_STATUSES.has(response.statusCode ?? 0)) {
					const bytes = await readPdfResponse(response, limit);
					const filename = pdfFilenameFromUrl(url) ?? requestedFilename ?? null;
					// Redirect targets can carry temporary download credentials in their query string.
					const finalSourceUrl = redirects ? `${url.origin}${url.pathname}` : value;
					return { ...(await validatePdf(bytes, filename)), bytes, finalSourceUrl };
				}

				const location = response.headers.location;
				response.destroy();
				if (!location || redirects === MAX_REDIRECTS)
					throw invalidSource("URL PDF chuyển hướng quá giới hạn hoặc thiếu địa chỉ đích.");
				url = publicPdfUrl(location, url);
			}
		} catch (error) {
			if (error instanceof HttpException) throw error;
			throw invalidSource(
				signal.aborted ? "Đã hết thời gian tải PDF từ URL." : "Không thể tải PDF từ URL đã nhập."
			);
		}
	}
}
