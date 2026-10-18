export enum RoutePath {
	HOME = "/",
	LOGIN = "/login",
	REGISTER = "/register",
	VERIFY_OTP = "/verify-otp",
	FORGOT_PASSWORD = "/forgot-password",
	DASHBOARD = "/dashboard",
	TRIPS = "/trips",
	TRIP_DETAIL = "/trips/:id",
	BOOKINGS = "/bookings",
	BOOKING_DETAIL = "/bookings/:bookingId",
	HOST_CREATE_TRIP = "/host/trips/create",
	HOST_EDIT_TRIP = "/host/trips/:id/edit",
	HOST_PORTER = "/host/porter",
	HOST_CAMPERS = "/host/campers",
	HOST_TREKKING_ROUTES = "/host/trekking-routes",
	HOST_CREATE_TREKKING_ROUTE = "/host/trekking-routes/create",
	HOST_TREKKING_ROUTE_DETAIL = "/host/trekking-routes/:id",
	HOST_EDIT_TREKKING_ROUTE = "/host/trekking-routes/:id/edit",
	HOST_EQUIPMENT_CATALOG = "/host/equipment-catalog",
	HOST_WALLET = "/host/wallet",
	TREKKING = "/trekking",
	SAFETY = "/safety",
	CAMPER_PROFILE = "/camper/profile",
	PORTER_PROFILE = "/porter/profile",
	PORTER_REQUESTS = "/porter/requests",
	PORTER_ASSIGNMENTS = "/porter/assignments",
	PORTER_VERIFICATION = "/porter/verification",
	PROFILE = "/profile",
	ADMIN_USERS = "/admin/users",
	ADMIN_PORTER_VERIFICATIONS = "/admin/porter-verifications",
	ADMIN_CONTENT_REPORTS = "/admin/content-reports",
	ADMIN_AUDIT_LOGS = "/admin/audit-logs",
	ADMIN_TREKKING_ROUTES = "/admin/trekking-routes",
	ADMIN_TRIPS = "/admin/trips",
	ADMIN_WEATHER_RULES = "/admin/weather-rules",
	ADMIN_REFUNDS = "/admin/refunds",
	ADMIN_SETTLEMENTS = "/admin/settlements",
	UNAUTHORIZED = "/unauthorized",
	ERROR = "/error",
	OFFLINE = "/offline",
	NOT_FOUND = "*",
}

// Pages only shown before sign-in (public landing + auth forms); a signed-in user with a
// valid session is sent straight to their role home instead.
export const GUEST_ONLY_PATHS: ReadonlySet<string> = new Set<string>([
	RoutePath.HOME,
	RoutePath.LOGIN,
	RoutePath.REGISTER,
	RoutePath.VERIFY_OTP,
	RoutePath.FORGOT_PASSWORD,
]);

export interface RouteItem {
	path: RoutePath;
	label: string;
	isPrivate?: boolean;
}

export const PUBLIC_ROUTES: RouteItem[] = [
	{ path: RoutePath.HOME, label: "Home" },
	{ path: RoutePath.TRIPS, label: "Chuyến đi" },
	{ path: RoutePath.TREKKING, label: "Trekking Routes" },
	{ path: RoutePath.SAFETY, label: "Safety Center" },
];
