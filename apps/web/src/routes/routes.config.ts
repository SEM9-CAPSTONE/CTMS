export enum RoutePath {
	HOME = "/",
	LOGIN = "/login",
	REGISTER = "/register",
	VERIFY_OTP = "/verify-otp",
	FORGOT_PASSWORD = "/forgot-password",
	DASHBOARD = "/dashboard",
	TRIPS = "/trips",
	TRIP_DETAIL = "/trips/:id",
	BOOKING_PACKING_LIST = "/bookings/:id/packing-list",
	BOOKINGS = "/bookings",
	BOOKING_DETAIL = "/bookings/:bookingId",
	HOST_CREATE_TRIP = "/host/trips/create",
	HOST_EDIT_TRIP = "/host/trips/:id/edit",
	HOST_TREKKING_ROUTES = "/host/trekking-routes",
	HOST_CREATE_TREKKING_ROUTE = "/host/trekking-routes/create",
	HOST_EQUIPMENT_CATALOG = "/host/equipment-catalog",
	HOST_CREATE_EQUIPMENT_CATALOG_ITEM = "/host/equipment-catalog/create",
	TREKKING = "/trekking",
	SAFETY = "/safety",
	CAMPER_PROFILE = "/camper/profile",
	PROFILE = "/profile",
	ADMIN_USERS = "/admin/users",
	ADMIN_CONTENT_REPORTS = "/admin/content-reports",
	ADMIN_AUDIT_LOGS = "/admin/audit-logs",
	ADMIN_TREKKING_ROUTES = "/admin/trekking-routes",
	ADMIN_TRIPS = "/admin/trips",
	ADMIN_WEATHER_RULES = "/admin/weather-rules",
	UNAUTHORIZED = "/unauthorized",
	ERROR = "/error",
	OFFLINE = "/offline",
	NOT_FOUND = "*",
}

// Pages only meaningful before sign-in; an authenticated user is sent to their home instead.
export const GUEST_ONLY_PATHS: ReadonlySet<string> = new Set<string>([
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
