import { ArrowRight, Home, Mail, Phone, Send, ShieldCheck } from "lucide-react";
import type React from "react";
import { useVerifyOtpForm } from "../hooks/useVerifyOtpForm";
import type { OtpChannel, VerifyOtpPageProps } from "../types";

export const VerifyOtpPage: React.FC<VerifyOtpPageProps> = ({
	onBackToHome,
	onNavigateToLogin,
	onNavigateToRegister,
}) => {
	const {
		context,
		code,
		setCode,
		selectedChannel,
		setSelectedChannel,
		isVerifying,
		isSending,
		hasSentCode,
		submitError,
		countdown,
		verifySuccess,
		handleVerifySubmit,
		handleSendCode,
	} = useVerifyOtpForm(onNavigateToRegister, onNavigateToLogin);

	// No registration context (direct URL visit, or context lost after
	// reload) -- the redirect to RegisterPage is triggered inside the hook's
	// mount effect; render nothing here to avoid flashing an unusable form.
	if (!context) {
		return null;
	}

	// Verify succeeded -- show confirmation instead of yanking the user
	// straight to Login with no feedback. useVerifyOtpForm auto-navigates
	// after a short delay; the button below lets an impatient user skip it.
	if (verifySuccess) {
		return (
			<div className="flex h-screen min-h-screen w-full items-center justify-center bg-[#f4f7f2] p-3 font-sans text-[#10221b] antialiased md:p-6">
				<div className="w-full max-w-[420px] rounded-[28px] border border-[#e0ebe0] bg-white p-6 text-center shadow-xl shadow-[#164027]/6 md:p-8">
					<div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-[#eef7f0] text-[#164027]">
						<ShieldCheck size={28} />
					</div>
					<h1 className="text-2xl font-extrabold tracking-tight text-[#164027]">
						Xác thực thành công!
					</h1>
					<p className="mt-2 text-sm font-medium text-[#54655a]">
						Tài khoản của bạn đã được kích hoạt. Đang chuyển đến trang đăng nhập...
					</p>
					<button
						type="button"
						onClick={onNavigateToLogin}
						className="mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#164027] px-7 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#0f2e1c] hover:shadow-lg"
					>
						<span>Đến trang đăng nhập ngay</span>
						<ArrowRight size={16} />
					</button>
				</div>
			</div>
		);
	}

	// Decision Gate (First OTP Trigger, resolved: Option B) -- no API call
	// ever fires on mount. The user must choose a channel and press
	// "Gửi mã OTP" first; only after that succeeds does entering a code /
	// Verify become possible.
	const sendButtonLabel = isSending
		? "Đang gửi..."
		: countdown > 0
			? `Gửi lại mã (${countdown}s)`
			: hasSentCode
				? "Gửi lại mã"
				: "Gửi mã OTP";

	const destinationFor = (channel: OtpChannel) =>
		channel === "email" ? context.email : context.phone;

	const selectChannel = (channel: OtpChannel) => {
		if (isSending || countdown > 0) {
			return;
		}
		setSelectedChannel(channel);
	};

	return (
		<div className="flex h-screen min-h-screen w-full items-center justify-center bg-[#f4f7f2] p-3 font-sans text-[#10221b] antialiased md:p-6">
			<div className="w-full max-w-[420px] rounded-[28px] border border-[#e0ebe0] bg-white p-6 shadow-xl shadow-[#164027]/6 md:p-8">
				<div className="mb-4 text-center">
					<div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-[#eef7f0] text-[#164027]">
						<ShieldCheck size={28} />
					</div>
					<h1 className="text-2xl font-extrabold tracking-tight text-[#164027]">
						Xác minh tài khoản
					</h1>
					<p className="mt-1 text-xs font-medium text-[#54655a]">
						{hasSentCode && selectedChannel ? (
							<>
								Mã OTP đã được gửi tới{" "}
								<strong className="text-[#164027]">{destinationFor(selectedChannel)}</strong>
							</>
						) : (
							'Chọn phương thức nhận mã OTP, sau đó bấm "Gửi mã OTP"'
						)}
					</p>
				</div>

				{/* Verification method selector — Phone or Email, chosen fresh on
				 * this page every visit (never carried from Register, never
				 * persisted client-side beyond this render). */}
				<div className="mb-4 grid grid-cols-2 gap-2">
					<button
						type="button"
						onClick={() => selectChannel("phone")}
						disabled={isSending || countdown > 0}
						className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
							selectedChannel === "phone"
								? "border-[#164027] bg-[#eef7f0] text-[#164027] ring-2 ring-[#164027]/20"
								: "border-[#dfe8df] bg-white text-[#425048] hover:bg-[#f5f7f4]"
						}`}
					>
						<Phone size={18} />
						<span>Xác minh qua SĐT</span>
						<span className="font-normal text-[#8a9990]">{context.phone || "—"}</span>
					</button>

					<button
						type="button"
						onClick={() => selectChannel("email")}
						disabled={isSending || countdown > 0}
						className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
							selectedChannel === "email"
								? "border-[#164027] bg-[#eef7f0] text-[#164027] ring-2 ring-[#164027]/20"
								: "border-[#dfe8df] bg-white text-[#425048] hover:bg-[#f5f7f4]"
						}`}
					>
						<Mail size={18} />
						<span>Xác minh qua Email</span>
						<span className="font-normal text-[#8a9990]">{context.email || "—"}</span>
					</button>
				</div>

				<button
					type="button"
					onClick={handleSendCode}
					disabled={isSending || countdown > 0 || !selectedChannel}
					className="mb-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#164027]/20 bg-[#eef7f0] px-7 py-2.5 text-sm font-bold text-[#164027] transition hover:bg-[#e2f0e4] disabled:cursor-not-allowed disabled:opacity-60"
				>
					<Send size={16} />
					<span>{sendButtonLabel}</span>
				</button>

				<form onSubmit={handleVerifySubmit}>
					<label htmlFor="otp-code" className="mb-1 block text-xs font-bold text-[#425048]">
						Mã OTP *
					</label>
					<input
						id="otp-code"
						type="text"
						required
						disabled={!hasSentCode}
						inputMode="numeric"
						autoComplete="one-time-code"
						placeholder={hasSentCode ? "Nhập mã OTP" : "Gửi mã OTP trước khi nhập"}
						value={code}
						onChange={(e) => setCode(e.target.value)}
						className="w-full rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none focus:border-[#164027] disabled:cursor-not-allowed disabled:bg-[#f5f7f4] disabled:text-[#a3b0a6]"
					/>

					{submitError && (
						<div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
							<p className="text-xs font-semibold text-red-700">{submitError.message}</p>
						</div>
					)}

					<button
						type="submit"
						disabled={isVerifying || !hasSentCode || !code}
						className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#164027] px-7 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#0f2e1c] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
					>
						<span>{isVerifying ? "Đang xác minh..." : "Xác minh"}</span>
						<ArrowRight size={16} />
					</button>
				</form>

				<div className="mt-4 flex items-center justify-between border-t border-[#f0f4f0] pt-4 text-xs font-semibold text-[#54655a]">
					<span className="text-[#8a9990]">Chưa nhận được mã? Chọn lại phương thức và gửi mã.</span>

					<button
						type="button"
						onClick={onBackToHome}
						className="inline-flex cursor-pointer items-center gap-1.5 font-bold text-[#425048] hover:text-[#164027]"
					>
						<Home size={14} />
						<span>Trang chủ</span>
					</button>
				</div>
			</div>
		</div>
	);
};
