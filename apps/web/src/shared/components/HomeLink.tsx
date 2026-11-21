import type React from "react";
import { RoutePath } from "../../routes/routes.config";

export interface HomeLinkProps {
	children: React.ReactNode;
	className?: string;
	href?: RoutePath;
	label?: string;
	onNavigate?: () => void;
}

/**
 * Wraps the CTMS brand (logo + name) with the destination for the current layout.
 * A plain click navigates in-app (no reload); modified clicks keep native link
 * behaviour, e.g. Ctrl/Cmd+click opens the home page in a new tab.
 */
export function HomeLink({
	children,
	className = "",
	href = RoutePath.HOME,
	label,
	onNavigate,
}: HomeLinkProps) {
	const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
		const isModifiedClick =
			event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
		if (isModifiedClick) {
			return;
		}

		event.preventDefault();
		onNavigate?.();
		window.history.pushState({}, "", href);
		window.dispatchEvent(new PopStateEvent("popstate"));
	};

	return (
		<a
			href={href}
			onClick={handleClick}
			aria-label={label ?? "Về trang chủ CTMS"}
			title={label ?? "Về trang chủ"}
			className={`rounded-xl transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#164027]/30 ${className}`}
		>
			{children}
		</a>
	);
}
