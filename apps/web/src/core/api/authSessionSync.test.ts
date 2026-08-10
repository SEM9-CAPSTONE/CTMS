import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAuthSessionAndRedirect, initAuthSessionSync } from "./authSessionSync";

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const SESSION_SIGNAL_KEY = "authSessionSignal";

/**
 * jsdom's real `window.location` throws "Not implemented: navigation" when
 * `.href` is assigned. Replaced with a plain mutable object so
 * `redirectToLogin()`'s `window.location.href = "/login"` can be observed
 * directly instead of hitting that jsdom limitation.
 */
function setLocationPathname(pathname: string): { pathname: string; href: string } {
	const location = { pathname, href: `http://localhost${pathname}` };
	Object.defineProperty(window, "location", {
		value: location,
		writable: true,
		configurable: true,
	});
	return location;
}

/**
 * Captures the real handler `initAuthSessionSync()` registers, via a spy on
 * `window.addEventListener`, then invokes it directly instead of dispatching
 * a real `storage` event on `window`. This tests the exact function the
 * module registers (not a reimplementation), while avoiding the
 * side effect of accumulating one extra real global listener per test (each
 * test in this file calls `initAuthSessionSync()` again, and the module has
 * no unregister -- deliberately, per DG-04/DG-02).
 */
function captureStorageHandler(): (event: StorageEvent) => void {
	const addEventListenerSpy = vi.spyOn(window, "addEventListener");
	initAuthSessionSync();
	const call = addEventListenerSpy.mock.calls.find(([type]) => type === "storage");
	addEventListenerSpy.mockRestore();
	if (!call) {
		throw new Error("initAuthSessionSync() did not register a 'storage' listener");
	}
	return call[1] as (event: StorageEvent) => void;
}

describe("authSessionSync", () => {
	const originalLocation = window.location;

	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		Object.defineProperty(window, "location", {
			value: originalLocation,
			writable: true,
			configurable: true,
		});
	});

	describe("clearAuthSessionAndRedirect", () => {
		it("removes both accessToken and refreshToken from localStorage", () => {
			setLocationPathname("/camper/profile");
			localStorage.setItem(ACCESS_TOKEN_KEY, "some-access-token");
			localStorage.setItem(REFRESH_TOKEN_KEY, "some-refresh-token");

			clearAuthSessionAndRedirect();

			expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
			expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
		});

		it("writes a signal value that is a plain timestamp, never a token", () => {
			setLocationPathname("/camper/profile");
			localStorage.setItem(ACCESS_TOKEN_KEY, "super-secret-access-token");
			localStorage.setItem(REFRESH_TOKEN_KEY, "super-secret-refresh-token");

			clearAuthSessionAndRedirect();

			const signal = localStorage.getItem(SESSION_SIGNAL_KEY);
			expect(signal).not.toBeNull();
			expect(signal).not.toContain("super-secret-access-token");
			expect(signal).not.toContain("super-secret-refresh-token");
			expect(Number.isNaN(Number(signal))).toBe(false);
		});

		it("redirects to /login", () => {
			const location = setLocationPathname("/camper/profile");

			clearAuthSessionAndRedirect();

			expect(location.href).toBe("/login");
		});

		it("does not rewrite location.href when already on /login", () => {
			const location = setLocationPathname("/login");
			const originalHref = location.href;

			clearAuthSessionAndRedirect();

			expect(location.href).toBe(originalHref);
		});

		it("never logs a token", () => {
			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
			setLocationPathname("/camper/profile");
			localStorage.setItem(ACCESS_TOKEN_KEY, "super-secret-access-token");
			localStorage.setItem(REFRESH_TOKEN_KEY, "super-secret-refresh-token");

			clearAuthSessionAndRedirect();

			for (const call of [...consoleLogSpy.mock.calls, ...consoleErrorSpy.mock.calls]) {
				const serialized = JSON.stringify(call);
				expect(serialized).not.toContain("super-secret-access-token");
				expect(serialized).not.toContain("super-secret-refresh-token");
			}
		});
	});

	describe("initAuthSessionSync", () => {
		it("redirects to /login when a storage event fires for the session signal key", () => {
			const location = setLocationPathname("/camper/profile");
			const handler = captureStorageHandler();

			handler({ key: SESSION_SIGNAL_KEY } as StorageEvent);

			expect(location.href).toBe("/login");
		});

		it("ignores storage events for unrelated keys", () => {
			const location = setLocationPathname("/camper/profile");
			const handler = captureStorageHandler();

			handler({ key: ACCESS_TOKEN_KEY } as StorageEvent);

			expect(location.href).toBe("http://localhost/camper/profile");
		});

		it("never writes to localStorage when handling a signal (cross-tab loop prevention)", () => {
			setLocationPathname("/camper/profile");
			const handler = captureStorageHandler();
			const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

			handler({ key: SESSION_SIGNAL_KEY } as StorageEvent);

			expect(setItemSpy).not.toHaveBeenCalled();
			setItemSpy.mockRestore();
		});
	});
});
