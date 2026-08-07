export type UserRole = "camper" | "host" | "porter" | "admin";

export interface LoginFormData {
	email: string;
	password: string;
	rememberMe: boolean;
}

export interface LoginPageProps {
	onBackToHome: () => void;
	onNavigateToRegister?: () => void;
}

export interface RegisterPageProps {
	onBackToHome: () => void;
	onNavigateToLogin: () => void;
	onNavigateToVerifyOtp: () => void;
}

export interface VerifyOtpPageProps {
	onBackToHome: () => void;
	onNavigateToLogin: () => void;
	onNavigateToRegister: () => void;
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

/** Request payload accepted by POST /api/auth/verify (CTMS-02 API contract). */
export interface VerifyOtpApiPayload {
	userId: string;
	code: string;
}

/**
 * Which contact method to deliver the OTP through — chosen by the user on
 * the Verify page, never inferred. Mirrors services/api's OtpChannel enum.
 */
export type OtpChannel = "phone" | "email";

/**
 * Request payload shared by POST /api/auth/send-otp and POST /api/auth/resend
 * (CTMS-02 real-delivery API contract) — the two routes exist for REST-client
 * clarity (first send vs. resend), but accept the identical body.
 */
export interface SendOtpApiPayload {
	userId: string;
	channel: OtpChannel;
}

/**
 * Response body for /verify (200), /send-otp (200), and /resend (200) — all
 * three return the same UserProfileDto shape as /register on the backend
 * (services/api).
 */
export type VerifyOtpApiResponse = RegisterApiResponse;
export type SendOtpApiResponse = RegisterApiResponse;
