import {
	BadgeCheck,
	BookOpen,
	CloudLightning,
	Coins,
	Compass,
	FileClock,
	Flag,
	Landmark,
	LayoutDashboard,
	type LucideIcon,
	MessageSquareText,
	ReceiptText,
	Route,
	Scale,
	Settings,
	ShieldAlert,
	ShieldCheck,
	Users,
} from "lucide-react";
import { RoutePath } from "../../routes/routes.config";
import type { AdminModerationCounts } from "./types";

export const ADMIN_SIDEBAR_STORAGE_KEY = "ctms:admin-sidebar-collapsed";
export const ADMIN_MODERATION_REFRESH_MS = 30_000;
export const ADMIN_MODERATION_STALE_MS = 15_000;

const items = {
	dashboard: { label: "Tổng quan", icon: LayoutDashboard, path: RoutePath.DASHBOARD },
	"trip-review": {
		label: "Duyệt chuyến đi",
		icon: Compass,
		path: RoutePath.ADMIN_TRIPS,
		countKey: "trips",
	},
	"route-review": {
		label: "Duyệt tuyến trekking",
		icon: Route,
		path: RoutePath.ADMIN_TREKKING_ROUTES,
		countKey: "trekkingRoutes",
	},
	"porter-verifications": {
		label: "Duyệt hồ sơ Porter",
		icon: BadgeCheck,
		path: RoutePath.ADMIN_PORTER_VERIFICATIONS,
		countKey: "porterVerifications",
	},
	"content-reports": {
		label: "Báo cáo từ người dùng",
		icon: Flag,
		path: RoutePath.ADMIN_CONTENT_REPORTS,
		countKey: "contentReports",
	},
	"user-accounts": { label: "Tài khoản người dùng", icon: Users, path: RoutePath.ADMIN_USERS },
	"porter-levels": {
		label: "Cấp độ Porter",
		icon: BadgeCheck,
		path: RoutePath.ADMIN_PORTER_LEVELS,
	},
	settlements: { label: "Quyết toán & Ví Host", icon: Landmark, path: RoutePath.ADMIN_SETTLEMENTS },
	refunds: { label: "Quản lý hoàn tiền", icon: ReceiptText, path: RoutePath.ADMIN_REFUNDS },
	"survival-documents": {
		label: "Tài liệu sinh tồn",
		icon: BookOpen,
		path: RoutePath.ADMIN_SURVIVAL_DOCUMENTS,
	},
	"weather-rules": {
		label: "Cấu hình rủi ro thời tiết",
		icon: ShieldAlert,
		path: RoutePath.ADMIN_WEATHER_RULES,
	},
	"weather-interventions": {
		label: "Can thiệp thời tiết",
		icon: CloudLightning,
		path: RoutePath.ADMIN_WEATHER_INTERVENTIONS,
	},
	"weather-penalties": {
		label: "Phạt thời tiết",
		icon: Scale,
		path: RoutePath.ADMIN_WEATHER_PENALTIES,
	},
	"review-analysis": {
		label: "Phân tích đánh giá AI",
		icon: MessageSquareText,
		path: RoutePath.ADMIN_REVIEW_ANALYSIS,
	},
	"audit-logs": { label: "Nhật ký hệ thống", icon: FileClock, path: RoutePath.ADMIN_AUDIT_LOGS },
} as const satisfies Record<string, AdminNavLinkConfig>;

export interface AdminNavLinkConfig {
	label: string;
	icon: LucideIcon;
	path: RoutePath;
	countKey?: keyof AdminModerationCounts;
}

export type AdminNavigationItem = keyof typeof items;
export const ADMIN_NAV_ITEMS: Record<AdminNavigationItem, AdminNavLinkConfig> = items;

export const ADMIN_NAV_GROUPS = [
	{
		key: "moderation",
		label: "Kiểm duyệt",
		icon: ShieldCheck,
		items: ["trip-review", "route-review", "porter-verifications", "content-reports"],
	},
	{ key: "users", label: "Người dùng", icon: Users, items: ["user-accounts", "porter-levels"] },
	{ key: "finance", label: "Tài chính", icon: Coins, items: ["settlements", "refunds"] },
	{
		key: "system",
		label: "Hệ thống",
		icon: Settings,
		items: [
			"survival-documents",
			"weather-rules",
			"weather-interventions",
			"weather-penalties",
			"review-analysis",
			"audit-logs",
		],
	},
] as const satisfies ReadonlyArray<{
	key: string;
	label: string;
	icon: LucideIcon;
	items: readonly AdminNavigationItem[];
}>;

export type AdminNavGroup = (typeof ADMIN_NAV_GROUPS)[number];
