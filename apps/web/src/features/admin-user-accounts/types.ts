export type UserRole = "camper" | "host" | "porter" | "admin";
export type UserStatus = "pending_verification" | "active" | "suspended" | "deleted";

export interface UserAccountSummary {
	id: string;
	email: string | null;
	phone: string | null;
	fullName: string | null;
	role: UserRole;
	roles?: UserRole[];
	status: UserStatus;
	createdAt: string;
	updatedAt: string;
}

export interface UserAccountDetail extends UserAccountSummary {
	dateOfBirth: string | null;
	gender: "male" | "female" | "other" | null;
	address: string | null;
	bio: string | null;
}

export interface UserAccountsPagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

export interface PaginatedUserAccountsResponse {
	items: UserAccountSummary[];
	pagination: UserAccountsPagination;
}

export interface UserAccountListParams {
	search?: string;
	role?: UserRole;
	status?: UserStatus;
	page: number;
	limit: number;
}

export interface AccountStatusActionPayload {
	reason?: string;
}

export type AccountAction = "lock" | "unlock";

export interface CurrentUserAccount {
	id: string;
	role: UserRole;
	roles?: UserRole[];
	status: UserStatus;
}
