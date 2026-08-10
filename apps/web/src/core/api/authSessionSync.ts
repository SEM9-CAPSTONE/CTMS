const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
/** Plain timestamp value, never a token or anything derived from one
 * (Security Constraint #3) -- its only job is to make the browser fire a
 * `storage` event in the other tabs. */
const SESSION_SIGNAL_KEY = "authSessionSignal";
const LOGIN_PATH = "/login";

/**
 * CTMS-04-T02, DG-01. `window.location.href` full reload -- the app has no
 * SPA router (`AppRoutes.tsx` is a bespoke pushState/switch component, not
 * React Router), and DG-01 explicitly rejected building a navigation
 * abstraction just for this story. A no-op if already on `/login`.
 */
function redirectToLogin(): void {
	if (window.location.pathname !== LOGIN_PATH) {
		window.location.href = LOGIN_PATH;
	}
}

/**
 * CTMS-04-T02, DG-01/DG-03/DG-04. Called by whichever tab itself detected
 * an unrecoverable session failure (`authRefresh.refreshAccessToken()`
 * rejected) -- clears both tokens, writes the cross-tab signal, then
 * redirects this tab to Login.
 *
 * This is the *only* function in this module allowed to write to
 * `localStorage` -- see `initAuthSessionSync()`'s doc comment for why that
 * split is what actually prevents a cross-tab ping-pong loop.
 */
export function clearAuthSessionAndRedirect(): void {
	localStorage.removeItem(ACCESS_TOKEN_KEY);
	localStorage.removeItem(REFRESH_TOKEN_KEY);
	localStorage.setItem(SESSION_SIGNAL_KEY, String(Date.now()));
	redirectToLogin();
}

/**
 * CTMS-04-T02, DG-04. Registers a `storage` listener for the lifetime of
 * the page. Call once at app startup (main.tsx) -- plain module-level
 * side effect, not a React effect (DG-02: no Context/state-management
 * framework), so it needs no cleanup/unmount handling.
 *
 * Loop prevention: the browser only ever fires `storage` in *other*
 * tabs/windows of the same origin, never in the tab whose own script made
 * the write -- a native guarantee of the Web Storage API, not something
 * reimplemented here. Combined with the fact that this handler *only
 * redirects and never writes to localStorage*, there is no code path for
 * it to produce another `storage` event for any other tab to react to --
 * the ping-pong the frozen Decision Gate warned about structurally cannot
 * occur.
 */
export function initAuthSessionSync(): void {
	window.addEventListener("storage", (event: StorageEvent) => {
		if (event.key !== SESSION_SIGNAL_KEY) {
			return;
		}
		redirectToLogin();
	});
}
