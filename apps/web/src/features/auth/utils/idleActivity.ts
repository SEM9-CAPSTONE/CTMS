import { LAST_ACTIVITY_KEY } from "../../../core/api/authSessionSync";
import { IDLE_TIMEOUT_MS } from "../constants";

export function markUserActivity(now: number = Date.now()): void {
	localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
}

export function getLastActivityAt(): number | null {
	const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
	const value = raw === null ? Number.NaN : Number(raw);
	return Number.isFinite(value) ? value : null;
}

/** Milliseconds left before the idle timeout; 0 or less means the session is idle. */
export function getIdleRemainingMs(now: number = Date.now()): number {
	const lastActivityAt = getLastActivityAt() ?? now;
	return lastActivityAt + IDLE_TIMEOUT_MS - now;
}
