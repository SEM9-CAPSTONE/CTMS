import type {
	AdminRegisterFormData,
	CamperRegisterFormData,
	HostRegisterFormData,
	PorterRegisterFormData,
	UserRole,
} from "../types";

export interface RegisterDraftSnapshot {
	currentStep: number;
	selectedRole: UserRole;
	camperForm: CamperRegisterFormData;
	hostForm: HostRegisterFormData;
	porterForm: PorterRegisterFormData;
	adminForm: AdminRegisterFormData;
	acceptedTerms: boolean;
	healthProfileConsent: boolean;
}

/**
 * In-memory SPA draft store for RegisterPage so opening /terms and returning
 * restores every entered field (including passwords) without persisting
 * sensitive credentials to localStorage/sessionStorage.
 */
let registerDraft: RegisterDraftSnapshot | null = null;

export function getRegisterDraft(): RegisterDraftSnapshot | null {
	return registerDraft;
}

export function setRegisterDraft(snapshot: RegisterDraftSnapshot): void {
	registerDraft = snapshot;
}

export function clearRegisterDraft(): void {
	registerDraft = null;
}
