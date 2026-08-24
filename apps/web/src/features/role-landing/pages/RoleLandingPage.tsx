import {
	Activity,
	AlertTriangle,
	ArrowRight,
	BadgeCheck,
	Bell,
	BriefcaseBusiness,
	CalendarDays,
	ClipboardList,
	Compass,
	FileClock,
	Image as ImageIcon,
	LayoutDashboard,
	Loader2,
	MapPinned,
	Menu,
	MessageSquare,
	Mountain,
	Route,
	ShieldAlert,
	ShieldCheck,
	TentTree,
	Users,
	Wifi,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../shared/components/Button";
import { LogoutActions } from "../../auth/components/LogoutActions";
import { type RoleBearingUser, getGrantedRoles } from "../../auth/utils/permissions";
import type { StoredAuthUser } from "../../auth/utils/tokenStorage";
import { CamperSidebar } from "../../camper-profile/components/CamperSidebar";
import { camperProfileService } from "../../camper-profile/services/camper-profile.service";
import type { CamperProfileData } from "../../camper-profile/types";
import { campsitesService } from "../../campsites/services/campsites.service";
import type { CreatedCampsite } from "../../campsites/types";

type RoleKey = "camper" | "host" | "porter" | "admin";

export interface RoleLandingPageProps {
	user: StoredAuthUser;
	roles: readonly string[];
	onBackHome: () => void;
	onOpenProfile?: () => void;
	onOpenAdminUsers?: () => void;
	onCreateCampsite?: () => void;
	onCreateTrekkingRoute?: (campsiteId?: string) => void;
	onViewTrekkingRoutes?: (campsiteId: string) => void;
	onEditCampsite?: (id: string) => void;
	onLogout?: (allDevices: boolean) => Promise<void>;
}

interface SidebarItem {
	key: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	disabled?: boolean;
}

interface Metric {
	label: string;
	value: string;
	helper: string;
	tone: "green" | "blue" | "amber" | "red" | "purple";
	icon: React.ComponentType<{ className?: string }>;
}

interface TimelineItem {
	time: string;
	title: string;
	description: string;
	status: string;
}

interface DashboardConfig {
	role: RoleKey;
	figmaName: string;
	productLabel: string;
	title: string;
	subtitle: string;
	accent: string;
	soft: string;
	navTitle: string;
	navItems: SidebarItem[];
	metrics: Metric[];
	primaryPanel: {
		kicker: string;
		title: string;
		description: string;
		items: Array<{ label: string; value: string }>;
	};
	timeline: TimelineItem[];
	alerts: Array<{
		title: string;
		detail: string;
		tone: "green" | "amber" | "red" | "blue";
	}>;
	tasks: Array<{
		label: string;
		value: string;
		icon: React.ComponentType<{ className?: string }>;
	}>;
}

const toneClasses: Record<Metric["tone"], string> = {
	green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
	blue: "bg-sky-50 text-sky-700 ring-sky-100",
	amber: "bg-amber-50 text-amber-700 ring-amber-100",
	red: "bg-red-50 text-red-700 ring-red-100",
	purple: "bg-purple-50 text-purple-700 ring-purple-100",
};

const alertClasses: Record<DashboardConfig["alerts"][number]["tone"], string> = {
	green: "border-emerald-200 bg-emerald-50 text-emerald-900",
	amber: "border-amber-200 bg-amber-50 text-amber-900",
	red: "border-red-200 bg-red-50 text-red-900",
	blue: "border-sky-200 bg-sky-50 text-sky-900",
};

const roleLabels: Record<RoleKey, string> = {
	camper: "Camper",
	host: "Host",
	porter: "Porter",
	admin: "Admin",
};

function getTimeOfDay(date = new Date()) {
	const hour = date.getHours();
	if (hour < 11) {
		return "sáng";
	}
	if (hour < 18) {
		return "chiều";
	}
	return "tối";
}

const dashboards: Record<RoleKey, DashboardConfig> = {
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

function toRoleKey(role: string): RoleKey | null {
	const normalizedRole = role.toLowerCase();
	if (
		normalizedRole === "camper" ||
		normalizedRole === "host" ||
		normalizedRole === "porter" ||
		normalizedRole === "admin"
	) {
		return normalizedRole;
	}
	return null;
}

function getDisplayName(user: StoredAuthUser): string {
	return user.email ?? user.phone ?? user.id;
}

function useDashboardProfile() {
	const [profile, setProfile] = useState<CamperProfileData | null>(null);
	const [isLoadingProfile, setIsLoadingProfile] = useState(true);

	useEffect(() => {
		let isMounted = true;

		camperProfileService
			.getProfile()
			.then((data) => {
				if (!isMounted) return;
				setProfile(data);
			})
			.catch(() => {
				if (!isMounted) return;
				setProfile(null);
			})
			.finally(() => {
				if (!isMounted) return;
				setIsLoadingProfile(false);
			});

		return () => {
			isMounted = false;
		};
	}, []);

	return { profile, isLoadingProfile };
}

function useHostCampsites(isEnabled: boolean) {
	const [items, setItems] = useState<CreatedCampsite[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!isEnabled) {
			setItems([]);
			setError("");
			setIsLoading(false);
			return;
		}

		let isMounted = true;
		setIsLoading(true);
		setError("");

		campsitesService
			.getMine()
			.then((data) => {
				if (!isMounted) return;
				setItems(data);
			})
			.catch(() => {
				if (!isMounted) return;
				setItems([]);
				setError("Không thể tải danh sách khu cắm trại của Host.");
			})
			.finally(() => {
				if (!isMounted) return;
				setIsLoading(false);
			});

		return () => {
			isMounted = false;
		};
	}, [isEnabled]);

	return { items, isLoading, error };
}

function Sidebar({
	config,
	grantedRoles,
	activeRole,
	onRoleChange,
	onClose,
	profile,
	onOpenProfile,
	onLogout,
}: {
	config: DashboardConfig;
	grantedRoles: RoleKey[];
	activeRole: RoleKey;
	onRoleChange: (role: RoleKey) => void;
	onClose?: () => void;
	profile: CamperProfileData | null;
	onOpenProfile?: () => void;
	onLogout?: (allDevices: boolean) => Promise<void>;
}) {
	return (
		<aside className="flex h-full w-72 flex-col border-r border-[#dfe8df] bg-white">
			<div className="flex items-center gap-3 border-b border-[#e7eee7] px-5 py-5">
				<div
					className="flex size-11 items-center justify-center rounded-xl text-white shadow-sm"
					style={{ backgroundColor: config.accent }}
				>
					<TentTree className="size-6" />
				</div>
				<div className="min-w-0 flex-1">
					<p className="truncate text-base font-extrabold text-[#10221b]">CTMS</p>
					<p className="text-xs font-bold text-[#667a6d]">{config.navTitle}</p>
				</div>
				{onClose && (
					<button
						type="button"
						onClick={onClose}
						aria-label="Đóng menu"
						className="rounded-lg p-2 text-[#667a6d] hover:bg-[#f1f5f0] lg:hidden"
					>
						<X className="size-5" />
					</button>
				)}
			</div>

			{grantedRoles.length > 1 && (
				<div className="border-b border-[#e7eee7] px-4 py-4">
					<p className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-[#88998d]">
						Chọn vai trò
					</p>
					<div className="mt-2 grid grid-cols-2 gap-2">
						{grantedRoles.map((role) => (
							<button
								key={role}
								type="button"
								onClick={() => onRoleChange(role)}
								className={`rounded-xl px-3 py-2 text-xs font-extrabold transition ${
									activeRole === role
										? "text-white"
										: "bg-[#f4f7f2] text-[#425048] hover:bg-[#e8f0e6]"
								}`}
								style={
									activeRole === role ? { backgroundColor: dashboards[role].accent } : undefined
								}
							>
								{roleLabels[role]}
							</button>
						))}
					</div>
				</div>
			)}

			<nav
				aria-label={`${config.productLabel} navigation`}
				className="flex-1 space-y-1.5 px-4 py-5"
			>
				<p className="px-3 text-[11px] font-extrabold uppercase tracking-wider text-[#88998d]">
					{config.productLabel}
				</p>
				{config.navItems.map((item, index) => {
					const Icon = item.icon;
					const isActive = index === 0;

					return (
						<button
							key={item.key}
							type="button"
							onClick={() => {
								if (config.role === "camper" && item.key === "profile") {
									onOpenProfile?.();
								}
							}}
							disabled={item.disabled}
							className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-sm font-bold transition ${
								isActive
									? "text-white shadow-md"
									: item.disabled
										? "cursor-not-allowed text-[#98a69d]"
										: "text-[#4a5e51] hover:bg-[#f4f7f2]"
							}`}
							style={isActive ? { backgroundColor: config.accent } : undefined}
						>
							<Icon className="size-5 shrink-0" />
							<span className="flex-1">{item.label}</span>
						</button>
					);
				})}
			</nav>

			<div className="flex flex-col gap-3 border-t border-[#e7eee7] p-4">
				{profile && (
					<div className="flex items-center gap-3 rounded-2xl border border-[#e0ebe0] bg-[#f8faf8] p-3">
						<img
							src={profile.avatarUrl}
							alt={profile.fullName}
							className="size-10 rounded-full object-cover ring-2 ring-[#164027]/20"
						/>
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-extrabold text-[#10221b]">{profile.fullName}</p>
							<p className="truncate text-[11px] font-semibold text-[#667a6d]">{profile.email}</p>
						</div>
					</div>
				)}
				{onLogout && <LogoutActions onLogout={onLogout} />}
			</div>
		</aside>
	);
}

function MetricCard({ metric }: { metric: Metric }) {
	const Icon = metric.icon;
	return (
		<div className="rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-sm">
			<div className="flex items-center justify-between gap-3">
				<p className="text-xs font-extrabold uppercase tracking-wider text-[#7b8c82]">
					{metric.label}
				</p>
				<div
					className={`flex size-10 items-center justify-center rounded-xl ring-1 ${toneClasses[metric.tone]}`}
				>
					<Icon className="size-5" />
				</div>
			</div>
			<p className="mt-4 text-3xl font-extrabold tracking-tight text-[#10221b]">{metric.value}</p>
			<p className="mt-1 text-sm font-medium text-[#667a6d]">{metric.helper}</p>
		</div>
	);
}

const campsiteStatusLabels: Record<CreatedCampsite["status"], string> = {
	draft: "Nháp",
	pending_approval: "Chờ Admin duyệt",
	active: "Đang hoạt động",
	temporarily_closed: "Tạm đóng",
	suspended: "Tạm khóa",
	closed: "Đã đóng",
	archived: "Lưu trữ",
};

function formatCreatedAt(value: string): string {
	return new Intl.DateTimeFormat("vi-VN", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value));
}

function HostCampsitesPanel({
	items,
	isLoading,
	error,
	onCreateCampsite,
	onCreateTrekkingRoute,
	onViewTrekkingRoutes,
	onEditCampsite,
}: {
	items: CreatedCampsite[];
	isLoading: boolean;
	error: string;
	onCreateCampsite?: () => void;
	onCreateTrekkingRoute?: (campsiteId?: string) => void;
	onViewTrekkingRoutes?: (campsiteId: string) => void;
	onEditCampsite?: (id: string) => void;
}) {
	return (
		<section className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-xl font-extrabold text-[#10221b]">Khu cắm trại của tôi</h2>
				</div>
				{onCreateCampsite && (
					<Button onClick={onCreateCampsite} className="gap-2">
						<TentTree className="size-4" />
						<span>Tạo khu cắm trại</span>
					</Button>
				)}
			</div>

			{isLoading && (
				<div className="mt-5 flex items-center gap-2 rounded-2xl border border-[#e5eee7] bg-[#fbfdfb] p-4 text-sm font-bold text-[#667a6d]">
					<Loader2 className="size-4 animate-spin text-[#164027]" />
					Đang tải dữ liệu...
				</div>
			)}

			{error && !isLoading && (
				<div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
					{error}
				</div>
			)}

			{!isLoading && !error && items.length === 0 && (
				<div className="mt-5 rounded-2xl border border-dashed border-[#cbd9ce] bg-[#fbfdfb] p-6 text-center">
					<TentTree className="mx-auto size-8 text-[#8fa096]" />
					<p className="mt-2 text-sm font-extrabold text-[#10221b]">Chưa có bãi cắm nào</p>
					<p className="mt-1 text-xs font-semibold text-[#788b7e]">
						Bãi vừa tạo sẽ xuất hiện ở đây với trạng thái chờ duyệt.
					</p>
				</div>
			)}

			{!isLoading && !error && items.length > 0 && (
				<div className="mt-5 grid gap-4 lg:grid-cols-2">
					{items.map((campsite) => {
						const coverImage = campsite.media[0]?.url;

						return (
							<article
								key={campsite.id}
								className="overflow-hidden rounded-2xl border border-[#e5eee7] bg-[#fbfdfb]"
							>
								<div className="aspect-[16/9] bg-[#edf4ed]">
									{coverImage ? (
										<img
											src={coverImage}
											alt={campsite.name}
											className="h-full w-full object-cover"
										/>
									) : (
										<div className="flex h-full items-center justify-center text-[#8fa096]">
											<ImageIcon className="size-8" />
										</div>
									)}
								</div>
								<div className="p-4">
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<h3 className="truncate text-base font-extrabold text-[#10221b]">
												{campsite.name}
											</h3>
											<p className="mt-1 text-sm font-semibold text-[#667a6d]">
												{campsite.province}
											</p>
										</div>
										<span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-extrabold text-amber-700">
											{campsiteStatusLabels[campsite.status]}
										</span>
									</div>
									<p className="mt-3 line-clamp-2 text-sm leading-6 text-[#627769]">
										{campsite.description}
									</p>
									<div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-bold text-[#788b7e]">
										<span>
											{campsite.latitude.toFixed(6)}, {campsite.longitude.toFixed(6)}
										</span>
										<span>{formatCreatedAt(campsite.createdAt)}</span>
									</div>
									{(onEditCampsite || onCreateTrekkingRoute || onViewTrekkingRoutes) && (
										<div className="mt-4 flex flex-wrap gap-2">
											{onEditCampsite && (
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => onEditCampsite(campsite.id)}
												>
													Sửa khu cắm trại
												</Button>
											)}
											{onCreateTrekkingRoute && (
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => onCreateTrekkingRoute(campsite.id)}
												>
													<Route className="size-4" />
													Tạo trekking route
												</Button>
											)}
											{onViewTrekkingRoutes && (
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => onViewTrekkingRoutes(campsite.id)}
												>
													<MapPinned className="size-4" />
													Xem tuyến đường
												</Button>
											)}
										</div>
									)}
								</div>
							</article>
						);
					})}
				</div>
			)}
		</section>
	);
}

function DashboardMain({
	config,
	user,
	profile,
	hostCampsites,
	isLoadingHostCampsites,
	hostCampsitesError,
	onOpenProfile,
	onOpenAdminUsers,
	onCreateCampsite,
	onCreateTrekkingRoute,
	onViewTrekkingRoutes,
	onEditCampsite,
}: {
	config: DashboardConfig;
	user: StoredAuthUser;
	profile: CamperProfileData | null;
	hostCampsites: CreatedCampsite[];
	isLoadingHostCampsites: boolean;
	hostCampsitesError: string;
	onOpenProfile?: () => void;
	onOpenAdminUsers?: () => void;
	onCreateCampsite?: () => void;
	onCreateTrekkingRoute?: (campsiteId?: string) => void;
	onViewTrekkingRoutes?: (campsiteId: string) => void;
	onEditCampsite?: (id: string) => void;
}) {
	const displayName = profile?.fullName || getDisplayName(user);
	const timeOfDay = getTimeOfDay();

	return (
		<main className="flex-1 p-4 sm:p-6 lg:p-8">
			<div className="mx-auto flex max-w-[1440px] flex-col gap-6">
				<section className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm">
					<div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
						<div className="min-w-0">
							<p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#7b8c82]">
								{config.figmaName}
							</p>
							<h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#10221b] sm:text-4xl">
								{config.role === "camper" ? `Chào buổi ${timeOfDay}, ${displayName}` : config.title}
							</h1>
							<p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#627769]">
								{config.subtitle}
							</p>
						</div>
					</div>
				</section>

				<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
					{config.metrics.map((metric) => {
						const isProfileMetric = config.role === "camper" && metric.label === "Hồ sơ sức khỏe";
						return isProfileMetric ? (
							<button
								key={metric.label}
								type="button"
								onClick={onOpenProfile}
								className="text-left transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#164027]/30"
							>
								<MetricCard metric={metric} />
							</button>
						) : (
							<MetricCard key={metric.label} metric={metric} />
						);
					})}
				</section>

				{config.role === "host" && (
					<HostCampsitesPanel
						items={hostCampsites}
						isLoading={isLoadingHostCampsites}
						error={hostCampsitesError}
						onCreateCampsite={onCreateCampsite}
						onCreateTrekkingRoute={onCreateTrekkingRoute}
						onViewTrekkingRoutes={onViewTrekkingRoutes}
						onEditCampsite={onEditCampsite}
					/>
				)}

				<section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
					<div className="overflow-hidden rounded-[28px] border border-[#dfe8df] bg-white shadow-sm">
						<div className="grid min-h-[380px] gap-0 lg:grid-cols-[0.9fr_1.1fr]">
							<div className="p-6" style={{ backgroundColor: config.soft }}>
								<p
									className="text-xs font-extrabold uppercase tracking-wider"
									style={{ color: config.accent }}
								>
									{config.primaryPanel.kicker}
								</p>
								<h2 className="mt-3 text-2xl font-extrabold text-[#10221b]">
									{config.primaryPanel.title}
								</h2>
								<p className="mt-3 text-sm font-medium leading-6 text-[#52665b]">
									{config.primaryPanel.description}
								</p>
								<div className="mt-6 grid gap-3 sm:grid-cols-2">
									{config.primaryPanel.items.map((item) => (
										<div key={item.label} className="rounded-2xl bg-white/80 p-4 ring-1 ring-white">
											<p className="text-xs font-bold text-[#7b8c82]">{item.label}</p>
											<p className="mt-1 text-sm font-extrabold text-[#10221b]">{item.value}</p>
										</div>
									))}
								</div>
							</div>
							<div className="relative min-h-[320px] bg-[#10221b] p-6 text-white">
								<div className="absolute inset-0 opacity-20 [background-image:linear-gradient(90deg,#ffffff_1px,transparent_1px),linear-gradient(#ffffff_1px,transparent_1px)] [background-size:42px_42px]" />
								<div className="relative flex h-full flex-col justify-between">
									<div>
										<div className="flex items-center gap-2 text-sm font-bold text-white/80">
											<MapPinned className="size-4" />
											<span>Bản đồ vận hành</span>
										</div>
										<div className="mt-10 space-y-4">
											<div className="ml-8 h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_0_8px_rgba(110,231,183,0.16)]" />
											<div className="ml-28 h-3 w-3 rounded-full bg-amber-300 shadow-[0_0_0_8px_rgba(252,211,77,0.16)]" />
											<div className="ml-52 h-3 w-3 rounded-full bg-sky-300 shadow-[0_0_0_8px_rgba(125,211,252,0.16)]" />
										</div>
									</div>
									<div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
										<p className="text-xs font-bold uppercase tracking-wider text-white/60">
											Live status
										</p>
										<p className="mt-1 text-lg font-extrabold">Đồng bộ dữ liệu tuyến</p>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm">
						<div className="flex items-center justify-between">
							<h2 className="text-xl font-extrabold text-[#10221b]">Lịch vận hành</h2>
							<CalendarDays className="size-5 text-[#667a6d]" />
						</div>
						<div className="mt-5 space-y-4">
							{config.timeline.map((item) => (
								<div key={`${item.time}-${item.title}`} className="flex gap-4">
									<div
										className="w-14 shrink-0 text-sm font-extrabold"
										style={{ color: config.accent }}
									>
										{item.time}
									</div>
									<div className="flex-1 rounded-2xl border border-[#e5eee7] bg-[#fbfdfb] p-4">
										<div className="flex items-start justify-between gap-3">
											<h3 className="font-extrabold text-[#10221b]">{item.title}</h3>
											<span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-[#667a6d] ring-1 ring-[#dfe8df]">
												{item.status}
											</span>
										</div>
										<p className="mt-1 text-sm leading-6 text-[#627769]">{item.description}</p>
									</div>
								</div>
							))}
						</div>
					</div>
				</section>

				<section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
					<div className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm">
						<div className="flex items-center justify-between">
							<h2 className="text-xl font-extrabold text-[#10221b]">Cảnh báo</h2>
							<AlertTriangle className="size-5 text-amber-600" />
						</div>
						<div className="mt-5 space-y-3">
							{config.alerts.map((alert) => (
								<div
									key={alert.title}
									className={`rounded-2xl border p-4 ${alertClasses[alert.tone]}`}
								>
									<p className="font-extrabold">{alert.title}</p>
									<p className="mt-1 text-sm leading-6 opacity-80">{alert.detail}</p>
								</div>
							))}
						</div>
					</div>

					<div className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<h2 className="text-xl font-extrabold text-[#10221b]">Tác vụ nhanh</h2>
								<p className="mt-1 text-sm font-medium text-[#667a6d]">
									Các thao tác chính được expose theo role hiện tại.
								</p>
							</div>
							{config.role === "admin" && onOpenAdminUsers && (
								<Button onClick={onOpenAdminUsers} className="gap-2">
									<span>Quản lý user</span>
									<ArrowRight className="size-4" />
								</Button>
							)}
							{config.role === "host" && onCreateCampsite && (
								<Button onClick={onCreateCampsite} className="gap-2">
									<TentTree className="size-4" />
									<span>Tạo khu cắm trại</span>
								</Button>
							)}
							{config.role === "host" && onCreateTrekkingRoute && (
								<Button onClick={() => onCreateTrekkingRoute()} className="gap-2">
									<Route className="size-4" />
									<span>Tạo tuyến trekking</span>
								</Button>
							)}
						</div>
						<div className="mt-5 grid gap-3 md:grid-cols-3">
							{config.tasks.map((task) => {
								const Icon = task.icon;
								return (
									<div
										key={task.label}
										className="rounded-2xl border border-[#e5eee7] bg-[#fbfdfb] p-4"
									>
										<div
											className="flex size-10 items-center justify-center rounded-xl text-white"
											style={{ backgroundColor: config.accent }}
										>
											<Icon className="size-5" />
										</div>
										<p className="mt-4 text-sm font-bold text-[#667a6d]">{task.label}</p>
										<p className="mt-1 text-xl font-extrabold text-[#10221b]">{task.value}</p>
									</div>
								);
							})}
						</div>
					</div>
				</section>
			</div>
		</main>
	);
}

export const RoleLandingPage: React.FC<RoleLandingPageProps> = ({
	user,
	roles,
	onOpenProfile,
	onOpenAdminUsers,
	onCreateCampsite,
	onCreateTrekkingRoute,
	onViewTrekkingRoutes,
	onEditCampsite,
	onLogout,
}) => {
	const { profile } = useDashboardProfile();
	const grantedRoles = useMemo(() => {
		const roleBearingUser: RoleBearingUser = {
			role: user.role,
			roles: [...roles],
		};
		return getGrantedRoles(roleBearingUser)
			.map(toRoleKey)
			.filter((role): role is RoleKey => Boolean(role));
	}, [roles, user.role]);
	const normalizedRoles = Array.from(new Set(grantedRoles));
	const [selectedRole, setSelectedRole] = useState<RoleKey>(() => normalizedRoles[0] ?? "camper");
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const activeRole = normalizedRoles.includes(selectedRole)
		? selectedRole
		: (normalizedRoles[0] ?? "camper");
	const config = dashboards[activeRole];
	const {
		items: hostCampsites,
		isLoading: isLoadingHostCampsites,
		error: hostCampsitesError,
	} = useHostCampsites(activeRole === "host");
	const handleCamperNav = (navKey: string) => {
		if (navKey === "profile") {
			onOpenProfile?.();
		}
	};

	return (
		<div className="min-h-screen bg-[#f4f7f2] font-sans text-[#10221b] antialiased">
			<div className="fixed inset-y-0 left-0 z-30 hidden lg:flex">
				{activeRole === "camper" ? (
					<CamperSidebar
						profile={profile}
						activeNav="overview"
						onNavigate={handleCamperNav}
						onLogout={onLogout}
					/>
				) : (
					<Sidebar
						config={config}
						grantedRoles={normalizedRoles}
						activeRole={activeRole}
						onRoleChange={setSelectedRole}
						profile={profile}
						onOpenProfile={onOpenProfile}
						onLogout={onLogout}
					/>
				)}
			</div>

			{mobileMenuOpen && (
				<div className="fixed inset-0 z-50 lg:hidden">
					<button
						type="button"
						aria-label="Đóng menu dashboard"
						onClick={() => setMobileMenuOpen(false)}
						className="absolute inset-0 bg-[#10221b]/45"
					/>
					<div className="relative z-10 h-full shadow-2xl">
						{activeRole === "camper" ? (
							<CamperSidebar
								profile={profile}
								activeNav="overview"
								onLogout={onLogout}
								onNavigate={(navKey) => {
									handleCamperNav(navKey);
									setMobileMenuOpen(false);
								}}
							/>
						) : (
							<Sidebar
								config={config}
								grantedRoles={normalizedRoles}
								activeRole={activeRole}
								onRoleChange={(role) => {
									setSelectedRole(role);
									setMobileMenuOpen(false);
								}}
								onClose={() => setMobileMenuOpen(false)}
								profile={profile}
								onOpenProfile={onOpenProfile}
								onLogout={onLogout}
							/>
						)}
					</div>
				</div>
			)}

			<div className={`min-h-screen ${activeRole === "camper" ? "lg:pl-64" : "lg:pl-72"}`}>
				<header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#dfe8df] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
					<button
						type="button"
						onClick={() => setMobileMenuOpen(true)}
						aria-label="Mở menu dashboard"
						className="rounded-xl border border-[#dfe8df] p-2.5 text-[#164027] transition hover:bg-[#f1f5f0]"
					>
						<Menu className="size-5" />
					</button>
					<div className="flex items-center gap-2.5">
						<div
							className="flex size-9 items-center justify-center rounded-lg text-white"
							style={{ backgroundColor: config.accent }}
						>
							<LayoutDashboard className="size-5" />
						</div>
						<p className="font-extrabold">{config.productLabel}</p>
					</div>
				</header>

				<DashboardMain
					config={config}
					user={user}
					profile={profile}
					hostCampsites={hostCampsites}
					isLoadingHostCampsites={isLoadingHostCampsites}
					hostCampsitesError={hostCampsitesError}
					onOpenProfile={onOpenProfile}
					onOpenAdminUsers={onOpenAdminUsers}
					onCreateCampsite={onCreateCampsite}
					onCreateTrekkingRoute={onCreateTrekkingRoute}
					onViewTrekkingRoutes={onViewTrekkingRoutes}
					onEditCampsite={onEditCampsite}
				/>
			</div>
		</div>
	);
};
