export type UserRole = "camper" | "host" | "porter" | "admin";

export interface LoginFormData {
	identifier: string;
	password: string;
	rememberMe: boolean;
}

export interface LoginPageProps {
	onBackToHome: () => void;
	onNavigateToRegister?: () => void;
}

/** Request payload accepted by POST /api/auth/login (CTMS-03-T01 API contract). */
export interface LoginApiPayload {
	identifier: string;
	password: string;
}

/** Response body on 200 (matches services/api's LoginResponseDto). */
export interface LoginApiResponse {
	accessToken: string;
	refreshToken: string;
	user: {
		id: string;
		email: string | null;
		phone: string | null;
		role: UserRole;
		status: "pending_verification" | "active" | "suspended" | "deleted";
		createdAt: string;
	};
}

export interface RegisterPageProps {
	onBackToHome: () => void;
	onNavigateToLogin: () => void;
}

export interface RoleOption {
	id: UserRole;
	title: string;
	badge?: {
		text: string;
		variant: "orange" | "green" | "purple";
	};
	description: string;
	features: string[];
}

export interface BaseRegisterFormData {
	fullName: string;
	email: string;
	phone: string;
	password: string;
	confirmPassword: string;
}

export interface CamperRegisterFormData extends BaseRegisterFormData {
	bloodType?: string;
	fitnessLevel?: string;
	emergencyContactName?: string;
	emergencyContactPhone?: string;
}

export interface HostRegisterFormData extends BaseRegisterFormData {
	campsiteName: string;
	province: string;
	businessLicense?: string;
}

export interface PorterRegisterFormData extends BaseRegisterFormData {
	experienceYears: number;
	operatingAreas: string;
	certificationCode?: string;
}

export interface AdminRegisterFormData extends BaseRegisterFormData {
	adminSecretKey: string;
}

/**
 * Request payload accepted by POST /api/auth/register (CTMS-01-T01 API contract).
 * Only these 4 fields — the backend rejects any other property (whitelist +
 * forbidNonWhitelisted), so form-only fields (fullName, bloodType, etc.) must
 * never be included here. Email and phone are both mandatory (business flow
 * update: registration no longer accepts "email or phone", both are required).
 */
export interface RegisterApiPayload {
	email: string;
	phone: string;
	password: string;
	role: "camper" | "host" | "porter";
}

/** Response body on 201 (matches services/api's UserProfileDto). */
export interface RegisterApiResponse {
	id: string;
	email: string | null;
	phone: string | null;
	role: "camper" | "host" | "porter";
	status: "pending_verification" | "active" | "suspended" | "deleted";
	createdAt: string;
}

/** Error body on 422 (custom ValidationPipe exceptionFactory, BR-231). */
export interface RegisterValidationErrorResponse {
	statusCode: 422;
	error: string;
	message: Array<{ field: string; errors: string[] }>;
}

/** Error body on 409 (duplicate email/phone, BR-231). */
export interface RegisterConflictErrorResponse {
	statusCode: 409;
	message: string;
	error: string;
}
