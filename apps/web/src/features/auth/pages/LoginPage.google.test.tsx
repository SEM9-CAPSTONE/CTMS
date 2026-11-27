import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { authService } from "../services/auth.service";
import { getAccessToken, getRefreshToken, getStoredAuthUser } from "../utils/tokenStorage";
import { LoginPage } from "./LoginPage";

vi.mock("../services/auth.service", () => ({
	authService: { login: vi.fn(), loginWithGoogle: vi.fn() },
}));

const loginWithGoogleMock = vi.mocked(authService.loginWithGoogle);

const SESSION = {
	accessToken: "google-access",
	refreshToken: "google-refresh",
	user: {
		id: "0b6c7c0e-1d7f-4c62-9f0a-0b3c6f1d2a11",
		email: "hoa.nguyen@gmail.com",
		phone: null,
		role: "camper" as const,
		roles: ["camper" as const],
		status: "active" as const,
		createdAt: new Date().toISOString(),
	},
};

/** Fake Google Identity Services: remembers the callback so a test can "sign in". */
function installFakeGoogle() {
	const state: { callback?: (response: { credential?: string }) => void; clientId?: string } = {};
	window.google = {
		accounts: {
			id: {
				initialize: (config) => {
					state.callback = config.callback;
					state.clientId = config.client_id;
				},
				renderButton: (parent) => {
					parent.innerHTML = "<button>Đăng nhập bằng Google</button>";
				},
			},
		},
	};
	return state;
}

describe("LoginPage – Đăng nhập bằng Google", () => {
	beforeEach(() => {
		loginWithGoogleMock.mockReset();
		localStorage.clear();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		window.google = undefined;
	});

	it("hides the Google option when no client id is configured", () => {
		vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
		render(<LoginPage onBackToHome={vi.fn()} onNavigateToRegister={vi.fn()} />);
		expect(screen.queryByTestId("google-sign-in")).not.toBeInTheDocument();
		expect(screen.queryByText("Hoặc đăng nhập bằng")).not.toBeInTheDocument();
	});

	it("signs in with the Google credential and stores the session", async () => {
		vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "web-client.apps.googleusercontent.com");
		const google = installFakeGoogle();
		loginWithGoogleMock.mockResolvedValue(SESSION);
		const onLoginSuccess = vi.fn();
		render(
			<LoginPage
				onBackToHome={vi.fn()}
				onNavigateToRegister={vi.fn()}
				onLoginSuccess={onLoginSuccess}
			/>
		);

		await waitFor(() => expect(google.callback).toBeDefined());
		expect(google.clientId).toBe("web-client.apps.googleusercontent.com");
		expect(screen.getByText("Đăng nhập bằng Google")).toBeInTheDocument();

		await act(async () => google.callback?.({ credential: "google-id-token" }));

		expect(loginWithGoogleMock).toHaveBeenCalledWith("google-id-token");
		await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledWith(SESSION.user));
		expect(getAccessToken()).toBe("google-access");
		expect(getRefreshToken()).toBe("google-refresh");
		expect(getStoredAuthUser()?.email).toBe("hoa.nguyen@gmail.com");
	});

	it("explains a suspended account in Vietnamese", async () => {
		vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "web-client.apps.googleusercontent.com");
		const google = installFakeGoogle();
		loginWithGoogleMock.mockRejectedValue(new HttpError("Account is not active", 401, {}));
		render(<LoginPage onBackToHome={vi.fn()} onNavigateToRegister={vi.fn()} />);

		await waitFor(() => expect(google.callback).toBeDefined());
		await act(async () => google.callback?.({ credential: "google-id-token" }));

		expect(
			await screen.findByText(
				"Tài khoản của bạn đang bị khoá hoặc đã bị xoá nên không thể đăng nhập."
			)
		).toBeInTheDocument();
		expect(getAccessToken()).toBeNull();
	});
});
