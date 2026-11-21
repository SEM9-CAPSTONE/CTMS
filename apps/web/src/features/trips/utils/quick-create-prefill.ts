import type { QuickCreateContextResponse } from "../../host-analytics/types";

export const QUICK_CREATE_PREFILL_TTL_MS = 10 * 60 * 1000;

export interface StoredQuickCreatePrefill {
	hostId: string;
	suggestionId: string;
	expiresAt: number;
	prefill: QuickCreateContextResponse["prefill"];
}

export function quickCreatePrefillKey(hostId: string): string {
	return `ctms:quick-create-prefill:${hostId}`;
}

export function saveQuickCreatePrefill(
	hostId: string,
	suggestionId: string,
	prefill: QuickCreateContextResponse["prefill"],
	now: number = Date.now()
): void {
	if (!hostId || typeof window === "undefined") return;
	const payload: StoredQuickCreatePrefill = {
		hostId,
		suggestionId,
		expiresAt: now + QUICK_CREATE_PREFILL_TTL_MS,
		prefill,
	};
	try {
		window.sessionStorage.setItem(quickCreatePrefillKey(hostId), JSON.stringify(payload));
	} catch {
		// Ignore storage quota / private mode failures
	}
}

/**
 * Reads and immediately removes the stored prefill (consume-once).
 * Rejects expired entries or entries belonging to a different hostId.
 */
export function consumeQuickCreatePrefill(
	hostId: string,
	now: number = Date.now()
): StoredQuickCreatePrefill | null {
	if (!hostId || typeof window === "undefined") return null;
	const key = quickCreatePrefillKey(hostId);
	let raw: string | null = null;
	try {
		raw = window.sessionStorage.getItem(key);
		window.sessionStorage.removeItem(key);
	} catch {
		return null;
	}
	if (!raw) return null;

	try {
		const parsed = JSON.parse(raw) as Partial<StoredQuickCreatePrefill>;
		if (
			parsed.hostId !== hostId ||
			typeof parsed.suggestionId !== "string" ||
			typeof parsed.expiresAt !== "number" ||
			now > parsed.expiresAt ||
			!parsed.prefill ||
			typeof parsed.prefill.routeId !== "string"
		) {
			return null;
		}
		return parsed as StoredQuickCreatePrefill;
	} catch {
		return null;
	}
}
