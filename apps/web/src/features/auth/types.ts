export type UserRole = "camper" | "host" | "porter" | "admin";

export interface LoginFormData {
	identifier: string;
	password: string;
	rememberMe: boolean;
}

export interface LoginPageProps {
	onBackToHome: () => void;
	onNavigateToRegister?: () => void;
	onNavigateToForgotPassword?: () => void;
	onLoginSuccess?: (user: LoginApiResponse["user"]) => void;
}

export interface ForgotPasswordPageProps {
	onBackToHome: () => void;
	onNavigateToLogin: () => void;
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
		roles: UserRole[];
		status: "pending_verification" | "active" | "suspended" | "deleted";
		createdAt: string;
	};
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

export interface RegisterApiPayload {
	email: string;
	phone: string;
	password: string;
	role: "camper" | "host" | "porter";
}

export interface RegisterApiResponse {
	id: string;
	email: string | null;
	phone: string | null;
	role: "camper" | "host" | "porter";
	roles: Array<"camper" | "host" | "porter">;
	status: "pending_verification" | "active" | "suspended" | "deleted";
	createdAt: string;
}

export interface RegisterValidationErrorResponse {
	statusCode: 422;
	error: string;
	message: Array<{ field: string; errors: string[] }>;
}

export interface RegisterConflictErrorResponse {
	statusCode: 409;
	message: string;
	error: string;
}

export interface VerifyOtpApiPayload {
	userId: string;
	code: string;
}

export type OtpChannel = "phone" | "email";

export interface SendOtpApiPayload {
	userId: string;
	channel: OtpChannel;
}

export type VerifyOtpApiResponse = RegisterApiResponse;
export type SendOtpApiResponse = RegisterApiResponse;

export interface ForgotPasswordApiPayload {
	identifier: string;
	channel: OtpChannel;
}

export interface ForgotPasswordApiResponse {
	requestAccepted: boolean;
}

export interface ResetPasswordApiPayload {
	identifier: string;
	code: string;
	newPassword: string;
}

export interface ResetPasswordApiResponse {
	passwordReset: boolean;
}

export interface LogoutApiPayload {
	refreshToken: string;
	allDevices?: boolean;
}

export interface LogoutApiResponse {
	loggedOut: boolean;
}
