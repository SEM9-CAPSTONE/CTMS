import { refreshAccessToken } from "./authRefresh";
import { clearAuthSessionAndRedirect } from "./authSessionSync";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

/**
 * CTMS-04-T02, Security Constraint #6: shown to the user when the refresh
 * attempt itself failed -- never the backend's specific reason (expired vs
 * revoked vs reused are all indistinguishable server-side too, per
 * CTMS-04-T01's DG-01). Matches the wording already used elsewhere in this
 * app for an expired session (see useCamperProfile.ts's mapProfileError).
 */
const SESSION_EXPIRED_MESSAGE = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";

export interface RequestOptions extends Omit<RequestInit, "body"> {
	body?: unknown;
	params?: Record<string, string | number | boolean | undefined>;
}

/**
 * CTMS-04-T02, DG-05: internal-only, never exported. `request()`'s public
 * signature still takes exactly `RequestOptions` -- callers cannot set or
 * observe this flag, it only exists on the recursive call this class makes
 * to itself after a successful refresh, to guarantee at most 1 retry.
 */
interface InternalRequestOptions extends RequestOptions {
	isRetryAfterRefresh?: boolean;
}

/**
 * Thrown instead of a plain Error when the response is not ok, so callers can
 * read the HTTP status and raw parsed body (needed to distinguish 409 vs 422
 * and to read structured field errors) without changing the public request API.
 * Still an Error — existing `.message` usage keeps working unchanged.
 */
export class HttpError extends Error {
	readonly status: number;
	readonly errorData: unknown;

	constructor(message: string, status: number, errorData: unknown) {
		super(message);
		this.name = "HttpError";
		this.status = status;
		this.errorData = errorData;
	}
}

class HttpClient {
	private getAuthToken(): string | null {
		return localStorage.getItem("accessToken");
	}

	private buildUrl(
		endpoint: string,
		params?: Record<string, string | number | boolean | undefined>
	): string {
		const url = new URL(
			endpoint.startsWith("http")
				? endpoint
				: `${BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`
		);
		if (params) {
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined) {
					url.searchParams.append(key, String(value));
				}
			}
		}
		return url.toString();
	}

	async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
		return this.performRequest<T>(endpoint, options);
	}

	/**
	 * CTMS-04-T02. Everything above the `if (!response.ok)` block, and the
	 * non-401 branch inside it, is byte-for-byte the same as before this
	 * story -- request shape, header attachment, error parsing, and the
	 * `HttpError` thrown for every status other than an eligible 401 are
	 * all unchanged.
	 *
	 * DG-06: a 401 only enters the refresh-and-retry path when this specific
	 * request actually carried a token (`token` truthy) -- a public call
	 * (login/register/forgot-password/...) never has one, so its 401s throw
	 * exactly as before, untouched by this story.
	 */
	private async performRequest<T>(endpoint: string, options: InternalRequestOptions): Promise<T> {
		const { body, params, headers, isRetryAfterRefresh, ...customConfig } = options;
		const token = this.getAuthToken();

		const config: RequestInit = {
			method: options.method || "GET",
			headers: {
				"Content-Type": "application/json",
				...(token ? { Authorization: `Bearer ${token}` } : {}),
				...headers,
			},
			...customConfig,
		};

		if (body) {
			config.body = JSON.stringify(body);
		}

		const response = await fetch(this.buildUrl(endpoint, params), config);

		if (!response.ok) {
			if (response.status === 401 && token && !isRetryAfterRefresh) {
				return this.handleUnauthorized<T>(endpoint, options);
			}

			const errorData = await response.json().catch(() => ({}));
			const message =
				typeof errorData.message === "string"
					? errorData.message
					: `Request failed with status ${response.status}`;
			throw new HttpError(message, response.status, errorData);
		}

		return response.json() as Promise<T>;
	}

	/**
	 * CTMS-04-T02, DG-03/DG-05. `refreshAccessToken()` is the single-flight
	 * coordinator (authRefresh.ts) -- every concurrent 401 lands here and
	 * awaits the *same* Promise, so only 1 `POST /auth/refresh` is ever
	 * in flight no matter how many protected requests failed at once. It
	 * calls a raw `fetch`, never `this.request()`/`this.performRequest()`,
	 * so it structurally cannot re-enter this method.
	 *
	 * On success: retries exactly once, with `isRetryAfterRefresh: true` --
	 * `performRequest`'s own guard (`!isRetryAfterRefresh`) means that retry
	 * can never reach this method again, even if it also comes back 401.
	 *
	 * On failure: every request waiting on that shared Promise clears the
	 * session once each (idempotent -- removing already-removed storage
	 * keys and re-writing the cross-tab signal are both harmless) and
	 * rejects with the one shared session-expired message, never the
	 * backend's specific reason (Security Constraint #6).
	 */
	private async handleUnauthorized<T>(
		endpoint: string,
		options: InternalRequestOptions
	): Promise<T> {
		try {
			await refreshAccessToken();
		} catch {
			clearAuthSessionAndRedirect();
			throw new HttpError(SESSION_EXPIRED_MESSAGE, 401, {});
		}

		return this.performRequest<T>(endpoint, { ...options, isRetryAfterRefresh: true });
	}

	get<T>(
		endpoint: string,
		params?: Record<string, string | number | boolean | undefined>,
		options?: RequestOptions
	): Promise<T> {
		return this.request<T>(endpoint, { ...options, method: "GET", params });
	}

	post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
		return this.request<T>(endpoint, { ...options, method: "POST", body });
	}

	put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
		return this.request<T>(endpoint, { ...options, method: "PUT", body });
	}

	patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
		return this.request<T>(endpoint, { ...options, method: "PATCH", body });
	}

	delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
		return this.request<T>(endpoint, { ...options, method: "DELETE" });
	}
}

export const httpClient = new HttpClient();
