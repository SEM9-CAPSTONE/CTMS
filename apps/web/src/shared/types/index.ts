export type UserRole =
	| "camper"
	| "host"
	| "porter"
	| "admin"
	| "CAMPER"
	| "HOST"
	| "PORTER"
	| "ADMIN";

export interface UserProfile {
	id: string;
	email: string;
	fullName: string;
	avatarUrl?: string;
	role: UserRole;
}

export interface PaginationParams {
	page: number;
	limit: number;
}

export interface ApiResponse<T> {
	data: T;
	message?: string;
	success: boolean;
}
