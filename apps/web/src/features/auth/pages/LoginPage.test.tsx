import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { authService } from "../services/auth.service";
import { getAccessToken, getRefreshToken } from "../utils/tokenStorage";
import { LoginPage } from "./LoginPage";

// Mock at the service boundary (not httpClient/fetch) — this is a Component
// Test: LoginPage's visible behavior in response to what its service
// dependency returns, not a real network call (that's covered by the
// separate E2E suite against the real backend).
vi.mock("../services/auth.service", () => ({
	authService: {
		login: vi.fn(),
	},
}));

const loginMock = vi.mocked(authService.login);

const SUCCESS_RESPONSE = {
	accessToken: "access-token-value",
	refreshToken: "refresh-token-value",
	user: {
		id: "6bb34ea0-cb3a-42d8-84ff-395c18864fcc",
		email: "admin@ctms.local",
		phone: "0900000000",
		role: "admin" as const,
		status: "active" as const,
		createdAt: new Date().toISOString(),
	},
};

const IDENTIFIER_PLACEHOLDER = "your@email.com hoặc 09xxxxxxxx";
const PASSWORD_PLACEHOLDER = "••••••••";

function submitButton() {
	return screen.getByRole("button", { name: /^đăng nhập$|^đang xử lý/i });
}

async function fillAndSubmit(
	user: ReturnType<typeof userEvent.setup>,
	identifier: string,
	password: string
) {
	await user.type(screen.getByPlaceholderText(IDENTIFIER_PLACEHOLDER), identifier);
	await user.type(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER), password);
	await user.click(submitButton());
}

describe("LoginPage", () => {
	beforeEach(() => {
		loginMock.mockReset();
		localStorage.clear();
	});

	// TC1 — Renders the login form by default
	it("renders the identifier and password fields", () => {
		render(<LoginPage onBackToHome={vi.fn()} onNavigateToRegister={vi.fn()} />);
		expect(screen.getByPlaceholderText(IDENTIFIER_PLACEHOLDER)).toBeInTheDocument();
		expect(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER)).toBeInTheDocument();
	});

	// TC2 — Successful login: normalized payload sent, success message shown,
	// tokens persisted (Decision Gate: localStorage).
	it("logs in with email and calls authService.login with the normalized payload", async () => {
		const user = userEvent.setup();
		loginMock.mockResolvedValueOnce(SUCCESS_RESPONSE);

		render(<LoginPage onBackToHome={vi.fn()} onNavigateToRegister={vi.fn()} />);
		await fillAndSubmit(user, "  Admin@CTMS.local  ", "Admin@123");

		await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1));
		expect(loginMock).toHaveBeenCalledWith({
			identifier: "admin@ctms.local",
			password: "Admin@123",
		});

		expect(await screen.findByText(/đăng nhập thành công/i)).toBeInTheDocument();
		expect(getAccessToken()).toBe("access-token-value");
		expect(getRefreshToken()).toBe("refresh-token-value");
	});

	// TC3 — Login with phone identifier is accepted (backend supports email OR phone)
	it("logs in with a phone number identifier", async () => {
		const user = userEvent.setup();
		loginMock.mockResolvedValueOnce(SUCCESS_RESPONSE);

		render(<LoginPage onBackToHome={vi.fn()} onNavigateToRegister={vi.fn()} />);
		await fillAndSubmit(user, "0912345678", "Admin@123");

		await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1));
		expect(loginMock).toHaveBeenCalledWith({ identifier: "0912345678", password: "Admin@123" });
	});

	// TC4 — Client-side validation: invalid identifier format blocks submit
	it("shows a validation error for an identifier that is neither an email nor a phone number, and does not call the API", async () => {
		const user = userEvent.setup();
		render(<LoginPage onBackToHome={vi.fn()} onNavigateToRegister={vi.fn()} />);
		await fillAndSubmit(user, "not-a-valid-identifier", "Admin@123");

		expect(
			await screen.findByText("Email hoặc số điện thoại không đúng định dạng.")
		).toBeInTheDocument();
		expect(loginMock).not.toHaveBeenCalled();
	});

	// TC5 — Prevent repeated submissions (BR-241)
	it("prevents a second submit while a request is already in flight", async () => {
		const user = userEvent.setup();
		let resolveLogin: (value: typeof SUCCESS_RESPONSE) => void = () => {};
		loginMock.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveLogin = resolve;
				})
		);

		render(<LoginPage onBackToHome={vi.fn()} onNavigateToRegister={vi.fn()} />);
		await user.type(screen.getByPlaceholderText(IDENTIFIER_PLACEHOLDER), "admin@ctms.local");
		await user.type(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER), "Admin@123");

		const button = submitButton();
		await user.click(button);
		await user.click(button);
		await user.click(button);

		expect(loginMock).toHaveBeenCalledTimes(1);
		resolveLogin(SUCCESS_RESPONSE);
	});

	// TC6 — Loading state (BR-241)
	it("disables the submit button and shows the loading label while the request is pending", async () => {
		const user = userEvent.setup();
		loginMock.mockImplementationOnce(() => new Promise(() => {}));

		render(<LoginPage onBackToHome={vi.fn()} onNavigateToRegister={vi.fn()} />);
		await user.type(screen.getByPlaceholderText(IDENTIFIER_PLACEHOLDER), "admin@ctms.local");
		await user.type(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER), "Admin@123");
		await user.click(submitButton());

		const loadingButton = await screen.findByRole("button", { name: /đang xử lý/i });
		expect(loadingButton).toBeDisabled();
	});

	// TC7 — 401 "Invalid credentials" mapped to Vietnamese copy (Spec Gap #11),
	// entered identifier preserved (BR-242).
	it("shows a Vietnamese error for invalid credentials and keeps the entered identifier", async () => {
		const user = userEvent.setup();
		loginMock.mockRejectedValueOnce(
			new HttpError("Invalid credentials", 401, {
				statusCode: 401,
				message: "Invalid credentials",
				error: "Unauthorized",
			})
		);

		render(<LoginPage onBackToHome={vi.fn()} onNavigateToRegister={vi.fn()} />);
		const identifierInput = screen.getByPlaceholderText(IDENTIFIER_PLACEHOLDER);
		await user.type(identifierInput, "admin@ctms.local");
		await user.type(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER), "WrongPass1");
		await user.click(submitButton());

		expect(
			await screen.findByText("Email/số điện thoại hoặc mật khẩu không chính xác.")
		).toBeInTheDocument();
		expect(identifierInput).toHaveValue("admin@ctms.local");
	});

	// TC8 — 401 "Account is not active" mapped to Vietnamese copy (Spec Gap #11)
	it("shows a Vietnamese error for a non-active account", async () => {
		const user = userEvent.setup();
		loginMock.mockRejectedValueOnce(
			new HttpError("Account is not active", 401, {
				statusCode: 401,
				message: "Account is not active",
				error: "Unauthorized",
			})
		);

		render(<LoginPage onBackToHome={vi.fn()} onNavigateToRegister={vi.fn()} />);
		await fillAndSubmit(user, "pending@ctms.local", "Verify@123");

		expect(
			await screen.findByText(
				"Tài khoản của bạn chưa được kích hoạt. Vui lòng xác minh tài khoản trước khi đăng nhập."
			)
		).toBeInTheDocument();
	});

	// TC9 — 422 validation error mapped to a generic Vietnamese message (Spec Gap #12: banner, not backend text)
	it("shows a generic validation message on a 422 response", async () => {
		const user = userEvent.setup();
		loginMock.mockRejectedValueOnce(
			new HttpError("Unprocessable Entity", 422, {
				statusCode: 422,
				error: "Unprocessable Entity",
				message: [{ field: "password", errors: ["password should not be empty"] }],
			})
		);

		render(<LoginPage onBackToHome={vi.fn()} onNavigateToRegister={vi.fn()} />);
		await fillAndSubmit(user, "admin@ctms.local", "Admin@123");

		expect(await screen.findByText("password should not be empty")).toBeInTheDocument();
	});

	// TC10 — No tokens are persisted when login fails
	it("does not persist tokens when login fails", async () => {
		const user = userEvent.setup();
		loginMock.mockRejectedValueOnce(
			new HttpError("Invalid credentials", 401, {
				statusCode: 401,
				message: "Invalid credentials",
				error: "Unauthorized",
			})
		);

		render(<LoginPage onBackToHome={vi.fn()} onNavigateToRegister={vi.fn()} />);
		await fillAndSubmit(user, "admin@ctms.local", "WrongPass1");

		await screen.findByText("Email/số điện thoại hoặc mật khẩu không chính xác.");
		expect(getAccessToken()).toBeNull();
		expect(getRefreshToken()).toBeNull();
	});
});
