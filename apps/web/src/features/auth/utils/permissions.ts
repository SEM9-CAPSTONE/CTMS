import type { LoginApiResponse } from "../types";

type RoleValue = string;

export interface RoleBearingUser {
	role?: RoleValue | null;
	roles?: RoleValue[] | null;
}

function isRoleArray(value: unknown): value is readonly RoleValue[] {
	return Array.isArray(value);
}

export function normalizeRole(role: RoleValue): Lowercase<RoleValue> {
	return role.toLowerCase() as Lowercase<RoleValue>;
}

export function getGrantedRoles(user?: RoleBearingUser | null): Lowercase<RoleValue>[] {
	if (!user) {
		return [];
	}

	const grantedRoles =
		user.roles && user.roles.length > 0 ? user.roles : user.role ? [user.role] : [];
	return Array.from(new Set(grantedRoles.map(normalizeRole)));
}

export function hasAnyRole(
	grantedRoles: readonly RoleValue[] | RoleBearingUser | null | undefined,
	allowedRoles: readonly RoleValue[]
): boolean {
	const normalizedGrantedRoles = isRoleArray(grantedRoles)
		? grantedRoles.map(normalizeRole)
		: getGrantedRoles(grantedRoles);
	const normalizedAllowedRoles = allowedRoles.map(normalizeRole);

	return normalizedAllowedRoles.some((role) => normalizedGrantedRoles.includes(role));
}

export function isAdminUser(user?: LoginApiResponse["user"] | null): boolean {
	return hasAnyRole(user, ["admin"]);
}
