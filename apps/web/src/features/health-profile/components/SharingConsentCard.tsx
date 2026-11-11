import { AlertCircle, CheckCircle2, Lock, Shield, ShieldAlert, UserX } from "lucide-react";
import type { HealthSharingConsent } from "../types";

interface SharingConsentCardProps {
	consent: HealthSharingConsent;
	onRevokeConsent: () => void;
	onGrantConsent: () => void;
	disabled?: boolean;
	isSubmitting?: boolean;
}

export function SharingConsentCard({
	consent,
	onRevokeConsent,
	onGrantConsent,
	disabled,
	isSubmitting,
}: SharingConsentCardProps) {
	const isGranted = consent.isConsentGranted;

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-[#e0ebe0] bg-white p-6 shadow-sm">
			<div className="flex items-center justify-between border-b border-[#f0f4f1] pb-3">
				<div className="flex items-center gap-2.5">
					<div
						className={`flex size-9 items-center justify-center rounded-xl ${
							isGranted ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
						}`}
					>
						<Shield size={20} />
					</div>
					<div>
						<h3 className="text-base font-extrabold text-[#164027]">
							Quyền chia sẻ thông tin y tế
						</h3>
						<p className="text-xs font-medium text-[#627769]">
							Tuân thủ quy định bảo mật dữ liệu nhạy cảm (BR-025 & BR-217).
						</p>
					</div>
				</div>

				{/* Active Sharing Status Badge */}
				<span
					className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold ${
						isGranted
							? "border-emerald-300 bg-emerald-50 text-emerald-800"
							: "border-amber-300 bg-amber-50 text-amber-800"
					}`}
				>
					{isGranted ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
					<span>{isGranted ? "Đã cấp quyền chia sẻ" : "Đã thu hồi chia sẻ"}</span>
				</span>
			</div>

			{/* Consent Explanation & Scope */}
			<div className="flex flex-col gap-3 rounded-xl border border-[#dfe8df] bg-[#f9fbf9] p-4 text-xs font-medium text-[#4a5e51]">
				<p className="font-semibold text-[#10221b]">Đối tượng được phép xem hồ sơ y tế:</p>
				<ul className="list-disc pl-5 space-y-1 text-[#33463a]">
					<li>
						Chỉ <strong>Host (Trưởng đoàn)</strong> và <strong>Porter (Dẫn đường)</strong> thuộc
						chuyến đi (Trip) mà bạn đã đăng ký tham gia (BR-025).
					</li>
					<li>
						Thông tin <strong>không bao giờ được công khai</strong> hoặc chia sẻ cho các bên không
						thuộc phạm vi cứu hộ khẩn cấp.
					</li>
					{consent.activeTripScope && (
						<li>
							Phạm vi Trip hiện tại:{" "}
							<strong className="text-[#164027]">{consent.activeTripScope}</strong>
						</li>
					)}
				</ul>
			</div>

			{/* Actions: Grant or Revoke */}
			<div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
				<div className="flex items-center gap-2 text-xs font-semibold text-[#667a6d]">
					<Lock size={14} className="text-[#164027]" />
					<span>
						Bạn có quyền chỉnh sửa hoặc thu hồi quyền chia sẻ bất kỳ lúc nào (BR-026/AC2).
					</span>
				</div>

				{isGranted ? (
					<button
						type="button"
						onClick={onRevokeConsent}
						disabled={disabled || isSubmitting}
						className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition disabled:opacity-50 shrink-0"
					>
						<UserX size={15} />
						<span>Thu hồi quyền chia sẻ</span>
					</button>
				) : (
					<button
						type="button"
						onClick={onGrantConsent}
						disabled={disabled || isSubmitting}
						className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#164027] px-4 py-2 text-xs font-bold text-white hover:bg-[#276143] transition disabled:opacity-50 shrink-0"
					>
						<ShieldAlert size={15} />
						<span>Cấp lại quyền chia sẻ</span>
					</button>
				)}
			</div>
		</div>
	);
}
