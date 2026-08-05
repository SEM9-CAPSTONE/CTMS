const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

export interface RequestOptions extends Omit<RequestInit, "body"> {
	body?: unknown;
	params?: Record<string, string | number | boolean | undefined>;
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
		const { body, params, headers, ...customConfig } = options;
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
			const errorData = await response.json().catch(() => ({}));
			const message =
				typeof errorData.message === "string"
					? errorData.message
					: `Request failed with status ${response.status}`;
			throw new HttpError(message, response.status, errorData);
		}

		return response.json() as Promise<T>;
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
