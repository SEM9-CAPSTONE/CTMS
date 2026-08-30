import { refreshAccessToken } from "./authRefresh";
import { clearAuthSessionAndRedirect } from "./authSessionSync";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";
const SESSION_EXPIRED_MESSAGE = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";

export interface RequestOptions extends Omit<RequestInit, "body"> {
	body?: unknown;
	params?: Record<string, string | number | boolean | undefined>;
}
interface InternalRequestOptions extends RequestOptions {
	isRetryAfterRefresh?: boolean;
}
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

	private async performRequest<T>(endpoint: string, options: InternalRequestOptions): Promise<T> {
		const { body, params, headers, isRetryAfterRefresh, ...customConfig } = options;
		const token = this.getAuthToken();
		const isFormDataBody = typeof FormData !== "undefined" && body instanceof FormData;

		const config: RequestInit = {
			method: options.method || "GET",
			headers: {
				...(isFormDataBody ? {} : { "Content-Type": "application/json" }),
				...(token ? { Authorization: `Bearer ${token}` } : {}),
				...headers,
			},
			...customConfig,
		};

		if (body) {
			config.body = isFormDataBody ? body : JSON.stringify(body);
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

		// A 204, or any 2xx sent with no body at all (e.g. a NestJS controller
		// returning `null`), has nothing for `.json()` to parse -- it throws
		// "Unexpected end of JSON input" on a genuinely empty string, not a
		// caught HttpError. Verified against a real endpoint
		// (GET .../weather/latest with no snapshot yet sends
		// Content-Length: 0), not assumed from a client-side testing
		// convenience.
		if (response.status === 204 || response.headers.get("content-length") === "0") {
			return undefined as T;
		}

		return response.json() as Promise<T>;
	}

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

		return this.performRequest<T>(endpoint, {
			...options,
			isRetryAfterRefresh: true,
		});
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
