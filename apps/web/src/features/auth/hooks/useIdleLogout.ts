import { useEffect, useRef } from "react";
import { ACTIVITY_WRITE_THROTTLE_MS, USER_ACTIVITY_EVENTS } from "../constants";
import { getIdleRemainingMs, getLastActivityAt, markUserActivity } from "../utils/idleActivity";

/**
 * Calls `onIdle` once the signed-in user has not interacted with any CTMS tab for
 * IDLE_TIMEOUT_MS. The last-activity time lives in localStorage, so activity in one
 * tab keeps the others alive. The deadline is re-checked when the tab becomes visible
 * because browsers pause timers while a device sleeps; activity after the deadline
 * has passed does not revive the session.
 */
export function useIdleLogout(isEnabled: boolean, onIdle: () => void): void {
	const onIdleRef = useRef(onIdle);

	useEffect(() => {
		onIdleRef.current = onIdle;
	}, [onIdle]);

	useEffect(() => {
		if (!isEnabled) {
			return;
		}

		let timerId: number | undefined;
		let lastWriteAt = 0;
		let hasTimedOut = false;

		const checkIdle = () => {
			window.clearTimeout(timerId);
			const remainingMs = getIdleRemainingMs();
			if (remainingMs > 0) {
				timerId = window.setTimeout(checkIdle, remainingMs);
				return;
			}
			if (!hasTimedOut) {
				hasTimedOut = true;
				onIdleRef.current();
			}
		};

		const handleActivity = () => {
			const now = Date.now();
			if (now - lastWriteAt < ACTIVITY_WRITE_THROTTLE_MS) {
				return;
			}
			if (getIdleRemainingMs(now) <= 0) {
				checkIdle();
				return;
			}
			lastWriteAt = now;
			markUserActivity(now);
			checkIdle();
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				checkIdle();
			}
		};

		if (getLastActivityAt() === null) {
			markUserActivity();
		}
		for (const eventName of USER_ACTIVITY_EVENTS) {
			window.addEventListener(eventName, handleActivity, { passive: true });
		}
		document.addEventListener("visibilitychange", handleVisibilityChange);
		checkIdle();

		return () => {
			window.clearTimeout(timerId);
			for (const eventName of USER_ACTIVITY_EVENTS) {
				window.removeEventListener(eventName, handleActivity);
			}
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [isEnabled]);
}
