import { type MouseEvent, useState } from "react";
import { guardedNavigation } from "../../../core/navigation-guard";
import { RoutePath } from "../../../routes/routes.config";
import { useAdminModerationCounts } from "../../admin-layout/hooks/useAdminModerationCounts";

const tabs = [
	{ key: "profiles", label: "Hồ sơ người hỗ trợ", path: RoutePath.ADMIN_PORTER_VERIFICATIONS },
	{ key: "certificates", label: "Duyệt chứng chỉ", path: RoutePath.ADMIN_PORTER_CERTIFICATES },
	{
		key: "levels",
		label: "Xét cấp độ",
		path: `${RoutePath.ADMIN_PORTER_LEVELS}?view=requests`,
	},
	{
		key: "policies",
		label: "Tiêu chí cấp độ",
		path: `${RoutePath.ADMIN_PORTER_LEVELS}?view=policies`,
	},
] as const;

/** Route-backed tabs preserve bookmarks, reloads and browser history. */
export type LevelTab = "levels" | "policies" | "requests" | "direct";

export function PorterManagementTabs({
	active,
	onSelect,
	hideLevelBadge = false,
}: {
	active: "profiles" | "certificates" | LevelTab;
	onSelect?: (tab: LevelTab) => void;
	hideLevelBadge?: boolean;
}) {
	const counts = useAdminModerationCounts();
	const [seenTabs, setSeenTabs] = useState<Record<string, boolean>>({});

	const badgeForTab = (tabKey: string): number => {
		if (seenTabs[tabKey]) return 0;
		if (tabKey === "profiles") return counts.data?.porterVerifications ?? 0;
		if (tabKey === "levels") return hideLevelBadge ? 0 : (counts.data?.porterLevelRequests ?? 0);
		return 0;
	};
	const navigate = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
			return;
		event.preventDefault();
		guardedNavigation(() => {
			if (window.location.pathname === path && !window.location.search) return;
			window.history.pushState({}, "", path);
			window.dispatchEvent(new PopStateEvent("popstate"));
		});
	};

	// Determine if this tab is active (requests and direct map to levels)
	const isTabActive = (tabKey: string) => {
		if (active === tabKey) return true;
		if (tabKey === "levels" && (active === "requests" || active === "direct")) return true;
		return false;
	};

	return (
		<header className="sticky top-0 z-30 space-y-4 bg-background/95 backdrop-blur-sm pt-2 pb-1">
			<div>
				<h1 className="text-2xl font-extrabold tracking-tight text-foreground">
					Quản lý người hỗ trợ
				</h1>
			</div>
			<nav
				aria-label="Quản lý người hỗ trợ"
				className="flex overflow-x-auto border-b border-[#dfe8df]"
			>
				{tabs.map((tab) => {
					const activeNow = isTabActive(tab.key);
					const badgeCount = badgeForTab(tab.key);
					return (
						<a
							key={tab.key}
							href={tab.path}
							onClick={(event) => {
								setSeenTabs((prev) => ({ ...prev, [tab.key]: true }));
								if (
									onSelect &&
									tab.key !== "profiles" &&
									tab.key !== "certificates" &&
									event.button === 0 &&
									!event.metaKey &&
									!event.ctrlKey &&
									!event.shiftKey &&
									!event.altKey
								) {
									event.preventDefault();
									onSelect(tab.key);
								} else navigate(event, tab.path);
							}}
							aria-current={activeNow ? "page" : undefined}
							className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
								activeNow
									? "border-[#164027] text-[#164027]"
									: "border-transparent text-[#667a6d] hover:text-[#10221b]"
							}`}
						>
							<span>{tab.label}</span>
							{badgeCount > 0 && (
								<span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
									{badgeCount}
								</span>
							)}
						</a>
					);
				})}
			</nav>
		</header>
	);
}
