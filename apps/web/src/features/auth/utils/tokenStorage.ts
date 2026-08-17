/**
 * Minimal read/write wrapper around localStorage for the 2 tokens issued by
 * POST /auth/login. Deliberately scoped to persistence only (CTMS-03-T02
 * Decision Gate: localStorage, matches httpClient.ts's existing
 * `localStorage.getItem("accessToken")` read) — no JWT decoding, no
 * expiration checks, no navigation side effects belong here.
 */

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const AUTH_USER_KEY = "authUser";

export interface StoredAuthUser {
	id: string;
	email: string | null;
	phone: string | null;
	role: string;
	roles?: string[];
	status: string;
	createdAt: string;
}

export function setAccessToken(token: string): void {
	localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getAccessToken(): string | null {
	return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function removeAccessToken(): void {
	localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
	localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
	return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function removeRefreshToken(): void {
	localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function setStoredAuthUser(user: StoredAuthUser): void {
	localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function getStoredAuthUser(): StoredAuthUser | null {
	const raw = localStorage.getItem(AUTH_USER_KEY);
	if (!raw) {
		return null;
	}

	try {
		return JSON.parse(raw) as StoredAuthUser;
	} catch {
		removeStoredAuthUser();
		return null;
	}
}

export function removeStoredAuthUser(): void {
	localStorage.removeItem(AUTH_USER_KEY);
}
