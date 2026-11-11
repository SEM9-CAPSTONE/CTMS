export const BEFORE_NAVIGATE = "ctms:before-navigate";
export interface BeforeNavigateDetail {
	proceed: () => void;
}
export function guardedNavigation(proceed: () => void): void {
	const event = new CustomEvent<BeforeNavigateDetail>(BEFORE_NAVIGATE, {
		cancelable: true,
		detail: { proceed },
	});
	if (window.dispatchEvent(event)) proceed();
}
