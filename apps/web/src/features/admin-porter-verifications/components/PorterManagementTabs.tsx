import type { MouseEvent } from "react";
import { guardedNavigation } from "../../../core/navigation-guard";
import { RoutePath } from "../../../routes/routes.config";

const tabs = [
	{ key: "profiles", label: "Hồ sơ người hỗ trợ", path: RoutePath.ADMIN_PORTER_VERIFICATIONS },
	{
		key: "requests",
		label: "Yêu cầu nâng cấp",
		path: `${RoutePath.ADMIN_PORTER_LEVELS}?view=requests`,
	},
	{
		key: "direct",
		label: "Xét cấp trực tiếp",
		path: `${RoutePath.ADMIN_PORTER_LEVELS}?view=direct`,
	},
	{
		key: "policies",
		label: "Tiêu chí cấp độ",
		path: `${RoutePath.ADMIN_PORTER_LEVELS}?view=policies`,
	},
] as const;

/** Route-backed tabs preserve bookmarks, reloads and browser history. */
type LevelTab = "requests" | "direct" | "policies";
export function PorterManagementTabs({
	active,
	onSelect,
}: { active: "profiles" | LevelTab; onSelect?: (tab: LevelTab) => void }) {
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
	return (
		<header className="space-y-5">
			<div>
				<h1 className="text-2xl font-extrabold tracking-tight text-foreground">
					Quản lý người hỗ trợ
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">Xem hồ sơ và xét cấp theo từng tuyến.</p>
			</div>
			<nav
				aria-label="Quản lý người hỗ trợ"
				className="flex overflow-x-auto border-b border-[#dfe8df]"
			>
				{tabs.map((tab) => (
					<a
						key={tab.key}
						href={tab.path}
						onClick={(event) => {
							if (
								onSelect &&
								tab.key !== "profiles" &&
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
						aria-current={active === tab.key ? "page" : undefined}
						className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
							active === tab.key
								? "border-[#164027] text-[#164027]"
								: "border-transparent text-[#667a6d] hover:text-[#10221b]"
						}`}
					>
						{tab.label}
					</a>
				))}
			</nav>
		</header>
	);
}
