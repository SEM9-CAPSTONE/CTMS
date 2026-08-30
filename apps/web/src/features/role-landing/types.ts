import type React from "react";
import type { StoredAuthUser } from "../auth/utils/tokenStorage";

export type RoleKey = "camper" | "host" | "porter" | "admin";

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
	onExplore?: () => void;
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export interface SidebarItem {
	key: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	disabled?: boolean;
}

export interface Metric {
	label: string;
	value: string;
	helper: string;
	tone: "green" | "blue" | "amber" | "red" | "purple";
	icon: React.ComponentType<{ className?: string }>;
}

export interface TimelineItem {
	time: string;
	title: string;
	description: string;
	status: string;
}

export interface DashboardConfig {
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
