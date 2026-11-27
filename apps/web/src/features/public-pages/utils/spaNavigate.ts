import type React from "react";

export function navigatePublicPath(path: string): void {
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	window.history.pushState({}, "", normalizedPath);
	window.dispatchEvent(new PopStateEvent("popstate"));
	window.dispatchEvent(new Event("ctms-navigation"));
	window.scrollTo({ top: 0, behavior: "auto" });
}

export function handlePublicLinkClick(
	event: React.MouseEvent<HTMLAnchorElement>,
	href: string
): void {
	if (
		event.defaultPrevented ||
		event.button !== 0 ||
		event.metaKey ||
		event.ctrlKey ||
		event.shiftKey ||
		event.altKey
	) {
		return;
	}
	event.preventDefault();
	navigatePublicPath(href);
}
