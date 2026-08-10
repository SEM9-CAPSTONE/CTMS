import { API_ENDPOINTS } from "./endpoints";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

interface RefreshResponse {
	accessToken: string;
	refreshToken: string;
}

/**
 * CTMS-04-T02, DG-05/DG-06: the token pair issued by CTMS-04-T01's
 * `POST /auth/refresh` — `{ refreshToken }` in, `{ accessToken, refreshToken }`
 * out, always rotated (see file/spec/ctms-04-refresh-authentication-session.md's
 * "API Contract" section). No `user` field, matching that contract exactly.
 */

/**
 * CTMS-04-T02, DG-03/DG-05: single-flight refresh coordinator.
 *
 * Deliberately does NOT go through `httpClient.request()` — this is a plain
 * `fetch()` call, structurally independent of the interceptor logic that
 * will be added to `httpClient.ts`. That is what guarantees the refresh
 * request itself can never re-enter (and therefore never re-trigger) the
 * refresh-on-401 flow: there is no code path for it to do so, not merely a
 * flag that happens to prevent it.
 *
 * Single-flight: `inFlightRefresh` is a module-level singleton (this file is
 * one ES module instance for the whole app — no DI/Context needed, per
 * DG-02). The first caller to see `inFlightRefresh === null` starts the real
 * network call; every other concurrent caller — however many protected
 * requests hit 401 at the same moment — receives the exact same Promise
 * instance and simply awaits it. That shared Promise *is* the "queue": no
 * separate array/list of waiters is needed, since resolving one Promise
 * wakes every `await`er at once. Guarantees "chỉ đúng 1 refresh HTTP request
 * được gửi" from the frozen Decision Gate.
 */
export function refreshAccessToken(): Promise<string> {
	if (inFlightRefresh) {
		return inFlightRefresh;
	}

	inFlightRefresh = performRefresh().finally(() => {
		inFlightRefresh = null;
	});

	return inFlightRefresh;
}

let inFlightRefresh: Promise<string> | null = null;

async function performRefresh(): Promise<string> {
	const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
	if (!refreshToken) {
		throw new Error("No refresh token available");
	}

	// Raw fetch, not httpClient.post() -- see the module doc comment above.
	// No console logging anywhere in this function (Security Constraint #5):
	// neither the request body (contains refreshToken) nor the response body
	// (contains both tokens) may ever be logged.
	const response = await fetch(`${BASE_URL}${API_ENDPOINTS.AUTH.REFRESH}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ refreshToken }),
	});

	if (!response.ok) {
		// DG-01: the backend already collapses every failure reason (not
		// found/expired/revoked/reused/inactive-account) into one message;
		// this layer does not need to -- and must not -- try to distinguish
		// them further (Security Constraint #6: no backend-specific reason
		// surfaces past this point).
		throw new Error(`Refresh failed with status ${response.status}`);
	}

	const data = (await response.json()) as RefreshResponse;
	localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
	localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
	return data.accessToken;
}
