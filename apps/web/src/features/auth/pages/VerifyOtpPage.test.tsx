import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { authService } from "../services/auth.service";
import { getVerifyRegistration, setVerifyRegistration } from "../utils/verifyRegistrationStorage";
import { VerifyOtpPage } from "./VerifyOtpPage";

// Mock at the service boundary (same convention as RegisterPage.test.tsx) —
// this is a Component Test: VerifyOtpPage's visible behavior in response to
// what its service dependency returns, not a real network call.
vi.mock("../services/auth.service", () => ({
	authService: {
		verifyOtp: vi.fn(),
		sendOtp: vi.fn(),
		resendOtp: vi.fn(),
	},
}));

const verifyOtpMock = vi.mocked(authService.verifyOtp);
const sendOtpMock = vi.mocked(authService.sendOtp);
const resendOtpMock = vi.mocked(authService.resendOtp);

const CONTEXT = {
	userId: "11111111-1111-1111-1111-111111111111",
	email: "camper@example.com",
	phone: "+84912345678",
};

const VERIFY_SUCCESS_RESPONSE = {
	id: CONTEXT.userId,
	email: CONTEXT.email,
	phone: CONTEXT.phone,
	role: "camper" as const,
	status: "active" as const,
	createdAt: new Date().toISOString(),
};

const SEND_SUCCESS_RESPONSE = {
	...VERIFY_SUCCESS_RESPONSE,
	status: "pending_verification" as const,
};

function renderPage(overrides: Partial<Parameters<typeof VerifyOtpPage>[0]> = {}) {
	const onBackToHome = vi.fn();
	const onNavigateToLogin = vi.fn();
	const onNavigateToRegister = vi.fn();
	render(
		<VerifyOtpPage
			onBackToHome={onBackToHome}
			onNavigateToLogin={onNavigateToLogin}
			onNavigateToRegister={onNavigateToRegister}
			{...overrides}
		/>
	);
	return { onBackToHome, onNavigateToLogin, onNavigateToRegister };
}

function sendButton() {
	return screen.getByRole("button", { name: /gửi mã otp|gửi lại mã|đang gửi/i });
}

function verifyButton() {
	// Exact match -- a loose /xác minh/i regex also matches the channel
	// selector buttons ("Xác minh qua SĐT" / "Xác minh qua Email").
	return screen.getByRole("button", { name: "Xác minh" });
}

function otpInput() {
	return screen.getByLabelText("Mã OTP *");
}

function phoneChannelButton() {
	return screen.getByRole("button", { name: /xác minh qua sđt/i });
}

function emailChannelButton() {
	return screen.getByRole("button", { name: /xác minh qua email/i });
}

describe("VerifyOtpPage", () => {
	beforeEach(() => {
		verifyOtpMock.mockReset();
		sendOtpMock.mockReset();
		resendOtpMock.mockReset();
		sessionStorage.clear();
	});

	// TC1 — No registration context (direct visit / reload after storage
	// cleared) redirects back to RegisterPage instead of rendering a form.
	it("redirects to RegisterPage when there is no registration context in sessionStorage", () => {
		const { onNavigateToRegister } = renderPage();

		expect(onNavigateToRegister).toHaveBeenCalledTimes(1);
		expect(screen.queryByText("Xác minh tài khoản")).not.toBeInTheDocument();
	});

	// TC2 — Decision Gate (First OTP Trigger, Option B): no API call on mount,
	// OTP input and Verify button start disabled, and the send button stays
	// disabled until a verification method is chosen.
	it("does not call sendOtp/resendOtp on mount and keeps everything disabled until a channel is chosen", () => {
		setVerifyRegistration(CONTEXT);
		renderPage();

		expect(sendOtpMock).not.toHaveBeenCalled();
		expect(resendOtpMock).not.toHaveBeenCalled();
		expect(otpInput()).toBeDisabled();
		expect(verifyButton()).toBeDisabled();
		expect(sendButton()).toBeDisabled();
		expect(sendButton()).toHaveTextContent("Gửi mã OTP");
	});

	// TC3 — Choosing a channel enables the send button; clicking it calls
	// sendOtp() (first send) with the stored userId + chosen channel, then
	// enables the OTP input and starts the resend cooldown.
	it("calls sendOtp with userId and the chosen phone channel, then enables the OTP input", async () => {
		const user = userEvent.setup();
		setVerifyRegistration(CONTEXT);
		sendOtpMock.mockResolvedValueOnce(SEND_SUCCESS_RESPONSE);
		renderPage();

		expect(sendButton()).toBeDisabled();
		await user.click(phoneChannelButton());
		expect(sendButton()).toBeEnabled();
		await user.click(sendButton());

		await waitFor(() => expect(sendOtpMock).toHaveBeenCalledTimes(1));
		expect(sendOtpMock).toHaveBeenCalledWith({ userId: CONTEXT.userId, channel: "phone" });
		expect(resendOtpMock).not.toHaveBeenCalled();
		expect(await screen.findByLabelText("Mã OTP *")).toBeEnabled();
		expect(sendButton()).toBeDisabled();
		expect(sendButton()).toHaveTextContent(/gửi lại mã \(60s\)/i);
	});

	it("calls sendOtp with the email channel when Email is chosen instead", async () => {
		const user = userEvent.setup();
		setVerifyRegistration(CONTEXT);
		sendOtpMock.mockResolvedValueOnce(SEND_SUCCESS_RESPONSE);
		renderPage();

		await user.click(emailChannelButton());
		await user.click(sendButton());

		await waitFor(() =>
			expect(sendOtpMock).toHaveBeenCalledWith({ userId: CONTEXT.userId, channel: "email" })
		);
	});

	// TC4 — Resend limit reached (409, BR-007) on the very first send: error is
	// shown, and the form stays locked (hasSentCode never becomes true).
	it("shows the resend-limit error and keeps the form locked when the first send is rejected with 409", async () => {
		const user = userEvent.setup();
		setVerifyRegistration(CONTEXT);
		sendOtpMock.mockRejectedValueOnce(
			new HttpError("OTP resend limit reached, try again later", 409, {
				statusCode: 409,
				message: "OTP resend limit reached, try again later",
				error: "Conflict",
			})
		);
		renderPage();

		await user.click(phoneChannelButton());
		await user.click(sendButton());

		expect(
			await screen.findByText("OTP resend limit reached, try again later")
		).toBeInTheDocument();
		expect(otpInput()).toBeDisabled();
	});

	// TC5 — Network error mapping (no HttpError instance) on send.
	it("shows a generic error when sendOtp fails with a non-HTTP (network) error", async () => {
		const user = userEvent.setup();
		setVerifyRegistration(CONTEXT);
		sendOtpMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		renderPage();

		await user.click(phoneChannelButton());
		await user.click(sendButton());

		expect(await screen.findByText("Failed to fetch")).toBeInTheDocument();
	});

	async function sendCodeAndType(user: ReturnType<typeof userEvent.setup>, code: string) {
		sendOtpMock.mockResolvedValueOnce(SEND_SUCCESS_RESPONSE);
		await user.click(phoneChannelButton());
		await user.click(sendButton());
		const input = await screen.findByLabelText("Mã OTP *");
		await waitFor(() => expect(input).toBeEnabled());
		await user.type(input, code);
	}

	// TC5b — After a successful first send and once the cooldown elapses,
	// pressing the button again calls resendOtp() (not sendOtp()) — same
	// payload shape, different route (Decision Gate #1 from the Tech Lead
	// review: two endpoints, one shared underlying capability).
	it("calls resendOtp (not sendOtp again) once the cooldown elapses and the button is pressed a second time", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const user = userEvent.setup();
		setVerifyRegistration(CONTEXT);
		sendOtpMock.mockResolvedValueOnce(SEND_SUCCESS_RESPONSE);
		renderPage();

		await user.click(phoneChannelButton());
		await user.click(sendButton());
		await waitFor(() => expect(sendOtpMock).toHaveBeenCalledTimes(1));

		resendOtpMock.mockResolvedValueOnce(SEND_SUCCESS_RESPONSE);
		vi.advanceTimersByTime(60_000);
		await waitFor(() => expect(sendButton()).toBeEnabled());
		await user.click(sendButton());

		await waitFor(() => expect(resendOtpMock).toHaveBeenCalledTimes(1));
		expect(resendOtpMock).toHaveBeenCalledWith({ userId: CONTEXT.userId, channel: "phone" });
		expect(sendOtpMock).toHaveBeenCalledTimes(1); // still just the first call

		vi.useRealTimers();
	});

	// TC6 — Wrong OTP (409): error shown, entered code preserved, no navigation.
	it("shows the incorrect-OTP error and keeps the entered code on a 409 from verify", async () => {
		const user = userEvent.setup();
		setVerifyRegistration(CONTEXT);
		const { onNavigateToLogin } = renderPage();
		await sendCodeAndType(user, "000000");

		verifyOtpMock.mockRejectedValueOnce(
			new HttpError("Incorrect OTP", 409, {
				statusCode: 409,
				message: "Incorrect OTP",
				error: "Conflict",
			})
		);
		await user.click(verifyButton());

		expect(await screen.findByText("Incorrect OTP")).toBeInTheDocument();
		expect(otpInput()).toHaveValue("000000");
		expect(onNavigateToLogin).not.toHaveBeenCalled();
	});

	// TC7 — Expired OTP (409, distinct message from backend).
	it("shows the expired-OTP error on a 409 'OTP has expired' response", async () => {
		const user = userEvent.setup();
		setVerifyRegistration(CONTEXT);
		renderPage();
		await sendCodeAndType(user, "123456");

		verifyOtpMock.mockRejectedValueOnce(
			new HttpError("OTP has expired", 409, {
				statusCode: 409,
				message: "OTP has expired",
				error: "Conflict",
			})
		);
		await user.click(verifyButton());

		expect(await screen.findByText("OTP has expired")).toBeInTheDocument();
	});

	// TC8 — Loading state + prevent double submit while verify is in flight (BR-241 style guard).
	it("disables the Verify button and ignores repeated clicks while a verify request is pending", async () => {
		const user = userEvent.setup();
		setVerifyRegistration(CONTEXT);
		renderPage();
		await sendCodeAndType(user, "123456");

		verifyOtpMock.mockImplementationOnce(() => new Promise(() => {}));
		const button = verifyButton();
		await user.click(button);
		await user.click(button);
		await user.click(button);

		expect(verifyOtpMock).toHaveBeenCalledTimes(1);
		expect(await screen.findByRole("button", { name: /đang xác minh/i })).toBeDisabled();
	});

	// TC9 — Success: verify resolves, sessionStorage is cleared immediately,
	// but navigation to Login is delayed -- the user must see a confirmation
	// message first, not get yanked to a different page with no feedback.
	it("shows a success message immediately, then auto-navigates to Login only after the delay", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const user = userEvent.setup();
		setVerifyRegistration(CONTEXT);
		const { onNavigateToLogin } = renderPage();
		await sendCodeAndType(user, "123456");

		verifyOtpMock.mockResolvedValueOnce(VERIFY_SUCCESS_RESPONSE);
		await user.click(verifyButton());

		expect(await screen.findByText("Xác thực thành công!")).toBeInTheDocument();
		expect(getVerifyRegistration()).toBeNull();
		expect(onNavigateToLogin).not.toHaveBeenCalled();

		vi.advanceTimersByTime(2500);
		await waitFor(() => expect(onNavigateToLogin).toHaveBeenCalledTimes(1));

		vi.useRealTimers();
	});

	// TC10 — The success screen's own button lets an impatient user skip the
	// delay and navigate to Login immediately.
	it("navigates to Login immediately when the success screen's button is clicked", async () => {
		const user = userEvent.setup();
		setVerifyRegistration(CONTEXT);
		const { onNavigateToLogin } = renderPage();
		await sendCodeAndType(user, "123456");

		verifyOtpMock.mockResolvedValueOnce(VERIFY_SUCCESS_RESPONSE);
		await user.click(verifyButton());

		const goNowButton = await screen.findByRole("button", { name: /đến trang đăng nhập ngay/i });
		await user.click(goNowButton);

		expect(onNavigateToLogin).toHaveBeenCalledTimes(1);
	});
});
