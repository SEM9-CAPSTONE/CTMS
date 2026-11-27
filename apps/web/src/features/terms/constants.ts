export const TERMS_STALE_TIME_MS = 5 * 60 * 1000;
export const TERMS_STATUS_STALE_TIME_MS = 60 * 1000;
export const TERMS_OUTDATED_CODE = "TERMS_VERSION_OUTDATED";

export function formatTermsVersionLabel(version: string): string {
	const cleaned = version.trim().replace(/^[vV]/, "");
	return `v${cleaned}`;
}

export function formatTermsDate(value: string): string {
	if (!value) return "—";
	const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
	if (isoDateMatch) {
		const [, year, month, day] = isoDateMatch;
		return `${day}/${month}/${year}`;
	}
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return value;
	const day = String(parsed.getDate()).padStart(2, "0");
	const month = String(parsed.getMonth() + 1).padStart(2, "0");
	const year = parsed.getFullYear();
	return `${day}/${month}/${year}`;
}

export function isTermsVersionOutdatedError(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	const candidate = error as { status?: number; errorData?: unknown; body?: unknown };
	if (candidate.status !== 409) return false;
	const payload = candidate.errorData ?? candidate.body;
	if (payload && typeof payload === "object") {
		const code = (payload as { code?: unknown }).code;
		return code === TERMS_OUTDATED_CODE;
	}
	return false;
}
