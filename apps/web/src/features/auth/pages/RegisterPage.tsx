import { ArrowLeft, ArrowRight, CheckCircle2, HelpCircle, Home } from "lucide-react";
import type React from "react";
import { CamperRegisterForm } from "../components/CamperRegisterForm";
import { HostRegisterForm } from "../components/HostRegisterForm";
import { PorterRegisterForm } from "../components/PorterRegisterForm";
import { RegisterStepper } from "../components/RegisterStepper";
import { RoleSelectionCard } from "../components/RoleSelectionCard";
import { ROLE_OPTIONS } from "../constants";
import { useRegisterForm } from "../hooks/useRegisterForm";
import type { RegisterPageProps } from "../types";

export const RegisterPage: React.FC<RegisterPageProps> = ({ onBackToHome, onNavigateToLogin }) => {
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
		handleNextStep,
		handlePrevStep,
		handleRegisterSubmit,
		isSubmitting,
		submitError,
	} = useRegisterForm();

	// 409 -> submitError.message directly; 422 -> flatten backend's per-field
	// errors (also covers "Either email or phone must be provided").
	const errorMessages = submitError
		? submitError.fieldErrors
			? submitError.fieldErrors.flatMap((fieldError) => fieldError.errors)
			: [submitError.message]
		: [];

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
				return "Tài khoản Camper (Khách cắm trại)";
			case "host":
				return "Tài khoản Host (Chủ bãi trại)";
			case "porter":
				return "Tài khoản Porter (Người dẫn đường)";
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
						<h1 className="text-2xl font-extrabold tracking-tight text-[#164027]">Tham gia CTMS</h1>
					</div>

					{/* 3-Step Stepper Progress Bar */}
					<RegisterStepper currentStep={currentStep} />

					<div className="my-4 border-t border-[#f0f4f0]" />

					{/* Step 1: Role Selection (Vertical Stacked Cards) */}
					{currentStep === 1 && (
						<div>
							<div className="mb-4">
								<h2 className="text-xl font-extrabold tracking-tight text-[#10221b]">
									Chào bạn, bạn muốn tham gia CTMS với vai trò nào?
								</h2>
								<p className="mt-0.5 text-xs font-medium text-[#54655a]">
									Chọn vai trò phù hợp nhất với nhu cầu của bạn để hệ thống tối ưu giao diện.
								</p>
							</div>

							{/* 3 Vertical Stacked Role Cards */}
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

							{/* Action Button */}
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

							{/* Submit error summary (409 duplicate / 422 validation) */}
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

					{/* Step 3: Success Completion */}
					{currentStep === 3 && (
						<div className="py-6 text-center">
							<div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-[#eef7f0] text-[#164027]">
								<CheckCircle2 size={36} />
							</div>
							<h2 className="text-2xl font-extrabold text-[#164027]">
								Đăng ký tài khoản thành công!
							</h2>
							<p className="mt-2 text-sm text-[#54655a]">
								Chào mừng bạn gia nhập CTMS với vai trò{" "}
								<strong className="uppercase text-[#164027]">{selectedRole}</strong>.
							</p>

							<div className="mt-8 flex justify-center gap-4">
								<button
									type="button"
									onClick={onNavigateToLogin}
									className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#164027] px-8 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#0f2e1c]"
								>
									<span>Đăng nhập ngay</span>
									<ArrowRight size={16} />
								</button>
							</div>
						</div>
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
							href="#help"
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
