export enum RoutePath {
	HOME = "/",
	LOGIN = "/login",
	REGISTER = "/register",
	VERIFY_OTP = "/verify-otp",
	FORGOT_PASSWORD = "/forgot-password",
	DASHBOARD = "/dashboard",
	TRIPS = "/trips",
	HOST_CREATE_TRIP = "/host/trips/create",
	HOST_TREKKING_ROUTES = "/host/trekking-routes",
	HOST_CREATE_TREKKING_ROUTE = "/host/trekking-routes/create",
	TREKKING = "/trekking",
	SAFETY = "/safety",
	CAMPER_PROFILE = "/camper/profile",
	PROFILE = "/profile",
	ADMIN_USERS = "/admin/users",
	ADMIN_CONTENT_REPORTS = "/admin/content-reports",
	ADMIN_AUDIT_LOGS = "/admin/audit-logs",
	ADMIN_TREKKING_ROUTES = "/admin/trekking-routes",
	ADMIN_WEATHER_RULES = "/admin/weather-rules",
	UNAUTHORIZED = "/unauthorized",
	ERROR = "/error",
	OFFLINE = "/offline",
	NOT_FOUND = "*",
}

export interface RouteItem {
	path: RoutePath;
	label: string;
	isPrivate?: boolean;
}

export const PUBLIC_ROUTES: RouteItem[] = [
	{ path: RoutePath.HOME, label: "Home" },
	{ path: RoutePath.TREKKING, label: "Trekking Routes" },
	{ path: RoutePath.SAFETY, label: "Safety Center" },
];
