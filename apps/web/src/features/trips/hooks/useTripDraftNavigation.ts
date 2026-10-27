import { useEffect } from "react";
import { BEFORE_NAVIGATE, type BeforeNavigateDetail } from "../../../core/navigation-guard";
export function useTripDraftNavigation(enabled: boolean, save: () => Promise<boolean>) {
	useEffect(() => {
		if (!enabled) return;
		const current = window.location.href;
		const beforeNavigate = (event: Event) => {
			if (!window.localStorage.getItem("accessToken")) return;
			event.preventDefault();
			const detail = (event as CustomEvent<BeforeNavigateDetail>).detail;
			// popstate has already moved the URL. Keep the form address until persistence succeeds.
			const destination = window.location.href;
			if (destination !== current) window.history.replaceState(null, "", current);
			void save().then((saved) => {
				if (!saved) {
					if (destination !== current) {
						window.history.replaceState(null, "", destination);
						window.history.pushState(null, "", current);
					}
					return;
				}
				if (destination !== current) window.history.replaceState(null, "", destination);
				detail.proceed();
			});
		};
		window.addEventListener(BEFORE_NAVIGATE, beforeNavigate);
		return () => window.removeEventListener(BEFORE_NAVIGATE, beforeNavigate);
	}, [enabled, save]);
}
