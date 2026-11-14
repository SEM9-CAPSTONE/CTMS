import { HttpError } from "../../../core/api";
import { DEVICE_SYNC_ERRORS } from "../constants";

/** Keep upstream messages and internal details out of user-facing sync errors. */
export function deviceSyncErrorMessage(error: unknown): string {
	if (!(error instanceof HttpError)) return DEVICE_SYNC_ERRORS.CONNECTION_FAILED;
	switch (error.status) {
		case 401:
			return DEVICE_SYNC_ERRORS.UNAUTHORIZED;
		case 403:
			return DEVICE_SYNC_ERRORS.FORBIDDEN;
		case 404:
			return DEVICE_SYNC_ERRORS.NOT_FOUND;
		default:
			return error.status >= 500
				? DEVICE_SYNC_ERRORS.SERVER_UNAVAILABLE
				: DEVICE_SYNC_ERRORS.REQUEST_FAILED;
	}
}
