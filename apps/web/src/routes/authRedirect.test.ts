import { describe, expect, it } from "vitest";
import { getAuthenticatedHomePath, getGuestOnlyRedirectPath } from "./authRedirect";
import { RoutePath } from "./routes.config";

const host = { role: "host", roles: ["host"] };
const camper = { role: "camper", roles: ["camper"] };
const admin = { role: "admin", roles: ["admin"] };

describe("getAuthenticatedHomePath", () => {
	it("sends admins to user management", () => {
		expect(getAuthenticatedHomePath(admin)).toBe(RoutePath.ADMIN_USERS);
	});

	it.each([host, camper, { role: "porter", roles: ["porter"] }])(
		"sends $role to the dashboard",
		(user) => {
			expect(getAuthenticatedHomePath(user)).toBe(RoutePath.DASHBOARD);
		}
	);
});

describe("getGuestOnlyRedirectPath", () => {
	it.each([
		RoutePath.HOME,
		RoutePath.LOGIN,
		RoutePath.REGISTER,
		RoutePath.FORGOT_PASSWORD,
		RoutePath.VERIFY_OTP,
	])("redirects a signed-in host away from %s to the dashboard", (path) => {
		expect(getGuestOnlyRedirectPath(path, host)).toBe(RoutePath.DASHBOARD);
	});

	it.each([RoutePath.HOME, RoutePath.LOGIN])(
		"redirects a signed-in admin away from %s to user management",
		(path) => {
			expect(getGuestOnlyRedirectPath(path, admin)).toBe(RoutePath.ADMIN_USERS);
		}
	);

	it("lets an anonymous visitor stay on guest-only pages", () => {
		expect(getGuestOnlyRedirectPath(RoutePath.HOME, null)).toBeNull();
		expect(getGuestOnlyRedirectPath(RoutePath.LOGIN, null)).toBeNull();
		expect(getGuestOnlyRedirectPath(RoutePath.REGISTER, null)).toBeNull();
	});

	it.each([RoutePath.DASHBOARD, RoutePath.TRIPS, RoutePath.HOST_EQUIPMENT_CATALOG])(
		"does not redirect a signed-in user on %s",
		(path) => {
			expect(getGuestOnlyRedirectPath(path, camper)).toBeNull();
		}
	);
});
