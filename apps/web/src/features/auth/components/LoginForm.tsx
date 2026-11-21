import { ArrowRight, Eye, EyeOff, Home, Lock, Mail } from "lucide-react";
import type React from "react";
import { AUTH_MESSAGES } from "../constants";
import { useLoginForm } from "../hooks/useLoginForm";
import type { LoginApiResponse } from "../types";
import { GoogleSignInButton, googleClientId } from "./GoogleSignInButton";

interface LoginFormProps {
	onBackToHome: () => void;
	onNavigateToRegister?: () => void;
	onNavigateToForgotPassword?: () => void;
	onLoginSuccess?: (user: LoginApiResponse["user"]) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
	onBackToHome,
	onNavigateToRegister,
	onNavigateToForgotPassword,
	onLoginSuccess,
}) => {
	const {
		formData,
		showPassword,
		isSubmitting,
		submitError,
		loginResult,
		togglePasswordVisibility,
		updateField,
		handleLoginSubmit,
		handleGoogleCredential,
	} = useLoginForm(onLoginSuccess);
	const googleId = googleClientId();
	const googleEnabled = googleId.length > 0;

	// 401 (Invalid credentials / Account is not active) -> banner; 422 -> flatten
	// backend's per-field errors, same pattern as RegisterPage's errorMessages.
	const errorMessages = submitError
		? submitError.fieldErrors
			? submitError.fieldErrors.flatMap((fieldError) => fieldError.errors)
			: [submitError.message]
		: [];

	return (
		<div className="flex flex-1 flex-col items-center justify-center p-6 lg:p-8 xl:p-10 overflow-y-auto h-full">
			<div className="w-full max-w-[420px]">
				<div className="mb-6 flex items-center gap-3 lg:hidden">
					<img src="/ctms_logo.png" alt="CTMS Logo" className="h-10 w-auto object-contain" />
					<span className="text-2xl font-extrabold text-[#164027]">CTMS</span>
				</div>

				<h2 className="text-2xl xl:text-3xl font-extrabold tracking-tight text-[#10221b]">
					{AUTH_MESSAGES.TITLE}
				</h2>
				<p className="mt-1.5 mb-6 text-sm font-medium text-[#54655a]">{AUTH_MESSAGES.SUBTITLE}</p>

				<form onSubmit={handleLoginSubmit} className="space-y-4">
					<div>
						<label className="mb-1.5 block text-xs font-bold text-[#425048]">
							{AUTH_MESSAGES.IDENTIFIER_LABEL}
						</label>
						<div className="flex items-center gap-3 rounded-2xl border border-[#dfe8df] bg-white px-4 py-3 shadow-sm transition focus-within:border-[#164027] focus-within:ring-2 focus-within:ring-[#164027]/10">
							<Mail size={18} className="shrink-0 text-[#8a9990]" />
							<input
								type="text"
								required
								placeholder={AUTH_MESSAGES.IDENTIFIER_PLACEHOLDER}
								value={formData.identifier}
								onChange={(e) => updateField("identifier", e.target.value)}
								className="w-full bg-transparent text-sm text-[#10221b] placeholder-[#8a9990] outline-none"
							/>
						</div>
					</div>

					<div>
						<label className="mb-1.5 block text-xs font-bold text-[#425048]">
							{AUTH_MESSAGES.PASSWORD_LABEL}
						</label>
						<div className="flex items-center gap-3 rounded-2xl border border-[#dfe8df] bg-white px-4 py-3 shadow-sm transition focus-within:border-[#164027] focus-within:ring-2 focus-within:ring-[#164027]/10">
							<Lock size={18} className="shrink-0 text-[#8a9990]" />
							<input
								type={showPassword ? "text" : "password"}
								required
								placeholder="••••••••"
								value={formData.password}
								onChange={(e) => updateField("password", e.target.value)}
								className="w-full bg-transparent text-sm text-[#10221b] placeholder-[#8a9990] outline-none"
							/>
							<button
								type="button"
								onClick={togglePasswordVisibility}
								className="shrink-0 text-[#8a9990] hover:text-[#164027]"
							>
								{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
							</button>
						</div>
					</div>

					<div className="flex items-center justify-between text-xs font-semibold pt-1">
						<label className="flex cursor-pointer items-center gap-2 text-[#425048]">
							<input
								type="checkbox"
								checked={formData.rememberMe}
								onChange={(e) => updateField("rememberMe", e.target.checked)}
								className="h-4 w-4 rounded border-[#dfe8df] accent-[#164027]"
							/>
							<span>{AUTH_MESSAGES.REMEMBER_ME}</span>
						</label>
						<button
							type="button"
							onClick={onNavigateToForgotPassword}
							className="font-bold text-[#164027] hover:underline"
						>
							{AUTH_MESSAGES.FORGOT_PASSWORD}
						</button>
					</div>

					{/* Submit error summary (401 invalid credentials / not-active, 422 validation) */}
					{errorMessages.length > 0 && (
						<div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
							{errorMessages.map((msg) => (
								<p key={msg} className="text-xs font-semibold text-red-700">
									{msg}
								</p>
							))}
						</div>
					)}

					{loginResult && (
						<div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
							<p className="text-xs font-semibold text-green-700">
								Đăng nhập thành công! Chào mừng {loginResult.user.email ?? loginResult.user.phone}.
							</p>
						</div>
					)}

					<button
						type="submit"
						disabled={isSubmitting}
						className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#164027] py-3.5 text-base font-bold text-white shadow-md transition hover:bg-[#0f2e1c] hover:shadow-lg mt-2 disabled:cursor-not-allowed disabled:opacity-60"
					>
						<span>{isSubmitting ? "Đang xử lý..." : AUTH_MESSAGES.SUBMIT_BUTTON}</span>
						<ArrowRight size={18} />
					</button>

					<button
						type="button"
						onClick={onNavigateToRegister}
						className="w-full cursor-pointer rounded-2xl border-2 border-[#164027] bg-white py-3 text-base font-bold text-[#164027] transition hover:bg-[#f2f7f3]"
					>
						{AUTH_MESSAGES.REGISTER_BUTTON}
					</button>
				</form>

				{googleEnabled && (
					<>
						<div className="relative my-5 text-center">
							<div className="absolute inset-0 flex items-center">
								<div className="w-full border-t border-[#dfe8df]" />
							</div>
							<span className="relative bg-[#f8faf7] px-4 text-xs font-medium text-[#8a9990]">
								{AUTH_MESSAGES.SOCIAL_DIVIDER}
							</span>
						</div>

						<GoogleSignInButton
							clientId={googleId}
							disabled={isSubmitting}
							onCredential={(idToken) => void handleGoogleCredential(idToken)}
						/>
					</>
				)}

				<div className="mt-5 text-center text-xs font-semibold text-[#54655a]">
					<p className="mb-3">
						{AUTH_MESSAGES.NO_ACCOUNT_PROMPT}{" "}
						<button
							type="button"
							onClick={onNavigateToRegister}
							className="font-bold text-[#164027] hover:underline cursor-pointer"
						>
							{AUTH_MESSAGES.REGISTER_NOW}
						</button>
					</p>
					<button
						type="button"
						onClick={onBackToHome}
						className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-[#164027] hover:underline"
					>
						<Home size={16} />
						<span>{AUTH_MESSAGES.BACK_TO_HOME}</span>
					</button>
				</div>
			</div>
		</div>
	);
};
