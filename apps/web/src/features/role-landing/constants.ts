import {
	Activity,
	AlertTriangle,
	BadgeCheck,
	Bell,
	BriefcaseBusiness,
	CalendarDays,
	ClipboardList,
	Compass,
	FileClock,
	LayoutDashboard,
	MapPinned,
	MessageSquare,
	Mountain,
	Route,
	ShieldAlert,
	ShieldCheck,
	TentTree,
	Users,
	Wifi,
} from "lucide-react";
import type { DashboardConfig, Metric, RoleKey } from "./types";

export const toneClasses: Record<Metric["tone"], string> = {
	green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
	blue: "bg-sky-50 text-sky-700 ring-sky-100",
	amber: "bg-amber-50 text-amber-700 ring-amber-100",
	red: "bg-red-50 text-red-700 ring-red-100",
	purple: "bg-purple-50 text-purple-700 ring-purple-100",
};

export const alertClasses: Record<DashboardConfig["alerts"][number]["tone"], string> = {
	green: "border-emerald-200 bg-emerald-50 text-emerald-900",
	amber: "border-amber-200 bg-amber-50 text-amber-900",
	red: "border-red-200 bg-red-50 text-red-900",
	blue: "border-sky-200 bg-sky-50 text-sky-900",
};

export const roleLabels: Record<RoleKey, string> = {
	camper: "Camper",
	host: "Host",
	porter: "Porter",
	admin: "Admin",
};

export const dashboards: Record<RoleKey, DashboardConfig> = {
	camper: {
		role: "camper",
		figmaName: "Tổng quan - Camper Hub (Đồng bộ Sidebar)",
		productLabel: "Camper Hub",
		title: "Chào buổi sáng, Camper",
		subtitle: "Theo dõi chuyến đi, sức khỏe, cảnh báo và các tác vụ cá nhân trước khi khởi hành.",
		accent: "#164027",
		soft: "#eef7f0",
		navTitle: "Camper Hub",
		navItems: [
			{ key: "overview", label: "Tổng quan", icon: LayoutDashboard },
			{ key: "explore", label: "Khám phá địa điểm", icon: MapPinned },
			{ key: "bookings", label: "Đơn đặt chỗ", icon: TentTree },
			{ key: "trips", label: "Chuyến đi của tôi", icon: Compass },
			{ key: "profile", label: "Hồ sơ & sức khỏe", icon: Activity },
			{ key: "safety", label: "Trung tâm an toàn", icon: ShieldCheck },
		],
		metrics: [
			{
				label: "Chuyến sắp tới",
				value: "02",
				helper: "Sơn Trà, Bidoup",
				tone: "green",
				icon: Mountain,
			},
			{
				label: "Hồ sơ sức khỏe",
				value: "86%",
				helper: "Cần cập nhật dị ứng",
				tone: "blue",
				icon: Activity,
			},
			{
				label: "Thông báo",
				value: "04",
				helper: "2 cảnh báo quan trọng",
				tone: "amber",
				icon: Bell,
			},
			{
				label: "Điểm an toàn",
				value: "A-",
				helper: "Đủ điều kiện tham gia",
				tone: "purple",
				icon: ShieldCheck,
			},
		],
		primaryPanel: {
			kicker: "Chuyến đang chuẩn bị",
			title: "Trekking Sơn Trà - Bãi Bắc",
			description:
				"Khởi hành 06:30 ngày 18/08. Hồ sơ y tế đã chia sẻ với Host và Porter phụ trách.",
			items: [
				{ label: "Host", value: "host@ctms.local" },
				{ label: "Porter", value: "porter@ctms.local" },
				{ label: "Điểm tập trung", value: "Cổng bán đảo Sơn Trà" },
				{ label: "Trạng thái", value: "Đã xác nhận" },
			],
		},
		timeline: [
			{
				time: "06:30",
				title: "Check-in điểm tập trung",
				description: "Mang CCCD và xác nhận sức khỏe.",
				status: "Bắt buộc",
			},
			{
				time: "08:10",
				title: "Di chuyển tuyến rừng",
				description: "Theo hướng dẫn porter, không tách đoàn.",
				status: "An toàn",
			},
			{
				time: "12:00",
				title: "Nghỉ tại trạm Bãi Bắc",
				description: "Cập nhật nước uống và kiểm tra thể lực.",
				status: "Theo dõi",
			},
		],
		alerts: [
			{
				title: "Mưa rải rác từ 16:00",
				detail: "Chuẩn bị áo mưa nhẹ và túi chống nước.",
				tone: "amber",
			},
			{
				title: "Health profile còn thiếu",
				detail: "Bổ sung thông tin dị ứng trước ngày đi.",
				tone: "blue",
			},
		],
		tasks: [
			{ label: "Cập nhật hồ sơ", value: "1 mục", icon: ClipboardList },
			{ label: "Xem bản đồ offline", value: "Đã tải", icon: Wifi },
			{ label: "Chat hỗ trợ", value: "Mở", icon: MessageSquare },
		],
	},
	host: {
		role: "host",
		figmaName: "Tổng quan vận hành - Host Dashboard",
		productLabel: "Host Dashboard",
		title: "Tổng quan vận hành",
		subtitle:
			"Giám sát chuyến đi, booking, cảnh báo rủi ro và điều phối porter theo thời gian thực.",
		accent: "#1f4d34",
		soft: "#f2f7ef",
		navTitle: "Host Ops",
		navItems: [
			{ key: "overview", label: "Tổng quan vận hành", icon: LayoutDashboard },
			{ key: "trips", label: "Lịch trip", icon: CalendarDays },
			{ key: "campers", label: "Camper & booking", icon: Users },
			{ key: "porters", label: "Porter", icon: BriefcaseBusiness },
			{ key: "alerts", label: "Cảnh báo", icon: ShieldAlert },
			{ key: "reports", label: "Báo cáo", icon: FileClock },
		],
		metrics: [
			{
				label: "Trip hôm nay",
				value: "08",
				helper: "5 đang vận hành",
				tone: "green",
				icon: Route,
			},
			{
				label: "Booking cần xác nhận",
				value: "12",
				helper: "3 booking quá SLA",
				tone: "amber",
				icon: ClipboardList,
			},
			{
				label: "Cảnh báo nguy hiểm",
				value: "03",
				helper: "1 weather risk",
				tone: "red",
				icon: AlertTriangle,
			},
			{
				label: "Porter active",
				value: "24",
				helper: "92% đã check-in",
				tone: "blue",
				icon: BriefcaseBusiness,
			},
		],
		primaryPanel: {
			kicker: "Điểm nóng vận hành",
			title: "Trekking Sơn Trà - Tuyến 02",
			description:
				"Mưa lớn dự báo lúc 16:00. Host cần xác nhận phương án trú ẩn và route fallback.",
			items: [
				{ label: "Camper", value: "32 người" },
				{ label: "Porter", value: "06 active" },
				{ label: "Risk", value: "Weather risk" },
				{ label: "SLA xử lý", value: "08 phút" },
			],
		},
		timeline: [
			{
				time: "09:00",
				title: "Nhóm 03 bắt đầu tuyến",
				description: "Porter Nam đã check-in tại trạm A.",
				status: "On track",
			},
			{
				time: "11:20",
				title: "Booking mới cần xác nhận",
				description: "Yên Retreat, 4 camper, chờ host duyệt.",
				status: "Pending",
			},
			{
				time: "15:40",
				title: "Weather risk",
				description: "Gió giật mạnh trên tuyến Sơn Trà.",
				status: "Urgent",
			},
		],
		alerts: [
			{
				title: "Cảnh báo thành viên lệch tuyến",
				detail: "Nguyễn Văn An lệch tuyến 15m, cần porter kiểm tra.",
				tone: "red",
			},
			{
				title: "Bản đồ offline đã cũ",
				detail: "Bidoup cần cập nhật dữ liệu v2.4.1.",
				tone: "amber",
			},
		],
		tasks: [
			{ label: "Duyệt booking", value: "12", icon: ClipboardList },
			{ label: "Gửi broadcast", value: "2 tuyến", icon: Bell },
			{ label: "Điều phối porter", value: "6 ca", icon: BriefcaseBusiness },
		],
	},
	porter: {
		role: "porter",
		figmaName: "Tổng quan - Porter Dashboard (Light Mode)",
		productLabel: "Porter Dashboard",
		title: "Ca hỗ trợ hôm nay",
		subtitle: "Theo dõi phân công, bản đồ tuyến, check-in và cảnh báo cần phản hồi nhanh.",
		accent: "#246b8e",
		soft: "#e6f2f7",
		navTitle: "Porter Ops",
		navItems: [
			{ key: "overview", label: "Tổng quan", icon: LayoutDashboard },
			{ key: "assignments", label: "Phân công", icon: ClipboardList },
			{ key: "routes", label: "Bản đồ tuyến", icon: MapPinned },
			{ key: "checkins", label: "Check-in", icon: BadgeCheck },
			{ key: "alerts", label: "Cảnh báo", icon: Bell },
			{ key: "support", label: "Hỗ trợ", icon: MessageSquare },
		],
		metrics: [
			{
				label: "Ca hôm nay",
				value: "03",
				helper: "1 ca đang chạy",
				tone: "blue",
				icon: CalendarDays,
			},
			{
				label: "Camper phụ trách",
				value: "18",
				helper: "2 cần theo dõi",
				tone: "green",
				icon: Users,
			},
			{
				label: "Check-in tiếp theo",
				value: "12:30",
				helper: "Trạm Bãi Bắc",
				tone: "amber",
				icon: BadgeCheck,
			},
			{
				label: "Cảnh báo mở",
				value: "02",
				helper: "1 ưu tiên cao",
				tone: "red",
				icon: AlertTriangle,
			},
		],
		primaryPanel: {
			kicker: "Tuyến đang phụ trách",
			title: "Sơn Trà - Bãi Bắc",
			description:
				"Đội 03 đang di chuyển tới trạm giữa tuyến. Cần cập nhật check-in và quan sát thời tiết.",
			items: [
				{ label: "Host", value: "host@ctms.local" },
				{ label: "Camper", value: "18 người" },
				{ label: "Điểm gần nhất", value: "Trạm Bãi Bắc" },
				{ label: "ETA", value: "42 phút" },
			],
		},
		timeline: [
			{
				time: "08:00",
				title: "Nhận phân công",
				description: "Tuyến Sơn Trà, nhóm 03.",
				status: "Đã nhận",
			},
			{
				time: "10:45",
				title: "Check-in trạm A",
				description: "Đoàn đủ 18 camper, sức khỏe ổn định.",
				status: "Done",
			},
			{
				time: "12:30",
				title: "Check-in Bãi Bắc",
				description: "Cập nhật ảnh và trạng thái đoàn.",
				status: "Next",
			},
		],
		alerts: [
			{
				title: "Camper lệch tuyến",
				detail: "Một thiết bị GPS lệch 15m, cần xác minh.",
				tone: "red",
			},
			{
				title: "Mưa nhỏ",
				detail: "Khuyến nghị giảm tốc độ di chuyển sau 15:00.",
				tone: "amber",
			},
		],
		tasks: [
			{ label: "Check-in", value: "1 điểm", icon: BadgeCheck },
			{ label: "Cập nhật tuyến", value: "Mở", icon: MapPinned },
			{ label: "Phản hồi alert", value: "2", icon: Bell },
		],
	},
	admin: {
		role: "admin",
		figmaName: "Admin Dashboard",
		productLabel: "Admin",
		title: "Trung tâm quản trị",
		subtitle: "Tài khoản Admin dùng dashboard quản trị và quản lý người dùng.",
		accent: "#7146a5",
		soft: "#f0eaf8",
		navTitle: "Administration",
		navItems: [
			{ key: "overview", label: "Tổng quan", icon: LayoutDashboard },
			{ key: "users", label: "User Accounts", icon: Users },
			{ key: "audit", label: "Audit Logs", icon: FileClock, disabled: true },
		],
		metrics: [
			{
				label: "User active",
				value: "Seed",
				helper: "Admin, Host, Porter",
				tone: "purple",
				icon: Users,
			},
			{
				label: "Roles",
				value: "4",
				helper: "camper, host, porter, admin",
				tone: "green",
				icon: ShieldCheck,
			},
			{
				label: "Protected views",
				value: "On",
				helper: "AppRoleGuard",
				tone: "blue",
				icon: BadgeCheck,
			},
			{
				label: "403",
				value: "Ready",
				helper: "Unauthorized page",
				tone: "amber",
				icon: ShieldAlert,
			},
		],
		primaryPanel: {
			kicker: "Admin workspace",
			title: "Quản lý tài khoản và phân quyền",
			description: "Mở trang User Accounts để kiểm tra trạng thái, role và multi-role account.",
			items: [
				{ label: "Admin", value: "admin@ctms.local" },
				{ label: "Host", value: "host@ctms.local" },
				{ label: "Porter", value: "porter@ctms.local" },
				{ label: "Guard", value: "roles[]" },
			],
		},
		timeline: [
			{
				time: "Now",
				title: "Seed accounts",
				description: "Admin, Host và Porter active.",
				status: "Ready",
			},
			{
				time: "Next",
				title: "Review access",
				description: "Kiểm tra 403 cho role không hợp lệ.",
				status: "CTMS-6",
			},
		],
		alerts: [
			{
				title: "Admin route",
				detail: "Dùng nút Quản lý người dùng để vào /admin/users.",
				tone: "blue",
			},
		],
		tasks: [
			{ label: "User Accounts", value: "Mở", icon: Users },
			{ label: "Audit", value: "Soon", icon: FileClock },
			{ label: "Reports", value: "Soon", icon: ClipboardList },
		],
	},
};
