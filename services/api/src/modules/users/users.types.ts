import type { User, UserRole, UserStatus } from "./entities/user.entity";

export interface UserAccountFilters {
	search?: string;
	role?: UserRole;
	status?: UserStatus;
	page: number;
	limit: number;
}

export interface PaginatedUsers {
	users: User[];
	total: number;
}
