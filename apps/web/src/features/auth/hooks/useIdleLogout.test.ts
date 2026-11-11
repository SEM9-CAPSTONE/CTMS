import { fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LAST_ACTIVITY_KEY, clearAuthSessionAndRedirect } from "../../../core/api/authSessionSync";
import { ACTIVITY_WRITE_THROTTLE_MS, IDLE_TIMEOUT_MS } from "../constants";
import { useIdleLogout } from "./useIdleLogout";

const MINUTE_MS = 60 * 1000;

describe("useIdleLogout", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-09T08:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("logs out after 30 minutes without any activity", () => {
		const onIdle = vi.fn();
		renderHook(() => useIdleLogout(true, onIdle));

		vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1);
		expect(onIdle).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(onIdle).toHaveBeenCalledTimes(1);
	});

	it("restarts the 30-minute countdown whenever the user interacts", () => {
		const onIdle = vi.fn();
		renderHook(() => useIdleLogout(true, onIdle));

		vi.advanceTimersByTime(20 * MINUTE_MS);
		fireEvent.keyDown(window);
		vi.advanceTimersByTime(20 * MINUTE_MS);
		expect(onIdle).not.toHaveBeenCalled();

		vi.advanceTimersByTime(10 * MINUTE_MS);
		expect(onIdle).toHaveBeenCalledTimes(1);
	});

	it("stays signed in while the user is active in another tab", () => {
		const onIdle = vi.fn();
		renderHook(() => useIdleLogout(true, onIdle));

		vi.advanceTimersByTime(25 * MINUTE_MS);
		localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
		vi.advanceTimersByTime(25 * MINUTE_MS);

		expect(onIdle).not.toHaveBeenCalled();
	});

	it("logs out immediately when the last activity is already older than 30 minutes", () => {
		localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now() - IDLE_TIMEOUT_MS - MINUTE_MS));
		const onIdle = vi.fn();

		renderHook(() => useIdleLogout(true, onIdle));

		expect(onIdle).toHaveBeenCalledTimes(1);
	});

	it("does not revive a session whose deadline passed while the device slept", () => {
		const onIdle = vi.fn();
		renderHook(() => useIdleLogout(true, onIdle));

		// Clock jumps forward without timers firing, as when a laptop wakes up.
		vi.setSystemTime(Date.now() + IDLE_TIMEOUT_MS + ACTIVITY_WRITE_THROTTLE_MS);
		fireEvent.mouseMove(window);

		expect(onIdle).toHaveBeenCalledTimes(1);
	});

	it("does nothing for a signed-out visitor", () => {
		const onIdle = vi.fn();
		renderHook(() => useIdleLogout(false, onIdle));

		vi.advanceTimersByTime(2 * IDLE_TIMEOUT_MS);

		expect(onIdle).not.toHaveBeenCalled();
		expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBeNull();
	});

	it("forgets the last activity when the session is cleared", () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));

		clearAuthSessionAndRedirect();

		expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBeNull();
	});
});
