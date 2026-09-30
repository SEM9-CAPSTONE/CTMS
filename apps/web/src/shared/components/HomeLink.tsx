import type React from "react";
import { RoutePath } from "../../routes/routes.config";

export interface HomeLinkProps {
	children: React.ReactNode;
	className?: string;
}

/**
 * Wraps the CTMS brand (logo + name) so it links back to the public home page.
 * A plain click navigates in-app (no reload); modified clicks keep native link
 * behaviour, e.g. Ctrl/Cmd+click opens the home page in a new tab.
 */
export function HomeLink({ children, className = "" }: HomeLinkProps) {
	const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
		const isModifiedClick =
			event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
		if (isModifiedClick) {
			return;
		}

		event.preventDefault();
		window.history.pushState({}, "", RoutePath.HOME);
		window.dispatchEvent(new PopStateEvent("popstate"));
	};

	return (
		<a
			href={RoutePath.HOME}
			onClick={handleClick}
			aria-label="Về trang chủ CTMS"
			title="Về trang chủ"
			className={`rounded-xl transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#164027]/30 ${className}`}
		>
			{children}
		</a>
	);
}
