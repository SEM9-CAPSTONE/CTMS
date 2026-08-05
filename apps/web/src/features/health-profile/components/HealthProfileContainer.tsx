import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Save, Undo2 } from "lucide-react";
import { useHealthProfile } from "../hooks/useHealthProfile";
import { AllergiesList } from "./AllergiesList";
import { HealthInfoFields } from "./HealthInfoFields";
import { MedicalConditionsList } from "./MedicalConditionsList";
import { SharingConsentCard } from "./SharingConsentCard";
import { UnauthorizedViewGuard } from "./UnauthorizedViewGuard";

export function HealthProfileContainer() {
	const {
		profile,
		isLoading,
		isSubmitting,
		apiError,
		conflictError,
		successMessage,
		form,
		isDirty,
		fetchProfile,
		handleAddAllergy,
		handleRemoveAllergy,
		handleAddMedicalCondition,
		handleRemoveMedicalCondition,
		handleRevokeConsent,
		handleGrantConsent,
		handleReset,
		handleSubmit,
	} = useHealthProfile();

	if (isLoading) {
		return (
			<div className="flex flex-col gap-4 rounded-2xl border border-[#e0ebe0] bg-white p-8 shadow-sm">
				<div className="flex items-center gap-3">
					<div className="size-6 animate-spin rounded-full border-2 border-[#164027] border-t-transparent" />
					<span className="text-xs font-bold text-[#164027]">Đang tải hồ sơ sức khỏe...</span>
				</div>
			</div>
		);
	}

	const isAccountActive = profile?.accountStatus === "ACTIVE";

	return (
		<UnauthorizedViewGuard isAuthorized={true}>
			<div className="flex flex-col gap-6 w-full">
				{/* Account Status Warning (BR-202) */}
				{!isAccountActive && (
					<div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-900 shadow-sm">
						<AlertCircle size={18} className="text-amber-600 shrink-0" />
						<div>
							<p>Tài khoản hiện đang ở trạng thái không hoạt động ({profile?.accountStatus}).</p>
							<p className="font-medium text-amber-800">
								Bạn không thể thay đổi thông tin sức khỏe cho đến khi tài khoản được xác minh hoàn
								toàn. (BR-202)
							</p>
						</div>
					</div>
				)}

				{/* API Error Alert */}
				{apiError && (
					<div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-900 shadow-sm">
						<div className="flex items-center gap-2.5">
							<AlertCircle size={18} className="text-red-600 shrink-0" />
							<span>{apiError}</span>
						</div>
						{conflictError && (
							<button
								type="button"
								onClick={fetchProfile}
								className="inline-flex items-center gap-1.5 rounded-xl bg-red-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-800 transition"
							>
								<RefreshCw size={13} />
								<span>Tải lại dữ liệu mới</span>
							</button>
						)}
					</div>
				)}

				{/* Success Toast */}
				{successMessage && (
					<div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-900 shadow-sm">
						<CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
						<span>{successMessage}</span>
					</div>
				)}

				{/* Sharing Consent Card */}
				{profile && (
					<SharingConsentCard
						consent={profile.consent}
						onRevokeConsent={handleRevokeConsent}
						onGrantConsent={handleGrantConsent}
						disabled={!isAccountActive}
						isSubmitting={isSubmitting}
					/>
				)}

				{/* Editable Health Form */}
				<form onSubmit={handleSubmit} className="flex flex-col gap-6">
					<HealthInfoFields form={form} disabled={!isAccountActive} />

					<AllergiesList
						allergies={form.watch("allergies") || []}
						onAddAllergy={handleAddAllergy}
						onRemoveAllergy={handleRemoveAllergy}
						disabled={!isAccountActive}
					/>

					<MedicalConditionsList
						conditions={form.watch("medicalConditions") || []}
						onAddCondition={handleAddMedicalCondition}
						onRemoveCondition={handleRemoveMedicalCondition}
						disabled={!isAccountActive}
					/>

					{/* Bottom Submit & Reset Row */}
					{isAccountActive && (
						<div className="flex items-center justify-end gap-3 rounded-2xl border border-[#e0ebe0] bg-white p-4 shadow-sm">
							<button
								type="button"
								onClick={handleReset}
								disabled={!isDirty || isSubmitting}
								className="inline-flex items-center gap-1.5 rounded-xl border border-[#dfe8df] bg-white px-4 py-2 text-xs font-bold text-[#4a5e51] hover:bg-[#f4f7f2] transition disabled:opacity-40"
							>
								<Undo2 size={14} />
								<span>Đặt lại</span>
							</button>

							<button
								type="submit"
								disabled={!isDirty || isSubmitting}
								className="inline-flex items-center gap-2 rounded-xl bg-[#164027] px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-[#276143] transition disabled:opacity-40"
							>
								{isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
								<span>{isSubmitting ? "Đang lưu..." : "Lưu hồ sơ sức khỏe"}</span>
							</button>
						</div>
					)}
				</form>
			</div>
		</UnauthorizedViewGuard>
	);
}
