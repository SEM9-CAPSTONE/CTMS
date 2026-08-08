import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { authService } from "../services/auth.service";
import { ForgotPasswordPage } from "./ForgotPasswordPage";

vi.mock("../services/auth.service", () => ({
	authService: {
		forgotPassword: vi.fn(),
		resetPassword: vi.fn(),
	},
}));

const forgotPasswordMock = vi.mocked(authService.forgotPassword);
const resetPasswordMock = vi.mocked(authService.resetPassword);

function renderPage(onNavigateToLogin = vi.fn()) {
	return {
		onNavigateToLogin,
		onBackToHome: vi.fn(),
		...render(<ForgotPasswordPage onBackToHome={vi.fn()} onNavigateToLogin={onNavigateToLogin} />),
	};
}

async function requestCode(
	user: ReturnType<typeof userEvent.setup>,
	identifier = "camper@ctms.local"
) {
	await user.type(screen.getByLabelText("Email hoặc số điện thoại"), identifier);
	await user.click(screen.getByRole("button", { name: /^Gửi mã xác minh$/i }));
}

async function moveToResetStep(user: ReturnType<typeof userEvent.setup>) {
	forgotPasswordMock.mockResolvedValueOnce({ requestAccepted: true });
	renderPage();
	await requestCode(user);
	await screen.findByText(/Nếu tài khoản đang hoạt động/i);
}

async function fillValidReset(user: ReturnType<typeof userEvent.setup>) {
	await user.type(screen.getByLabelText("Mã xác minh"), "123456");
	await user.type(screen.getByLabelText("Mật khẩu mới"), "NewPass123");
	await user.type(screen.getByLabelText("Xác nhận mật khẩu"), "NewPass123");
}

describe("ForgotPasswordPage", () => {
	beforeEach(() => {
		forgotPasswordMock.mockReset();
		resetPasswordMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("renders the request step before any OTP is requested", () => {
		renderPage();

		expect(screen.getByRole("heading", { name: "Đặt lại mật khẩu" })).toBeInTheDocument();
		expect(screen.getByText(/Chưa có mã xác minh/i)).toBeInTheDocument();
		expect(screen.getByLabelText("Email hoặc số điện thoại")).toBeInTheDocument();
	});

	it("validates identifier format before calling forgotPassword", async () => {
		const user = userEvent.setup();
		renderPage();

		await requestCode(user, "invalid-id");

		expect(
			await screen.findByText("Email hoặc số điện thoại không đúng định dạng.")
		).toBeInTheDocument();
		expect(forgotPasswordMock).not.toHaveBeenCalled();
	});

	it("requests an OTP and moves to the verification/new-password step", async () => {
		const user = userEvent.setup();
		forgotPasswordMock.mockResolvedValueOnce({ requestAccepted: true });
		renderPage();

		await requestCode(user, "  Camper@CTMS.local  ");

		await waitFor(() => expect(forgotPasswordMock).toHaveBeenCalledTimes(1));
		expect(forgotPasswordMock).toHaveBeenCalledWith({
			identifier: "camper@ctms.local",
			channel: "email",
		});
		expect(await screen.findByLabelText("Mã xác minh")).toBeInTheDocument();
		expect(screen.getByLabelText("Mật khẩu mới")).toBeInTheDocument();
	});

	it("shows live password-policy feedback", async () => {
		const user = userEvent.setup();
		await moveToResetStep(user);

		await user.type(screen.getByLabelText("Mật khẩu mới"), "abc");

		expect(screen.getByText("8-128 ký tự")).toBeInTheDocument();
		expect(screen.getByText("Có ít nhất 1 chữ cái")).toBeInTheDocument();
		expect(screen.getByText("Có ít nhất 1 chữ số")).toBeInTheDocument();
	});

	it("maps expired or invalid reset codes to a user-facing error", async () => {
		const user = userEvent.setup();
		await moveToResetStep(user);
		resetPasswordMock.mockRejectedValueOnce(
			new HttpError("Invalid or expired reset code", 409, {
				statusCode: 409,
				message: "Invalid or expired reset code",
				error: "Conflict",
			})
		);

		await fillValidReset(user);
		await user.click(screen.getByRole("button", { name: /^Đặt lại mật khẩu$/i }));

		expect(
			await screen.findByText(
				"Mã xác minh đã hết hạn hoặc không chính xác. Vui lòng yêu cầu mã mới."
			)
		).toBeInTheDocument();
	});

	it("prevents repeated reset submissions while the request is pending", async () => {
		const user = userEvent.setup();
		await moveToResetStep(user);
		resetPasswordMock.mockImplementationOnce(() => new Promise(() => {}));

		await fillValidReset(user);
		const submit = screen.getByRole("button", { name: /^Đặt lại mật khẩu$/i });
		await user.click(submit);
		await user.click(submit);

		expect(resetPasswordMock).toHaveBeenCalledTimes(1);
	});

	it("shows success and redirects to login after reset succeeds", async () => {
		const user = userEvent.setup();
		const onNavigateToLogin = vi.fn();
		forgotPasswordMock.mockResolvedValueOnce({ requestAccepted: true });
		resetPasswordMock.mockResolvedValueOnce({ passwordReset: true });
		renderPage(onNavigateToLogin);

		await requestCode(user);
		await screen.findByLabelText("Mã xác minh");
		await fillValidReset(user);
		await user.click(screen.getByRole("button", { name: /^Đặt lại mật khẩu$/i }));

		expect(await screen.findByText("Mật khẩu đã được đặt lại")).toBeInTheDocument();
		await waitFor(() => expect(onNavigateToLogin).toHaveBeenCalledTimes(1), { timeout: 1600 });
	});
});
