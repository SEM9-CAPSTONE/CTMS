import {
	ArrowLeft,
	ArrowRight,
	CheckCircle2,
	Eye,
	EyeOff,
	Home,
	Lock,
	Mail,
	Phone,
} from "lucide-react";
import type React from "react";
import { useForgotPasswordForm } from "../hooks/useForgotPasswordForm";
import type { ForgotPasswordPageProps, OtpChannel } from "../types";

function PolicyItem({ ok, label }: { ok: boolean; label: string }) {
	return (
		<li className={`flex items-center gap-2 ${ok ? "text-[#164027]" : "text-[#708077]"}`}>
			<CheckCircle2 size={14} className={ok ? "text-[#2b7a3d]" : "text-[#a3b0a6]"} />
			<span>{label}</span>
		</li>
	);
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({
	onBackToHome,
	onNavigateToLogin,
}) => {
	const {
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
	} = useForgotPasswordForm(onNavigateToLogin);

	const chooseChannel = (channel: OtpChannel) => {
		if (!isRequesting) {
			updateField("channel", channel);
		}
	};

	if (step === "success") {
		return (
			<div className="flex min-h-screen w-full items-center justify-center bg-[#f4f7f2] p-4 font-sans text-[#10221b] antialiased">
				<div className="w-full max-w-[430px] rounded-[28px] border border-[#e0ebe0] bg-white p-7 text-center shadow-xl shadow-[#164027]/6">
					<div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[#eef7f0] text-[#164027]">
						<CheckCircle2 size={30} />
					</div>
					<h1 className="text-2xl font-extrabold tracking-tight text-[#164027]">
						Mật khẩu đã được đặt lại
					</h1>
					<p className="mt-2 text-sm font-medium text-[#54655a]">
						Bạn có thể đăng nhập bằng mật khẩu mới. Đang chuyển về trang đăng nhập...
					</p>
					<button
						type="button"
						onClick={onNavigateToLogin}
						className="mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#164027] px-7 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#0f2e1c]"
					>
						<span>Đến trang đăng nhập</span>
						<ArrowRight size={16} />
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen w-full items-center justify-center bg-[#f4f7f2] p-4 font-sans text-[#10221b] antialiased">
			<div className="w-full max-w-[460px] rounded-[28px] border border-[#e0ebe0] bg-white p-6 shadow-xl shadow-[#164027]/6 md:p-8">
				<div className="mb-5">
					<button
						type="button"
						onClick={onNavigateToLogin}
						className="mb-4 inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-[#425048] hover:text-[#164027]"
					>
						<ArrowLeft size={15} />
						<span>Quay lại đăng nhập</span>
					</button>
					<div className="flex items-start gap-3">
						<div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#eef7f0] text-[#164027]">
							<Lock size={24} />
						</div>
						<div>
							<h1 className="text-2xl font-extrabold tracking-tight text-[#164027]">
								Đặt lại mật khẩu
							</h1>
							<p className="mt-1 text-sm font-medium text-[#54655a]">
								Nhận mã xác minh rồi tạo mật khẩu mới cho tài khoản đang hoạt động.
							</p>
						</div>
					</div>
				</div>

				<div className="mb-5 grid grid-cols-2 gap-2 text-xs font-bold">
					<div
						className={`rounded-2xl border px-3 py-2 text-center ${
							step === "request"
								? "border-[#164027] bg-[#eef7f0] text-[#164027]"
								: "border-[#dfe8df] bg-white text-[#708077]"
						}`}
					>
						1. Nhận mã
					</div>
					<div
						className={`rounded-2xl border px-3 py-2 text-center ${
							step === "reset"
								? "border-[#164027] bg-[#eef7f0] text-[#164027]"
								: "border-[#dfe8df] bg-white text-[#708077]"
						}`}
					>
						2. Mật khẩu mới
					</div>
				</div>

				{step === "request" && (
					<form onSubmit={handleRequestSubmit} className="space-y-4" noValidate>
						<div className="rounded-2xl border border-[#dfe8df] bg-[#fbfdfb] px-4 py-3 text-sm font-medium text-[#54655a]">
							Chưa có mã xác minh. Hãy nhập email hoặc số điện thoại để bắt đầu.
						</div>

						<div>
							<label
								htmlFor="forgot-identifier"
								className="mb-1.5 block text-xs font-bold text-[#425048]"
							>
								Email hoặc số điện thoại
							</label>
							<div className="flex items-center gap-3 rounded-2xl border border-[#dfe8df] bg-white px-4 py-3 shadow-sm transition focus-within:border-[#164027] focus-within:ring-2 focus-within:ring-[#164027]/10">
								<Mail size={18} className="shrink-0 text-[#8a9990]" />
								<input
									id="forgot-identifier"
									type="text"
									required
									placeholder="your@email.com hoặc 09xxxxxxxx"
									value={formData.identifier}
									onChange={(event) => updateField("identifier", event.target.value)}
									className="w-full bg-transparent text-sm text-[#10221b] placeholder-[#8a9990] outline-none"
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-2">
							<button
								type="button"
								onClick={() => chooseChannel("email")}
								disabled={isRequesting}
								className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
									formData.channel === "email"
										? "border-[#164027] bg-[#eef7f0] text-[#164027] ring-2 ring-[#164027]/20"
										: "border-[#dfe8df] bg-white text-[#425048] hover:bg-[#f5f7f4]"
								}`}
							>
								<Mail size={16} />
								<span>Email</span>
							</button>
							<button
								type="button"
								onClick={() => chooseChannel("phone")}
								disabled={isRequesting}
								className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
									formData.channel === "phone"
										? "border-[#164027] bg-[#eef7f0] text-[#164027] ring-2 ring-[#164027]/20"
										: "border-[#dfe8df] bg-white text-[#425048] hover:bg-[#f5f7f4]"
								}`}
							>
								<Phone size={16} />
								<span>Số điện thoại</span>
							</button>
						</div>

						{submitError && (
							<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
								<p className="text-xs font-semibold text-red-700">{submitError.message}</p>
							</div>
						)}

						<button
							type="submit"
							disabled={isRequesting}
							className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#164027] px-7 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#0f2e1c] disabled:cursor-not-allowed disabled:opacity-60"
						>
							<span>{isRequesting ? "Đang gửi..." : "Gửi mã xác minh"}</span>
							<ArrowRight size={16} />
						</button>
					</form>
				)}

				{step === "reset" && (
					<form onSubmit={handleResetSubmit} className="space-y-4" noValidate>
						{requestMessage && (
							<div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
								<p className="text-xs font-semibold text-green-700">{requestMessage}</p>
							</div>
						)}

						<div>
							<label htmlFor="reset-code" className="mb-1.5 block text-xs font-bold text-[#425048]">
								Mã xác minh
							</label>
							<input
								id="reset-code"
								type="text"
								required
								inputMode="numeric"
								autoComplete="one-time-code"
								placeholder="Nhập mã OTP"
								value={formData.code}
								onChange={(event) => updateField("code", event.target.value)}
								className="w-full rounded-2xl border border-[#dfe8df] bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10"
							/>
						</div>

						<div>
							<label
								htmlFor="new-password"
								className="mb-1.5 block text-xs font-bold text-[#425048]"
							>
								Mật khẩu mới
							</label>
							<div className="flex items-center gap-3 rounded-2xl border border-[#dfe8df] bg-white px-4 py-3 shadow-sm transition focus-within:border-[#164027] focus-within:ring-2 focus-within:ring-[#164027]/10">
								<Lock size={18} className="shrink-0 text-[#8a9990]" />
								<input
									id="new-password"
									type={showPassword ? "text" : "password"}
									required
									placeholder="Ít nhất 8 ký tự"
									value={formData.newPassword}
									onChange={(event) => updateField("newPassword", event.target.value)}
									className="w-full bg-transparent text-sm text-[#10221b] placeholder-[#8a9990] outline-none"
								/>
								<button
									type="button"
									aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
									onClick={() => setShowPassword(!showPassword)}
									className="shrink-0 text-[#8a9990] hover:text-[#164027]"
								>
									{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
								</button>
							</div>
							<ul className="mt-2 space-y-1 text-xs font-semibold">
								<PolicyItem ok={policy.length} label="8-128 ký tự" />
								<PolicyItem ok={policy.letter} label="Có ít nhất 1 chữ cái" />
								<PolicyItem ok={policy.number} label="Có ít nhất 1 chữ số" />
							</ul>
						</div>

						<div>
							<label
								htmlFor="confirm-password"
								className="mb-1.5 block text-xs font-bold text-[#425048]"
							>
								Xác nhận mật khẩu
							</label>
							<input
								id="confirm-password"
								type={showPassword ? "text" : "password"}
								required
								placeholder="Nhập lại mật khẩu mới"
								value={formData.confirmPassword}
								onChange={(event) => updateField("confirmPassword", event.target.value)}
								className="w-full rounded-2xl border border-[#dfe8df] bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10"
							/>
						</div>

						{submitError && (
							<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
								<p className="text-xs font-semibold text-red-700">{submitError.message}</p>
							</div>
						)}

						<button
							type="submit"
							disabled={isResetting}
							className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#164027] px-7 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#0f2e1c] disabled:cursor-not-allowed disabled:opacity-60"
						>
							<span>{isResetting ? "Đang đặt lại..." : "Đặt lại mật khẩu"}</span>
							<ArrowRight size={16} />
						</button>

						<button
							type="button"
							onClick={requestNewCode}
							className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#164027]/20 bg-[#eef7f0] px-7 py-2.5 text-sm font-bold text-[#164027] transition hover:bg-[#e2f0e4]"
						>
							Yêu cầu mã mới
						</button>
					</form>
				)}

				<div className="mt-5 border-t border-[#f0f4f0] pt-4 text-center">
					<button
						type="button"
						onClick={onBackToHome}
						className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-[#164027] hover:underline"
					>
						<Home size={16} />
						<span>Trang chủ</span>
					</button>
				</div>
			</div>
		</div>
	);
};
