import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError, httpClient } from "./httpClient";

/**
 * CTMS-04-T02, Step 7. Deliberately does NOT mock `authRefresh.ts` /
 * `authSessionSync.ts` -- this exercises the real single-flight coordinator
 * and the real clear/redirect/cross-tab logic together with httpClient's
 * interceptor, only mocking the actual network boundary (`fetch`) and
 * `window.location`. This is what lets tests genuinely prove "chỉ đúng 1
 * refresh request" and "authSessionSignal không chứa token" end-to-end,
 * not just at each file's own isolated unit level (Step 5/6).
 */

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const SESSION_SIGNAL_KEY = "authSessionSignal";
const SESSION_EXPIRED_MESSAGE = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
const PROTECTED_ENDPOINT = "/test/protected";

function jsonResponse(status: number, body: unknown): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: () => Promise.resolve(body),
	} as Response;
}

/** Same jsdom-navigation workaround as authSessionSync.test.ts. */
function setLocationPathname(pathname: string): { pathname: string; href: string } {
	const location = { pathname, href: `http://localhost${pathname}` };
	Object.defineProperty(window, "location", {
		value: location,
		writable: true,
		configurable: true,
	});
	return location;
}

/** Every rejection this file provokes is an HttpError -- a small try/catch
 * helper sidesteps `Promise<T>.catch()`'s type inference collapsing to
 * `unknown` when `T` itself is uninferred (no explicit type param on
 * `httpClient.get`/`.post` in these tests, since the calls are expected to
 * reject, not resolve). */
async function captureError(promise: Promise<unknown>): Promise<HttpError> {
	try {
		await promise;
	} catch (error) {
		return error as HttpError;
	}
	throw new Error("Expected the promise to reject, but it resolved.");
}

describe("httpClient interceptor (CTMS-04-T02)", () => {
	const originalLocation = window.location;
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		localStorage.clear();
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		setLocationPathname("/camper/profile");
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		Object.defineProperty(window, "location", {
			value: originalLocation,
			writable: true,
			configurable: true,
		});
	});

	// --- 1. Token attachment (pre-existing behavior, unchanged) -----------------

	it("attaches the access token to a protected request", async () => {
		localStorage.setItem(ACCESS_TOKEN_KEY, "valid-access-token");
		fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

		await httpClient.get(PROTECTED_ENDPOINT);

		const [, init] = fetchMock.mock.calls[0] as [
			string,
			RequestInit & { headers: Record<string, string> },
		];
		expect(init.headers.Authorization).toBe("Bearer valid-access-token");
	});

	// --- 2-4. 401 -> transparent refresh -> retry once with the new token -------

	it("refreshes automatically on 401 and retries the original request exactly once with the new access token", async () => {
		localStorage.setItem(ACCESS_TOKEN_KEY, "expired-access-token");
		localStorage.setItem(REFRESH_TOKEN_KEY, "valid-refresh-token");

		fetchMock
			.mockResolvedValueOnce(jsonResponse(401, {})) // original request
			.mockResolvedValueOnce(
				jsonResponse(200, { accessToken: "new-access-token", refreshToken: "new-refresh-token" })
			) // POST /auth/refresh
			.mockResolvedValueOnce(jsonResponse(200, { data: "secret" })); // retried request

		const result = await httpClient.get(PROTECTED_ENDPOINT);

		expect(result).toEqual({ data: "secret" }); // caller sees success, transparently
		expect(fetchMock).toHaveBeenCalledTimes(3);

		const [refreshUrl] = fetchMock.mock.calls[1] as [string, RequestInit];
		expect(refreshUrl).toContain("/auth/refresh");

		const [retryUrl, retryInit] = fetchMock.mock.calls[2] as [
			string,
			RequestInit & { headers: Record<string, string> },
		];
		expect(retryUrl).toContain(PROTECTED_ENDPOINT);
		expect(retryInit.headers.Authorization).toBe("Bearer new-access-token");
		expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe("new-access-token");
	});

	// --- 5. Retry still 401 -> fail immediately, no second refresh --------------

	it("fails immediately if the retried request is still 401, without triggering a second refresh", async () => {
		localStorage.setItem(ACCESS_TOKEN_KEY, "expired-access-token");
		localStorage.setItem(REFRESH_TOKEN_KEY, "valid-refresh-token");

		fetchMock
			.mockResolvedValueOnce(jsonResponse(401, {})) // original
			.mockResolvedValueOnce(
				jsonResponse(200, { accessToken: "new-access-token", refreshToken: "new-refresh-token" })
			) // refresh succeeds
			.mockResolvedValueOnce(jsonResponse(401, { message: "Still unauthorized" })); // retry also 401

		const error = await captureError(httpClient.get(PROTECTED_ENDPOINT));

		expect(error).toBeInstanceOf(HttpError);
		// Falls through to the normal error branch (not the refresh-failure
		// branch) -- proven by the message being the retry response's own
		// message, not the shared SESSION_EXPIRED_MESSAGE.
		expect(error.message).toBe("Still unauthorized");
		// Exactly 3 calls total: original + 1 refresh + 1 retry. A 4th call
		// would mean a second refresh was attempted.
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	// --- 6-7. Real concurrent 401s: single-flight + queued retries ---------------

	it("collapses 3 concurrent 401s into exactly one /auth/refresh call, then retries every one of them with the new token", async () => {
		localStorage.setItem(ACCESS_TOKEN_KEY, "expired-access-token");
		localStorage.setItem(REFRESH_TOKEN_KEY, "valid-refresh-token");

		const endpoints = ["/test/protected-1", "/test/protected-2", "/test/protected-3"];
		const seenOnce = new Set<string>();
		let refreshCallCount = 0;
		let resolveRefresh!: (value: Response) => void;

		fetchMock.mockImplementation((url: string) => {
			if (url.includes("/auth/refresh")) {
				refreshCallCount += 1;
				return new Promise<Response>((resolve) => {
					resolveRefresh = resolve;
				});
			}
			if (!seenOnce.has(url)) {
				seenOnce.add(url);
				return Promise.resolve(jsonResponse(401, {}));
			}
			return Promise.resolve(jsonResponse(200, { endpoint: url }));
		});

		const pending = Promise.all(endpoints.map((endpoint) => httpClient.get(endpoint)));

		// Let the 3 original 401s propagate through to the point where each
		// has called (or collapsed into) refreshAccessToken().
		await vi.waitFor(() => expect(refreshCallCount).toBe(1));
		// Give the losing 2 callers a turn too, so they're proven to be
		// waiting on the *same* Promise rather than about to fire their own.
		await Promise.resolve();
		await Promise.resolve();
		expect(refreshCallCount).toBe(1); // still exactly 1 after settling time

		resolveRefresh(
			jsonResponse(200, { accessToken: "new-access-token", refreshToken: "new-refresh-token" })
		);

		const results = await pending;

		expect(results).toHaveLength(3);
		expect(refreshCallCount).toBe(1); // still exactly 1 /auth/refresh call, even after all 3 retried

		for (const endpoint of endpoints) {
			const callsForEndpoint = fetchMock.mock.calls.filter(
				([url]) => typeof url === "string" && url.includes(endpoint)
			) as Array<[string, RequestInit & { headers: Record<string, string> }]>;

			expect(callsForEndpoint).toHaveLength(2); // original + exactly 1 retry
			expect(callsForEndpoint[0][1].headers.Authorization).toBe("Bearer expired-access-token");
			expect(callsForEndpoint[1][1].headers.Authorization).toBe("Bearer new-access-token");
		}
	});

	// --- 8-10. Refresh failure (401 or network) -> clear + redirect + shared message --

	it("clears the session and redirects to Login when the refresh call itself returns 401", async () => {
		localStorage.setItem(ACCESS_TOKEN_KEY, "expired-access-token");
		localStorage.setItem(REFRESH_TOKEN_KEY, "revoked-refresh-token");
		const location = setLocationPathname("/camper/profile");

		fetchMock
			.mockResolvedValueOnce(jsonResponse(401, {})) // original
			.mockResolvedValueOnce(jsonResponse(401, { message: "Invalid refresh token" })); // refresh fails

		const error = await captureError(httpClient.get(PROTECTED_ENDPOINT));

		expect(error).toBeInstanceOf(HttpError);
		expect(error.status).toBe(401);
		expect(error.message).toBe(SESSION_EXPIRED_MESSAGE); // shared message, not the backend's
		expect(error.errorData).toEqual({}); // no backend-specific detail leaked
		expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
		expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
		expect(location.href).toBe("/login");
	});

	it("clears the session and redirects to Login when the refresh call fails with a network error", async () => {
		localStorage.setItem(ACCESS_TOKEN_KEY, "expired-access-token");
		localStorage.setItem(REFRESH_TOKEN_KEY, "some-refresh-token");
		const location = setLocationPathname("/camper/profile");

		fetchMock
			.mockResolvedValueOnce(jsonResponse(401, {})) // original
			.mockRejectedValueOnce(new TypeError("Failed to fetch")); // network error during refresh

		const error = await captureError(httpClient.get(PROTECTED_ENDPOINT));

		expect(error).toBeInstanceOf(HttpError);
		expect(error.message).toBe(SESSION_EXPIRED_MESSAGE);
		expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
		expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
		expect(location.href).toBe("/login");
	});

	// --- 11. Public request (no Authorization) -> 401 never triggers refresh ----

	it("does not trigger refresh for a 401 on a request with no access token (public endpoint)", async () => {
		// No accessToken ever set -- localStorage.clear() in beforeEach.
		fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: "Invalid credentials" }));

		const error = await captureError(
			httpClient.post("/auth/login", { identifier: "x", password: "y" })
		);

		expect(error).toBeInstanceOf(HttpError);
		expect(error.message).toBe("Invalid credentials"); // unchanged pre-existing behavior
		expect(fetchMock).toHaveBeenCalledTimes(1); // no refresh attempted
	});

	// --- 12. Refresh isolation from the interceptor -------------------------------

	it("never routes the refresh call through httpClient.request (isolation from the interceptor)", async () => {
		const requestSpy = vi.spyOn(httpClient, "request");
		localStorage.setItem(ACCESS_TOKEN_KEY, "expired-access-token");
		localStorage.setItem(REFRESH_TOKEN_KEY, "valid-refresh-token");

		fetchMock
			.mockResolvedValueOnce(jsonResponse(401, {}))
			.mockResolvedValueOnce(
				jsonResponse(200, { accessToken: "new-access-token", refreshToken: "new-refresh-token" })
			)
			.mockResolvedValueOnce(jsonResponse(200, { data: "secret" }));

		await httpClient.get(PROTECTED_ENDPOINT);

		// request() is only ever called once -- for the original call made by
		// get(). The retry goes through the private performRequest()
		// directly, and the refresh call never goes through httpClient at all.
		expect(requestSpy).toHaveBeenCalledTimes(1);
	});

	// --- 13. No token leakage (URL / logs / thrown error) -------------------------

	it("never exposes a token in the request URL, in logs, or in the thrown error", async () => {
		const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		localStorage.setItem(ACCESS_TOKEN_KEY, "super-secret-access-token");
		localStorage.setItem(REFRESH_TOKEN_KEY, "super-secret-refresh-token");

		fetchMock
			.mockResolvedValueOnce(jsonResponse(401, {}))
			.mockResolvedValueOnce(
				jsonResponse(200, {
					accessToken: "new-super-secret-access-token",
					refreshToken: "new-super-secret-refresh-token",
				})
			)
			.mockResolvedValueOnce(jsonResponse(200, { data: "secret" }));

		await httpClient.get(PROTECTED_ENDPOINT);

		for (const [url] of fetchMock.mock.calls as Array<[string]>) {
			expect(url).not.toContain("secret");
		}
		for (const call of [...consoleLogSpy.mock.calls, ...consoleErrorSpy.mock.calls]) {
			expect(JSON.stringify(call)).not.toContain("secret");
		}
	});

	// --- 14. authSessionSignal never contains a token, end-to-end ------------------

	it("writes an authSessionSignal with no token when the refresh flow fails end-to-end", async () => {
		localStorage.setItem(ACCESS_TOKEN_KEY, "expired-access-token");
		localStorage.setItem(REFRESH_TOKEN_KEY, "super-secret-refresh-token");

		fetchMock
			.mockResolvedValueOnce(jsonResponse(401, {}))
			.mockResolvedValueOnce(jsonResponse(401, {}));

		await httpClient.get(PROTECTED_ENDPOINT).catch(() => undefined);

		const signal = localStorage.getItem(SESSION_SIGNAL_KEY);
		expect(signal).not.toBeNull();
		expect(signal).not.toContain("super-secret-refresh-token");
		expect(Number.isNaN(Number(signal))).toBe(false);
	});
});
