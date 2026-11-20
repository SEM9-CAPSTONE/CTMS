import type { MouseEvent } from "react";
import { guardedNavigation } from "../../../core/navigation-guard";
import { RoutePath } from "../../../routes/routes.config";

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
}: { active: "profiles" | "certificates" | LevelTab; onSelect?: (tab: LevelTab) => void }) {
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
				<p className="mt-1 text-sm text-muted-foreground">
					Xem hồ sơ, xét duyệt chứng chỉ và quản lý cấp độ người hỗ trợ.
				</p>
			</div>
			<nav
				aria-label="Quản lý người hỗ trợ"
				className="flex overflow-x-auto border-b border-[#dfe8df]"
			>
				{tabs.map((tab) => {
					const activeNow = isTabActive(tab.key);
					return (
						<a
							key={tab.key}
							href={tab.path}
							onClick={(event) => {
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
							{tab.label}
						</a>
					);
				})}
			</nav>
		</header>
	);
}
