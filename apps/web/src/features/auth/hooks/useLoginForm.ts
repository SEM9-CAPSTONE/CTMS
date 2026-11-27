import { useState } from "react";
import { HttpError } from "../../../core/api";
import { authService } from "../services/auth.service";
import type { LoginApiResponse, LoginFormData } from "../types";
import { formatAuthIdentifier, isValidEmail, isValidPhoneNumber } from "../utils/auth.utils";
import { markUserActivity } from "../utils/idleActivity";
import { setAccessToken, setRefreshToken, setStoredAuthUser } from "../utils/tokenStorage";

/** Data prepared from a failed submit, for LoginForm to render. */
export interface LoginSubmitError {
	status?: number;
	message: string;
	fieldErrors?: Array<{ field: string; errors: string[] }>;
}

/**
 * Specification Gap #11 (resolved): backend error messages ("Invalid
 * credentials" / "Account is not active") are English and stable, but not
 * shown directly to the user — mapped to fixed Vietnamese copy here instead.
 */
function mapLoginErrorMessage(status: number | undefined, backendMessage: string): string {
	if (status === 401) {
		if (backendMessage === "Account is not active") {
			return "Tài khoản của bạn chưa được kích hoạt. Vui lòng xác minh tài khoản trước khi đăng nhập.";
		}
		return "Email/số điện thoại hoặc mật khẩu không chính xác.";
	}
	if (status === 422) {
		return "Vui lòng kiểm tra lại thông tin đã nhập.";
	}
	return "Đăng nhập thất bại. Vui lòng thử lại.";
}

/** Vietnamese copy for "Đăng nhập bằng Google" failures (backend messages stay English). */
function mapGoogleLoginErrorMessage(status: number | undefined, backendMessage: string): string {
	if (status === 401) {
		if (backendMessage === "Account is not active") {
			return "Tài khoản của bạn đang bị khoá hoặc đã bị xoá nên không thể đăng nhập.";
		}
		if (backendMessage === "This e-mail is linked to another Google account") {
			return "Email này đã liên kết với một tài khoản Google khác. Vui lòng dùng đúng tài khoản Google đã liên kết hoặc đăng nhập bằng mật khẩu.";
		}
		return "Không xác minh được tài khoản Google. Vui lòng thử lại.";
	}
	if (status === 503) {
		return "Đăng nhập bằng Google hiện chưa được bật. Vui lòng đăng nhập bằng email hoặc số điện thoại.";
	}
	return "Đăng nhập bằng Google thất bại. Vui lòng thử lại.";
}

function toGoogleLoginSubmitError(error: unknown): LoginSubmitError {
	if (error instanceof HttpError) {
		return {
			status: error.status,
			message: mapGoogleLoginErrorMessage(error.status, error.message),
		};
	}
	return { message: mapGoogleLoginErrorMessage(undefined, "") };
}

function toLoginSubmitError(error: unknown): LoginSubmitError {
	if (error instanceof HttpError) {
		const body = error.errorData as { message?: unknown } | undefined;
		const fieldErrors = Array.isArray(body?.message)
			? (body.message as Array<{ field: string; errors: string[] }>)
			: undefined;
		return {
			status: error.status,
			message: mapLoginErrorMessage(error.status, error.message),
			fieldErrors,
		};
	}
	return { message: mapLoginErrorMessage(undefined, "") };
}

export function useLoginForm(onLoginSuccess?: (user: LoginApiResponse["user"]) => void) {
	const [showPassword, setShowPassword] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<LoginSubmitError | null>(null);
	const [loginResult, setLoginResult] = useState<LoginApiResponse | null>(null);
	const [formData, setFormData] = useState<LoginFormData>({
		identifier: "",
		password: "",
		rememberMe: false,
	});

	const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

	/** Same session handling for the password and the Google sign-in. */
	const applySession = (result: LoginApiResponse) => {
		setAccessToken(result.accessToken);
		setRefreshToken(result.refreshToken);
		setStoredAuthUser(result.user);
		markUserActivity();
		setLoginResult(result);
		onLoginSuccess?.(result.user);
	};

	/** Called with the ID token Google Identity Services returns after the Google button. */
	const handleGoogleCredential = async (idToken: string) => {
		if (isSubmitting) return;
		setSubmitError(null);
		setIsSubmitting(true);
		try {
			applySession(await authService.loginWithGoogle(idToken));
		} catch (error) {
			setSubmitError(toGoogleLoginSubmitError(error));
		} finally {
			setIsSubmitting(false);
		}
	};

	const updateField = (field: keyof LoginFormData, value: string | boolean) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const handleLoginSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		// BR-241: ignore additional submits while a request is already in flight.
		if (isSubmitting) {
			return;
		}

		setSubmitError(null);
		setIsSubmitting(true);

		try {
			const identifier = formatAuthIdentifier(formData.identifier);

			// Block only on wrong format, same as RegisterPage's approach — the
			// backend deliberately accepts either email or phone in one field.
			if (!isValidEmail(identifier) && !isValidPhoneNumber(identifier)) {
				setSubmitError({ message: "Email hoặc số điện thoại không đúng định dạng." });
				return;
			}

			const result = await authService.login({ identifier, password: formData.password });
			applySession(result);
		} catch (error) {
			// BR-242: entered data is left untouched (no reset), only the error is captured.
			setSubmitError(toLoginSubmitError(error));
		} finally {
			setIsSubmitting(false);
		}
	};

	return {
		formData,
		showPassword,
		isSubmitting,
		submitError,
		loginResult,
		togglePasswordVisibility,
		updateField,
		handleLoginSubmit,
		handleGoogleCredential,
	};
}
