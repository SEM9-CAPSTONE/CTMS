import { ArrowLeft, ArrowRight, HelpCircle, Home, RefreshCw } from "lucide-react";
import type React from "react";
import { handlePublicLinkClick } from "../../public-pages/utils/spaNavigate";
import { formatTermsDate, formatTermsVersionLabel } from "../../terms";
import { CamperRegisterForm } from "../components/CamperRegisterForm";
import { HostRegisterForm } from "../components/HostRegisterForm";
import { PorterRegisterForm } from "../components/PorterRegisterForm";
import { RegisterStepper } from "../components/RegisterStepper";
import { RoleSelectionCard } from "../components/RoleSelectionCard";
import { PORTER_REGISTER_STEPS, REGISTER_STEPS, ROLE_OPTIONS } from "../constants";
import { useRegisterForm } from "../hooks/useRegisterForm";
import type { RegisterPageProps } from "../types";

export const RegisterPage: React.FC<RegisterPageProps> = ({
	onBackToHome,
	onNavigateToLogin,
	onNavigateToVerifyOtp,
	onNavigateToTerms,
}) => {
	const {
		currentStep,
		selectedRole,
		setSelectedRole,
		camperForm,
		updateCamperForm,
		hostForm,
		updateHostForm,
		porterForm,
		updatePorterForm,
		acceptedTerms,
		setAcceptedTerms,
		currentTerms,
		isLoadingTerms,
		termsLoadError,
		reloadTerms,
		saveDraftForTermsNavigation,
		handleNextStep,
		handlePrevStep,
		handleRegisterSubmit,
		isSubmitting,
		submitError,
	} = useRegisterForm(onNavigateToVerifyOtp);

	const errorMessages = submitError
		? submitError.fieldErrors
			? submitError.fieldErrors.flatMap((fieldError) => fieldError.errors)
			: [submitError.message]
		: [];

	const handleOpenTerms = () => {
		saveDraftForTermsNavigation();
		if (onNavigateToTerms) {
			onNavigateToTerms();
			return;
		}
		window.history.pushState({}, "", "/terms-and-policy?from=register");
		window.dispatchEvent(new PopStateEvent("popstate"));
	};

	const renderRoleForm = () => {
		switch (selectedRole) {
			case "camper":
				return <CamperRegisterForm formData={camperForm} onChange={updateCamperForm} />;
			case "host":
				return <HostRegisterForm formData={hostForm} onChange={updateHostForm} />;
			case "porter":
				return <PorterRegisterForm formData={porterForm} onChange={updatePorterForm} />;
			default:
				return <CamperRegisterForm formData={camperForm} onChange={updateCamperForm} />;
		}
	};

	const getRoleTitle = () => {
		switch (selectedRole) {
			case "camper":
				return "Tài khoản Camper";
			case "host":
				return "Tài khoản Host";
			case "porter":
				return "Tài khoản Porter";
			default:
				return "Tài khoản người dùng";
		}
	};

	return (
		<div className="flex h-screen min-h-screen w-full items-center justify-center bg-[#f4f7f2] p-3 font-sans text-[#10221b] antialiased md:p-6">
			<div className="flex max-h-[calc(100vh-24px)] w-full max-w-[740px] flex-col justify-between overflow-y-auto rounded-[28px] border border-[#e0ebe0] bg-white p-6 shadow-xl shadow-[#164027]/6 md:p-8">
				<div>
					{/* Header Title */}
					<div className="mb-4 text-center">
						<h1 className="text-2xl font-extrabold tracking-tight text-[#164027]">
							Tham gia DiTrek
						</h1>
					</div>

					{/* Stepper Progress Bar (Step 3 "Xác minh OTP" happens on VerifyOtpPage) */}
					<RegisterStepper
						currentStep={currentStep}
						steps={selectedRole === "porter" ? PORTER_REGISTER_STEPS : REGISTER_STEPS}
					/>

					<div className="my-4 border-t border-[#f0f4f0]" />

					{/* Step 1: Role Selection */}
					{currentStep === 1 && (
						<div>
							<div className="mb-4">
								<h2 className="text-xl font-extrabold tracking-tight text-[#10221b]">
									Chào bạn, bạn muốn tham gia DiTrek với vai trò nào?
								</h2>
								<p className="mt-0.5 text-xs font-medium text-[#54655a]">
									Chọn vai trò phù hợp nhất với nhu cầu của bạn để hệ thống tối ưu giao diện.
								</p>
							</div>

							<div className="flex flex-col gap-3">
								{ROLE_OPTIONS.map((option) => (
									<RoleSelectionCard
										key={option.id}
										option={option}
										isSelected={selectedRole === option.id}
										onSelect={() => setSelectedRole(option.id)}
									/>
								))}
							</div>

							<div className="mt-6 flex justify-end">
								<button
									type="button"
									onClick={handleNextStep}
									className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#164027] px-7 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#0f2e1c] hover:shadow-lg"
								>
									<span>Tiếp tục nhập thông tin</span>
									<ArrowRight size={16} />
								</button>
							</div>
						</div>
					)}

					{/* Step 2: Role-Specific Form */}
					{currentStep === 2 && (
						<form onSubmit={handleRegisterSubmit}>
							<div className="mb-4 flex items-center justify-between">
								<div>
									<h2 className="text-lg font-extrabold tracking-tight text-[#10221b]">
										{getRoleTitle()}
									</h2>
									<p className="mt-0.5 text-xs font-medium text-[#54655a]">
										Vui lòng hoàn tất các thông tin theo yêu cầu nghiệp vụ.
									</p>
								</div>
								<span className="rounded-full bg-[#eef7f0] px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-[#164027]">
									{selectedRole}
								</span>
							</div>

							{renderRoleForm()}

							{/* Terms & Optional Health Profile Consent */}
							<div className="mt-5 space-y-3 border-t border-[#eef2ee] pt-4">
								<p className="text-xs font-bold tracking-wide text-[#425048]">Xác nhận và đồng ý</p>

								{termsLoadError && (
									<div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
										<span>{termsLoadError}</span>
										<button
											type="button"
											onClick={() => {
												void reloadTerms();
											}}
											className="inline-flex cursor-pointer items-center gap-1 font-bold text-[#164027] underline hover:no-underline"
										>
											<RefreshCw size={12} />
											<span>Tải lại</span>
										</button>
									</div>
								)}

								<label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-[#2f4c40]">
									<input
										type="checkbox"
										name="acceptedTerms"
										checked={acceptedTerms}
										onChange={(event) => setAcceptedTerms(event.target.checked)}
										disabled={isLoadingTerms || !currentTerms}
										className="mt-0.5 size-4 shrink-0 rounded border-[#b8c7bc] accent-[#164027]"
									/>
									<span>
										Tôi đã đọc và đồng ý với{" "}
										<button
											type="button"
											onClick={handleOpenTerms}
											className="cursor-pointer font-bold text-[#164027] underline hover:text-[#0f2e1c]"
										>
											Điều khoản và Chính sách sử dụng
										</button>{" "}
										của DiTrek.
										{currentTerms && (
											<span className="ml-1.5 inline-block rounded-full bg-[#eef7f0] px-2 py-0.5 text-[11px] font-semibold text-[#164027]">
												{formatTermsVersionLabel(currentTerms.version)} · Hiệu lực{" "}
												{formatTermsDate(currentTerms.effectiveDate)}
											</span>
										)}
									</span>
								</label>
							</div>

							{/* Submit error summary (409 duplicate / 422 validation / terms error) */}
							{errorMessages.length > 0 && (
								<div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
									{errorMessages.map((msg) => (
										<p key={msg} className="text-xs font-semibold text-red-700">
											{msg}
										</p>
									))}
								</div>
							)}

							{/* Form Action Buttons */}
							<div className="mt-6 flex items-center justify-between border-t border-[#f0f4f0] pt-4">
								<button
									type="button"
									onClick={handlePrevStep}
									className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#dfe8df] bg-white px-5 py-2.5 text-sm font-bold text-[#425048] transition hover:bg-[#f5f7f4]"
								>
									<ArrowLeft size={16} />
									<span>Chọn lại vai trò</span>
								</button>

								<button
									type="submit"
									disabled={isSubmitting}
									className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#164027] px-7 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#0f2e1c] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
								>
									<span>{isSubmitting ? "Đang xử lý..." : "Đăng ký ngay"}</span>
									<ArrowRight size={16} />
								</button>
							</div>
						</form>
					)}
				</div>

				{/* Footer Navigation Row */}
				<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#f0f4f0] pt-4 text-xs font-semibold text-[#54655a]">
					<div>
						<span>Bạn đã có tài khoản? </span>
						<button
							type="button"
							onClick={onNavigateToLogin}
							className="cursor-pointer font-bold text-[#164027] hover:underline"
						>
							Đăng nhập ngay
						</button>
					</div>

					<div className="flex items-center gap-4">
						<button
							type="button"
							onClick={onBackToHome}
							className="inline-flex cursor-pointer items-center gap-1.5 font-bold text-[#425048] hover:text-[#164027]"
						>
							<Home size={14} />
							<span>Trang chủ</span>
						</button>
						<a
							href="/support"
							onClick={(event) => handlePublicLinkClick(event, "/support")}
							className="inline-flex items-center gap-1.5 font-bold text-[#425048] hover:text-[#164027]"
						>
							<HelpCircle size={14} />
							<span>Trợ giúp</span>
						</a>
					</div>
				</div>
			</div>
		</div>
	);
};
