import type { UserRole, UserStatus } from "./types";

export const DEFAULT_USER_ACCOUNTS_PAGE = 1;
export const DEFAULT_USER_ACCOUNTS_LIMIT = 20;

export const USER_ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
	{ value: "camper", label: "Khách cắm trại (Camper)" },
	{ value: "host", label: "Chủ bãi (Host)" },
	{ value: "porter", label: "Người dẫn đường (Porter)" },
	{ value: "admin", label: "Quản trị viên (Admin)" },
];

export const USER_STATUS_OPTIONS: Array<{ value: UserStatus; label: string }> = [
	{ value: "active", label: "Đang hoạt động" },
	{ value: "suspended", label: "Đã khóa" },
	{ value: "pending_verification", label: "Chờ xác minh" },
	{ value: "deleted", label: "Đã xóa" },
];
