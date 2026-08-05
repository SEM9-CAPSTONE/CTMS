export enum RoutePath {
	HOME = "/",
	LOGIN = "/login",
	REGISTER = "/register",
	DASHBOARD = "/dashboard",
	CAMPSITES = "/campsites",
	TREKKING = "/trekking",
	SAFETY = "/safety",
	CAMPER_PROFILE = "/camper/profile",
	PROFILE = "/profile",
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
	{ path: RoutePath.CAMPSITES, label: "Campsites" },
	{ path: RoutePath.TREKKING, label: "Trekking Routes" },
	{ path: RoutePath.SAFETY, label: "Safety Center" },
];
