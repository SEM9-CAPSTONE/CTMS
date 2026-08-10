import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshAccessToken } from "./authRefresh";
import { httpClient } from "./httpClient";

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

function okResponse(body: { accessToken: string; refreshToken: string }) {
	return { ok: true, status: 200, json: () => Promise.resolve(body) } as Response;
}

function failedResponse(status: number) {
	return { ok: false, status, json: () => Promise.resolve({}) } as Response;
}

describe("authRefresh.refreshAccessToken", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		localStorage.clear();
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	// --- Request shape -----------------------------------------------------

	it("calls POST /auth/refresh with { refreshToken } read from storage", async () => {
		localStorage.setItem(REFRESH_TOKEN_KEY, "old-refresh-token");
		fetchMock.mockResolvedValueOnce(okResponse({ accessToken: "a", refreshToken: "r" }));

		await refreshAccessToken();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toContain("/auth/refresh");
		expect(init.method).toBe("POST");
		expect(JSON.parse(init.body as string)).toEqual({ refreshToken: "old-refresh-token" });
	});

	// --- Success: persist + return the new pair ------------------------------

	it("stores the new access and refresh tokens on success", async () => {
		localStorage.setItem(REFRESH_TOKEN_KEY, "old-refresh-token");
		fetchMock.mockResolvedValueOnce(
			okResponse({ accessToken: "new-access", refreshToken: "new-refresh" })
		);

		await refreshAccessToken();

		expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe("new-access");
		expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("new-refresh");
	});

	it("resolves with the new access token", async () => {
		localStorage.setItem(REFRESH_TOKEN_KEY, "old-refresh-token");
		fetchMock.mockResolvedValueOnce(
			okResponse({ accessToken: "new-access", refreshToken: "new-refresh" })
		);

		await expect(refreshAccessToken()).resolves.toBe("new-access");
	});

	// --- Single-flight -------------------------------------------------------

	it("collapses concurrent callers into exactly one POST /auth/refresh", async () => {
		localStorage.setItem(REFRESH_TOKEN_KEY, "old-refresh-token");
		let resolveFetch!: (value: Response) => void;
		fetchMock.mockReturnValueOnce(
			new Promise<Response>((resolve) => {
				resolveFetch = resolve;
			})
		);

		const call1 = refreshAccessToken();
		const call2 = refreshAccessToken();
		const call3 = refreshAccessToken();

		// All 3 callers arrived before the network call settled -- only the
		// first should have actually invoked fetch.
		expect(fetchMock).toHaveBeenCalledTimes(1);

		resolveFetch(okResponse({ accessToken: "new-access", refreshToken: "new-refresh" }));

		const results = await Promise.all([call1, call2, call3]);

		expect(results).toEqual(["new-access", "new-access", "new-access"]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	// --- Failure paths ---------------------------------------------------------

	it("rejects when the refresh call itself returns a non-ok response", async () => {
		localStorage.setItem(REFRESH_TOKEN_KEY, "old-refresh-token");
		fetchMock.mockResolvedValueOnce(failedResponse(401));

		await expect(refreshAccessToken()).rejects.toThrow();
	});

	it("rejects without calling fetch when there is no refresh token in storage", async () => {
		await expect(refreshAccessToken()).rejects.toThrow();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	// --- Single-flight state reset (both branches) ----------------------------

	it("resets the single-flight state after success, so a later refresh runs for real", async () => {
		localStorage.setItem(REFRESH_TOKEN_KEY, "old-refresh-token");
		fetchMock.mockResolvedValueOnce(
			okResponse({ accessToken: "access-1", refreshToken: "refresh-1" })
		);
		await refreshAccessToken();

		fetchMock.mockResolvedValueOnce(
			okResponse({ accessToken: "access-2", refreshToken: "refresh-2" })
		);
		const second = await refreshAccessToken();

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(second).toBe("access-2");
	});

	it("resets the single-flight state after failure, so a later refresh is not stuck rejecting forever", async () => {
		localStorage.setItem(REFRESH_TOKEN_KEY, "old-refresh-token");
		fetchMock.mockResolvedValueOnce(failedResponse(401));
		await expect(refreshAccessToken()).rejects.toThrow();

		fetchMock.mockResolvedValueOnce(
			okResponse({ accessToken: "access-retry", refreshToken: "refresh-retry" })
		);
		const result = await refreshAccessToken();

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(result).toBe("access-retry");
	});

	// --- Security: no token leakage into logs -----------------------------------

	it("never logs the refresh token, the access token, or the response body", async () => {
		const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		localStorage.setItem(REFRESH_TOKEN_KEY, "super-secret-refresh-token");
		fetchMock.mockResolvedValueOnce(
			okResponse({
				accessToken: "super-secret-access-token",
				refreshToken: "brand-new-refresh-token",
			})
		);

		await refreshAccessToken();

		for (const call of [...consoleLogSpy.mock.calls, ...consoleErrorSpy.mock.calls]) {
			const serialized = JSON.stringify(call);
			expect(serialized).not.toContain("super-secret-refresh-token");
			expect(serialized).not.toContain("super-secret-access-token");
			expect(serialized).not.toContain("brand-new-refresh-token");
		}
	});

	// --- Isolation from httpClient -----------------------------------------------

	it("never goes through httpClient (bypasses the interceptor entirely)", async () => {
		const requestSpy = vi.spyOn(httpClient, "request");
		localStorage.setItem(REFRESH_TOKEN_KEY, "old-refresh-token");
		fetchMock.mockResolvedValueOnce(okResponse({ accessToken: "a", refreshToken: "r" }));

		await refreshAccessToken();

		expect(requestSpy).not.toHaveBeenCalled();
	});
});
