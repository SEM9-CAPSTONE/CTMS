import type React from "react";
import { useMemo, useState } from "react";
import { HttpError } from "../../../core/api";
import { authService } from "../services/auth.service";
import type { OtpChannel } from "../types";
import { formatAuthIdentifier, isValidEmail, isValidPhoneNumber } from "../utils/auth.utils";

type ForgotPasswordStep = "request" | "reset" | "success";

interface ForgotPasswordError {
	message: string;
}

interface ForgotPasswordFormData {
	identifier: string;
	channel: OtpChannel;
	code: string;
	newPassword: string;
	confirmPassword: string;
}

const SUCCESS_REDIRECT_DELAY_MS = 1200;

function mapResetError(error: unknown): ForgotPasswordError {
	if (error instanceof HttpError) {
		if (error.status === 409) {
			return { message: "Mã xác minh đã hết hạn hoặc không chính xác. Vui lòng yêu cầu mã mới." };
		}
		if (error.status === 404) {
			return { message: "Không thể đặt lại mật khẩu với thông tin này. Vui lòng yêu cầu mã mới." };
		}
		if (error.status === 422) {
			return { message: "Vui lòng kiểm tra lại mã xác minh và mật khẩu mới." };
		}
	}
	return { message: "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại." };
}

function mapRequestError(error: unknown): ForgotPasswordError {
	if (error instanceof HttpError) {
		if (error.status === 422) {
			return { message: "Vui lòng kiểm tra lại email/số điện thoại và kênh nhận mã." };
		}
		if (error.status === 409 || error.status === 429) {
			return { message: "Bạn đã yêu cầu mã quá nhiều lần. Vui lòng thử lại sau." };
		}
	}
	return { message: "Không thể gửi mã xác minh lúc này. Vui lòng thử lại." };
}

function passwordChecks(password: string) {
	return {
		length: password.length >= 8 && password.length <= 128,
		letter: /[A-Za-z]/.test(password),
		number: /[0-9]/.test(password),
	};
}

export function useForgotPasswordForm(onNavigateToLogin: () => void) {
	const [step, setStep] = useState<ForgotPasswordStep>("request");
	const [isRequesting, setIsRequesting] = useState(false);
	const [isResetting, setIsResetting] = useState(false);
	const [requestMessage, setRequestMessage] = useState<string | null>(null);
	const [submitError, setSubmitError] = useState<ForgotPasswordError | null>(null);
	const [showPassword, setShowPassword] = useState(false);
	const [formData, setFormData] = useState<ForgotPasswordFormData>({
		identifier: "",
		channel: "email",
		code: "",
		newPassword: "",
		confirmPassword: "",
	});

	const normalizedIdentifier = useMemo(
		() => formatAuthIdentifier(formData.identifier),
		[formData.identifier]
	);

	const policy = useMemo(() => passwordChecks(formData.newPassword), [formData.newPassword]);

	const updateField = <K extends keyof ForgotPasswordFormData>(
		field: K,
		value: ForgotPasswordFormData[K]
	) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const validateIdentifier = () => {
		if (!normalizedIdentifier) {
			setSubmitError({ message: "Email hoặc số điện thoại là bắt buộc." });
			return false;
		}
		if (!isValidEmail(normalizedIdentifier) && !isValidPhoneNumber(normalizedIdentifier)) {
			setSubmitError({ message: "Email hoặc số điện thoại không đúng định dạng." });
			return false;
		}
		return true;
	};

	const validateReset = () => {
		if (!formData.code.trim()) {
			setSubmitError({ message: "Mã xác minh là bắt buộc." });
			return false;
		}
		if (!policy.length || !policy.letter || !policy.number) {
			setSubmitError({ message: "Mật khẩu mới chưa đáp ứng chính sách bảo mật." });
			return false;
		}
		if (formData.newPassword !== formData.confirmPassword) {
			setSubmitError({ message: "Mật khẩu xác nhận không khớp." });
			return false;
		}
		return true;
	};

	const handleRequestSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (isRequesting || !validateIdentifier()) {
			return;
		}

		setSubmitError(null);
		setIsRequesting(true);
		try {
			await authService.forgotPassword({
				identifier: normalizedIdentifier,
				channel: formData.channel,
			});
			setRequestMessage("Nếu tài khoản đang hoạt động, mã xác minh đã được gửi tới kênh bạn chọn.");
			setStep("reset");
		} catch (error) {
			setSubmitError(mapRequestError(error));
		} finally {
			setIsRequesting(false);
		}
	};

	const handleResetSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (isResetting || !validateIdentifier() || !validateReset()) {
			return;
		}

		setSubmitError(null);
		setIsResetting(true);
		try {
			await authService.resetPassword({
				identifier: normalizedIdentifier,
				code: formData.code.trim(),
				newPassword: formData.newPassword,
			});
			setStep("success");
			window.setTimeout(onNavigateToLogin, SUCCESS_REDIRECT_DELAY_MS);
		} catch (error) {
			setSubmitError(mapResetError(error));
		} finally {
			setIsResetting(false);
		}
	};

	const requestNewCode = async () => {
		if (isRequesting || !validateIdentifier()) {
			return;
		}

		setSubmitError(null);
		setIsRequesting(true);
		try {
			await authService.forgotPassword({
				identifier: normalizedIdentifier,
				channel: formData.channel,
			});
			setRequestMessage(
				"Nếu tài khoản đang hoạt động, mã xác minh mới đã được gửi tới kênh bạn chọn."
			);
		} catch (error) {
			setSubmitError(mapRequestError(error));
		} finally {
			setIsRequesting(false);
		}
	};

	return {
		step,
		formData,
		policy,
		showPassword,
		isRequesting,
		isResetting,
		requestMessage,
		submitError,
		setShowPassword,
		updateField,
		handleRequestSubmit,
		handleResetSubmit,
		requestNewCode,
	};
}
