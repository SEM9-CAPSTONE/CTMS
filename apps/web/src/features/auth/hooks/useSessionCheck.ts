import { useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { clearAuthSessionAndRedirect } from "../../../core/api/authSessionSync";
import { authService } from "../services/auth.service";

// 401: no usable token / refresh failed. 403: account no longer active (BR-171).
const SESSION_REJECTED_STATUSES: ReadonlySet<number> = new Set([401, 403]);

/**
 * Validates a stored session once per app load, before any role-based redirect.
 * Returns true while the check is in flight. A rejected session is cleared and the
 * user is sent to login; network/server errors keep the session (fail open) so an
 * API outage does not log everyone out — protected requests still enforce auth.
 */
export function useSessionCheck(hasStoredSession: boolean): boolean {
	const shouldCheckRef = useRef(hasStoredSession);
	const [isChecking, setIsChecking] = useState(hasStoredSession);

	useEffect(() => {
		if (!shouldCheckRef.current) {
			return;
		}
		let isActive = true;

		authService
			.validateSession()
			.then(() => {
				if (isActive) {
					setIsChecking(false);
				}
			})
			.catch((error: unknown) => {
				const isSessionRejected =
					error instanceof HttpError && SESSION_REJECTED_STATUSES.has(error.status);
				if (isSessionRejected) {
					clearAuthSessionAndRedirect();
					return;
				}
				if (isActive) {
					setIsChecking(false);
				}
			});

		return () => {
			isActive = false;
		};
	}, []);

	return isChecking;
}
