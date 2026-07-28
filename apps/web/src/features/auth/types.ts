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
