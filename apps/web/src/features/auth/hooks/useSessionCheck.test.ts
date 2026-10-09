import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { authService } from "../services/auth.service";
import { useSessionCheck } from "./useSessionCheck";

// vi.spyOn on the shared authService object (not vi.mock) so the stub applies even
// though vitest runs with `isolate: false` and the module may already be cached.

function storeSession(): void {
	localStorage.setItem("accessToken", "access-token");
	localStorage.setItem("refreshToken", "refresh-token");
	localStorage.setItem("authUser", JSON.stringify({ id: "host-1", role: "host" }));
}

describe("useSessionCheck", () => {
	beforeEach(() => {
		localStorage.clear();
		// clearAuthSessionAndRedirect navigates via location.href; keep jsdom quiet.
		vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("skips the check for a visitor without a stored session", () => {
		const validateSession = vi.spyOn(authService, "validateSession");

		const { result } = renderHook(() => useSessionCheck(false));

		expect(result.current).toBe(false);
		expect(validateSession).not.toHaveBeenCalled();
	});

	it("reports checking until the stored session is confirmed valid", async () => {
		storeSession();
		vi.spyOn(authService, "validateSession").mockResolvedValue(undefined);

		const { result } = renderHook(() => useSessionCheck(true));

		expect(result.current).toBe(true);
		await waitFor(() => expect(result.current).toBe(false));
		expect(localStorage.getItem("authUser")).not.toBeNull();
	});

	it.each([401, 403])("clears a session the backend rejects with %i", async (status) => {
		storeSession();
		vi.spyOn(authService, "validateSession").mockRejectedValue(
			new HttpError("Session rejected", status, {})
		);

		const { result } = renderHook(() => useSessionCheck(true));

		await waitFor(() => expect(localStorage.getItem("authUser")).toBeNull());
		expect(localStorage.getItem("accessToken")).toBeNull();
		expect(localStorage.getItem("refreshToken")).toBeNull();
		expect(result.current).toBe(true);
	});

	it("keeps the session when the API is unreachable", async () => {
		storeSession();
		vi.spyOn(authService, "validateSession").mockRejectedValue(new TypeError("Failed to fetch"));

		const { result } = renderHook(() => useSessionCheck(true));

		await waitFor(() => expect(result.current).toBe(false));
		expect(localStorage.getItem("authUser")).not.toBeNull();
	});
});
