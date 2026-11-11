import { NCHMF } from "./nchmf-safety.policy";

// Both destinations are operator configuration, never taken from route input.
export function providerUrl(value: string): URL {
	const url = new URL(value);
	if (url.protocol !== "https:" || url.username || url.password) {
		throw new Error("Provider URL must use HTTPS without embedded credentials");
	}
	return url;
}

export async function readProviderJson(url: URL, init: RequestInit): Promise<unknown> {
	const response = await fetch(url, { ...init, redirect: "error", cache: "no-store" });
	if (!response.ok || !response.body) throw new Error("Safety provider request failed");
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > NCHMF.maxResponseBytes) throw new Error("NCHMF response exceeds limit");
			chunks.push(value);
		}
	} finally {
		await reader.cancel();
	}
	return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

export function objectRecord(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Invalid NCHMF record");
	}
	return value as Record<string, unknown>;
}
