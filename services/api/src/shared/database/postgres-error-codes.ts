import { QueryFailedError } from "typeorm";

export const POSTGRES_ERROR_CODES = {
	UNIQUE_VIOLATION: "23505",
} as const;

export function isUniqueViolation(error: unknown): boolean {
	if (!(error instanceof QueryFailedError)) {
		return false;
	}

	const driverError = error.driverError as { code?: string } | undefined;
	return driverError?.code === POSTGRES_ERROR_CODES.UNIQUE_VIOLATION;
}
