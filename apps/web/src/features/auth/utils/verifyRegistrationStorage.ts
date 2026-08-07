/**
 * sessionStorage bridge between RegisterPage and VerifyOtpPage (CTMS-02-T02,
 * Phase 2 Decision Gate). Chosen over a URL query param so userId is never
 * exposed in the address bar, survives a page reload, and needs no new
 * global state / router infra ahead of AuthContext/Redux in a later sprint.
 */

const STORAGE_KEY = "verify-registration";

export interface VerifyRegistrationContext {
	userId: string;
	email: string;
	phone: string;
}

export function setVerifyRegistration(context: VerifyRegistrationContext): void {
	sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
}

export function getVerifyRegistration(): VerifyRegistrationContext | null {
	const raw = sessionStorage.getItem(STORAGE_KEY);
	if (!raw) {
		return null;
	}
	try {
		return JSON.parse(raw) as VerifyRegistrationContext;
	} catch {
		return null;
	}
}

export function clearVerifyRegistration(): void {
	sessionStorage.removeItem(STORAGE_KEY);
}
