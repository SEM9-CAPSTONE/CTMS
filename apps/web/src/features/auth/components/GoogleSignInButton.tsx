import { useEffect, useRef, useState } from "react";

/** Minimal shape of Google Identity Services used here (https://accounts.google.com/gsi/client). */
interface GoogleAccountsId {
	initialize: (config: {
		client_id: string;
		callback: (response: { credential?: string }) => void;
		ux_mode?: "popup" | "redirect";
	}) => void;
	renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void;
}

declare global {
	interface Window {
		google?: { accounts?: { id?: GoogleAccountsId } };
	}
}

const GSI_SRC = "https://accounts.google.com/gsi/client";
let gsiLoading: Promise<GoogleAccountsId> | null = null;

/** Loads the Google Identity Services script once per page. */
export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
	const ready = window.google?.accounts?.id;
	if (ready) return Promise.resolve(ready);
	if (gsiLoading) return gsiLoading;
	gsiLoading = new Promise<GoogleAccountsId>((resolve, reject) => {
		const script = document.createElement("script");
		script.src = GSI_SRC;
		script.async = true;
		script.defer = true;
		script.onload = () => {
			const api = window.google?.accounts?.id;
			if (api) resolve(api);
			else reject(new Error("Google Identity Services unavailable"));
		};
		script.onerror = () => {
			gsiLoading = null;
			reject(new Error("Google Identity Services failed to load"));
		};
		document.head.appendChild(script);
	});
	return gsiLoading;
}

/** Web OAuth client id; empty means "Đăng nhập bằng Google" is not configured. */
export function googleClientId(): string {
	return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? "";
}

interface GoogleSignInButtonProps {
	clientId: string;
	disabled?: boolean;
	onCredential: (idToken: string) => void;
}

/**
 * Google's official "Đăng nhập bằng Google" button (Google requires its own button or
 * One Tap to obtain an ID token). Shows a short Vietnamese note if the script cannot load.
 */
export function GoogleSignInButton({ clientId, disabled, onCredential }: GoogleSignInButtonProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const callbackRef = useRef(onCredential);
	const [failed, setFailed] = useState(false);
	callbackRef.current = onCredential;

	useEffect(() => {
		let cancelled = false;
		loadGoogleIdentity()
			.then((api) => {
				const container = containerRef.current;
				if (cancelled || !container) return;
				api.initialize({
					client_id: clientId,
					ux_mode: "popup",
					callback: (response) => {
						if (response.credential) callbackRef.current(response.credential);
					},
				});
				container.innerHTML = "";
				api.renderButton(container, {
					type: "standard",
					theme: "outline",
					size: "large",
					shape: "pill",
					text: "signin_with",
					logo_alignment: "center",
					locale: "vi",
					width: Math.min(Math.max(container.offsetWidth, 200), 400),
				});
			})
			.catch(() => {
				if (!cancelled) setFailed(true);
			});
		return () => {
			cancelled = true;
		};
	}, [clientId]);

	if (failed) {
		return (
			<p className="text-center text-xs font-medium text-[#8a9990]">
				Chưa tải được đăng nhập bằng Google. Vui lòng kiểm tra kết nối mạng.
			</p>
		);
	}

	return (
		<div
			ref={containerRef}
			data-testid="google-sign-in"
			aria-busy={disabled}
			className={`flex w-full justify-center ${disabled ? "pointer-events-none opacity-60" : ""}`}
		/>
	);
}
