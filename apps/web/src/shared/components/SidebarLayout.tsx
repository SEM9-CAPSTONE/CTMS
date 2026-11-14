import { Menu, X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Collapse } from "./Collapse";
import type { SidebarControls } from "./SidebarFrame";

interface SidebarLayoutProps {
	title: string;
	storageKey: string;
	allowMobile?: boolean;
	fixedViewport?: boolean;
	collapseMode?: "rail" | "hide";
	mobileBrand?: ReactNode;
	renderSidebar: (controls: SidebarControls) => ReactNode;
	children: ReactNode;
}

const TAB_STOP_SELECTOR =
	'a[href], button, input:not([type="hidden"]), select, textarea, summary, [contenteditable="true"], [tabindex]';

function keepTabInside(event: KeyboardEvent, scope: HTMLElement) {
	const stops = Array.from(scope.querySelectorAll<HTMLElement>(TAB_STOP_SELECTOR)).filter(
		(element) =>
			element.tabIndex >= 0 &&
			!element.matches(":disabled") &&
			!element.closest("[inert]") &&
			element.getClientRects().length > 0 &&
			getComputedStyle(element).visibility === "visible"
	);
	const first = stops[0] ?? scope;
	const last = stops.at(-1) ?? scope;
	const active = document.activeElement;
	const boundary = event.shiftKey ? first : last;
	if (!scope.contains(active) || active === scope || active === boundary || stops.length === 0) {
		event.preventDefault();
		(event.shiftKey ? last : first).focus();
	}
}

export function SidebarLayout({
	title,
	storageKey,
	allowMobile = false,
	fixedViewport = false,
	collapseMode = "rail",
	mobileBrand,
	renderSidebar,
	children,
}: SidebarLayoutProps) {
	const sidebarId = useId();
	const sidebarRegion = useRef<HTMLDivElement>(null);
	const contentRegion = useRef<HTMLDivElement>(null);
	const menuTrigger = useRef<HTMLButtonElement>(null);
	const [desktopCollapsed, setDesktopCollapsed] = useState(
		() => localStorage.getItem(storageKey) === "true"
	);
	const [mobileOpen, setMobileOpen] = useState(false);
	const showMobileMenu = allowMobile && mobileOpen;
	const collapsed = desktopCollapsed && !showMobileMenu;
	const hidesSidebar = collapseMode === "hide";
	const contentPadding = hidesSidebar
		? collapsed
			? "lg:pl-0"
			: "lg:pl-64"
		: collapsed
			? "lg:pl-[4.5rem]"
			: "lg:pl-72";

	useEffect(() => {
		const sidebar = sidebarRegion.current;
		const content = contentRegion.current;
		if (!showMobileMenu || !sidebar || !content) return;
		const trigger = menuTrigger.current;
		content.setAttribute("inert", "");
		const closeButton = sidebar.querySelector<HTMLButtonElement>('button[aria-label="Đóng menu"]');
		(closeButton ?? sidebar).focus();
		const desktopMedia = window.matchMedia?.("(min-width: 64rem)");
		const onResize = (event: MediaQueryListEvent) => {
			if (event.matches) setMobileOpen(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented || (event.key !== "Tab" && event.key !== "Escape")) return;
			const nativeModal = sidebar.querySelector<HTMLDialogElement>("dialog:modal");
			if (nativeModal) {
				if (event.key === "Tab") keepTabInside(event, nativeModal);
				return;
			}
			const nestedDialog = Array.from(
				sidebar.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')
			).at(-1);
			if (event.key === "Tab") {
				keepTabInside(event, nestedDialog ?? sidebar);
			} else if (!nestedDialog) {
				event.preventDefault();
				setMobileOpen(false);
			}
		};
		desktopMedia?.addEventListener("change", onResize);
		window.addEventListener("keydown", onKeyDown);
		return () => {
			desktopMedia?.removeEventListener("change", onResize);
			window.removeEventListener("keydown", onKeyDown);
			content.removeAttribute("inert");
			trigger?.focus();
		};
	}, [showMobileMenu]);

	const closeMobileMenu = () => setMobileOpen(false);
	const toggleSidebar = () => {
		const next = !desktopCollapsed;
		setDesktopCollapsed(next);
		localStorage.setItem(storageKey, String(next));
	};
	const sidebar = renderSidebar({
		collapsed,
		onToggle: toggleSidebar,
		onClose: showMobileMenu ? closeMobileMenu : undefined,
	});

	return (
		<div className="min-h-screen bg-brand-bg font-sans text-brand-dark antialiased">
			{showMobileMenu && (
				<button
					type="button"
					tabIndex={-1}
					aria-label="Đóng lớp phủ menu"
					onClick={closeMobileMenu}
					className="fixed inset-0 z-30 bg-brand-dark/45 lg:hidden"
				/>
			)}
			<div
				ref={sidebarRegion}
				id={sidebarId}
				role={showMobileMenu ? "dialog" : undefined}
				aria-label={showMobileMenu ? title : undefined}
				aria-modal={showMobileMenu || undefined}
				tabIndex={showMobileMenu ? -1 : undefined}
				data-sidebar-drawer={showMobileMenu ? "" : undefined}
				className={`fixed inset-y-0 left-0 z-40 h-dvh lg:z-30 lg:flex ${showMobileMenu ? "flex" : "hidden"}`}
			>
				{hidesSidebar ? (
					<Collapse isCollapsed={collapsed} onToggle={toggleSidebar} widthClass="w-64">
						{showMobileMenu && (
							<button
								type="button"
								aria-label="Đóng menu"
								onClick={closeMobileMenu}
								className="absolute top-3 -right-10 grid size-9 place-items-center rounded-lg bg-white text-brand-primary lg:hidden"
							>
								<X aria-hidden="true" className="size-5" />
							</button>
						)}
						{sidebar}
					</Collapse>
				) : (
					sidebar
				)}
			</div>
			<div
				ref={contentRegion}
				className={`${fixedViewport ? "flex h-dvh flex-col overflow-hidden" : "min-h-screen"} ${contentPadding}`}
			>
				{allowMobile ? (
					<header className="sidebar-header sticky top-0 z-20 bg-white/95 backdrop-blur lg:hidden">
						<button
							ref={menuTrigger}
							type="button"
							aria-label="Mở menu"
							aria-controls={sidebarId}
							aria-expanded={showMobileMenu}
							onClick={() => setMobileOpen(true)}
							className="rounded-xl border border-[#dfe8df] p-2 text-brand-primary hover:bg-brand-light"
						>
							<Menu aria-hidden="true" className="size-5" />
						</button>
						{mobileBrand ?? <span className="sidebar-brand-title">{title}</span>}
					</header>
				) : (
					<div className="grid min-h-dvh place-items-center p-6 text-center lg:hidden">
						<section className="max-w-md rounded-3xl border border-[#dfe8df] bg-white p-8 shadow-sm">
							<h1 className="text-xl font-bold text-brand-primary">
								Vui lòng mở CTMS trên máy tính
							</h1>
						</section>
					</div>
				)}
				{allowMobile ? children : <div className="hidden lg:block">{children}</div>}
			</div>
		</div>
	);
}
