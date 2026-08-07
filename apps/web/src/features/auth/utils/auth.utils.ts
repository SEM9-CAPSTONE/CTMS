import { HttpError } from "../../../core/api";

export function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidPhoneNumber(phone: string): boolean {
	return /^(0[3|5|7|8|9])+([0-9]{8})$/.test(phone.trim());
}

export function formatAuthIdentifier(input: string): string {
	return input.trim().toLowerCase();
}

/** Data prepared from a failed submit, for a page to render as an error summary. */
export interface ApiSubmitError {
	status?: number;
	message: string;
	fieldErrors?: Array<{ field: string; errors: string[] }>;
}

/**
 * Shared HttpError -> ApiSubmitError mapping, used by both the register and
 * verify/resend OTP flows (previously duplicated as `toRegisterSubmitError`
 * inside useRegisterForm.ts before the verify-OTP flow needed the same logic).
 */
export function toApiSubmitError(error: unknown, fallbackMessage: string): ApiSubmitError {
	if (error instanceof HttpError) {
		const body = error.errorData as { message?: unknown } | undefined;
		const fieldErrors = Array.isArray(body?.message)
			? (body.message as Array<{ field: string; errors: string[] }>)
			: undefined;
		return { status: error.status, message: error.message, fieldErrors };
	}
	if (error instanceof Error) {
		return { message: error.message };
	}
	return { message: fallbackMessage };
}
