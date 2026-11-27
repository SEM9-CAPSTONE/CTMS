import {
	BadgeCheck,
	BarChart3,
	BookOpen,
	CloudLightning,
	Coins,
	Compass,
	CreditCard,
	FileClock,
	Flag,
	Landmark,
	LayoutDashboard,
	LineChart,
	type LucideIcon,
	MapPinned,
	MessageSquareText,
	MessageSquareWarning,
	Route,
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
	"performance-reports": {
		label: "Báo cáo hiệu suất",
		icon: BarChart3,
		path: RoutePath.ADMIN_PERFORMANCE_REPORTS,
	},
	"revenue-analytics": {
		label: "Báo cáo doanh thu",
		icon: LineChart,
		path: RoutePath.ADMIN_REVENUE_ANALYTICS,
	},
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
		label: "Quản lý người hỗ trợ",
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
	"ai-investigations": {
		label: "Phân tích & xử lý phản hồi AI",
		icon: MessageSquareWarning,
		path: RoutePath.ADMIN_AI_INVESTIGATIONS,
	},
	"user-accounts": { label: "Tài khoản người dùng", icon: Users, path: RoutePath.ADMIN_USERS },
	"porter-levels": {
		label: "Cấp độ người hỗ trợ",
		icon: BadgeCheck,
		path: RoutePath.ADMIN_PORTER_LEVELS,
	},
	settlements: { label: "Quản lý tài chính", icon: Landmark, path: RoutePath.ADMIN_SETTLEMENTS },
	"platform-bank-account": {
		label: "Tài khoản nhận tiền phạt",
		icon: CreditCard,
		path: RoutePath.ADMIN_PLATFORM_BANK_ACCOUNT,
	},
	"survival-documents": {
		label: "Tài liệu sinh tồn",
		icon: BookOpen,
		path: RoutePath.ADMIN_SURVIVAL_DOCUMENTS,
	},
	"weather-management": {
		label: "Quản lý thời tiết",
		icon: CloudLightning,
		path: RoutePath.ADMIN_WEATHER,
	},
	"safety-hotspots": {
		label: "Điểm nóng an toàn",
		icon: ShieldAlert,
		path: RoutePath.ADMIN_SAFETY_HOTSPOTS,
	},
	"danger-zone-proposals": {
		label: "Đề xuất điểm nguy hiểm",
		icon: MapPinned,
		path: RoutePath.ADMIN_DANGER_ZONE_PROPOSALS,
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
export const ADMIN_NAV_TOP_LEVEL = ["performance-reports", "revenue-analytics"] as const;

export const ADMIN_NAV_GROUPS = [
	{
		key: "moderation",
		label: "Kiểm duyệt",
		icon: ShieldCheck,
		items: [
			"trip-review",
			"route-review",
			"danger-zone-proposals",
			"safety-hotspots",
			"porter-verifications",
			"content-reports",
			"ai-investigations",
		],
	},
	{ key: "users", label: "Người dùng", icon: Users, items: ["user-accounts"] },
	{
		key: "finance",
		label: "Tài chính",
		icon: Coins,
		items: ["settlements", "platform-bank-account"],
	},
	{
		key: "system",
		label: "Hệ thống",
		icon: Settings,
		items: ["survival-documents", "weather-management", "review-analysis", "audit-logs"],
	},
] as const satisfies ReadonlyArray<{
	key: string;
	label: string;
	icon: LucideIcon;
	items: readonly AdminNavigationItem[];
}>;

export type AdminNavGroup = (typeof ADMIN_NAV_GROUPS)[number];
