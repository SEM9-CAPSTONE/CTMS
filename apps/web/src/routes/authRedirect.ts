import { type RoleBearingUser, isAdminUser } from "../features/auth/utils/permissions";
import { GUEST_ONLY_PATHS, RoutePath } from "./routes.config";

/** Where a signed-in user lands: admins on performance reports, every other role on the dashboard. */
export function getAuthenticatedHomePath(user: RoleBearingUser | null): RoutePath {
	return isAdminUser(user) ? RoutePath.ADMIN_PERFORMANCE_REPORTS : RoutePath.DASHBOARD;
}

/** Returns the path to send a signed-in user to when they open a guest-only page, otherwise null. */
export function getGuestOnlyRedirectPath(
	currentPath: string,
	user: RoleBearingUser | null
): RoutePath | null {
	if (!user || !GUEST_ONLY_PATHS.has(currentPath)) {
		return null;
	}
	return getAuthenticatedHomePath(user);
}
