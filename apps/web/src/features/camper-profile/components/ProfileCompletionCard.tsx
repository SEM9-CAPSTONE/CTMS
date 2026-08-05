import { AlertCircle, ArrowRight, CheckCircle2, ShieldAlert } from "lucide-react";
import { SettingsTabEnum } from "../enums/settings-tab.enum";
import type { CamperProfileData } from "../types";

interface ProfileCompletionCardProps {
	profile: CamperProfileData;
	onSelectTab?: (tab: SettingsTabEnum) => void;
}

export function ProfileCompletionCard({ profile, onSelectTab }: ProfileCompletionCardProps) {
	const percentage = profile.completionPercentage || 80;

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm">
			{/* Widget Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div className="flex size-7 items-center justify-center rounded-lg bg-[#eef7f0] text-[#164027]">
						<ShieldAlert size={16} />
					</div>
					<h3 className="font-extrabold text-[#164027] text-sm">Hoàn thiện hồ sơ</h3>
				</div>
				<span className="font-extrabold text-[#164027] text-sm">{percentage}%</span>
			</div>

			{/* Progress Bar */}
			<div className="h-2 w-full overflow-hidden rounded-full bg-[#eef7f0]">
				<div
					className="h-full bg-gradient-to-r from-emerald-600 to-[#164027] transition-all duration-500 rounded-full"
					style={{ width: `${percentage}%` }}
				/>
			</div>

			<p className="text-xs font-medium text-[#566b5d]">
				Hồ sơ hoàn chỉnh giúp đảm bảo an toàn tuyệt đối và quy trình ứng cứu khẩn cấp nhanh chóng.
			</p>

			<div className="border-t border-[#f0f4f1] pt-3 flex flex-col gap-2.5">
				<p className="text-[11px] font-extrabold uppercase tracking-wider text-[#88998d]">
					Hành động cần thiết:
				</p>

				{/* Emergency Contact Action */}
				<button
					type="button"
					onClick={() => onSelectTab?.(SettingsTabEnum.EMERGENCY_INFO)}
					className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-left transition hover:bg-amber-100/70"
				>
					<div className="flex items-center gap-2.5">
						<AlertCircle size={16} className="text-amber-600 shrink-0" />
						<div>
							<p className="text-xs font-bold text-amber-950">Người liên hệ khẩn cấp</p>
							<p className="text-[11px] font-medium text-amber-800">
								Chưa bổ sung liên hệ thân nhân
							</p>
						</div>
					</div>
					<ArrowRight size={14} className="text-amber-700 shrink-0" />
				</button>

				{/* Phone Verification Action */}
				<button
					type="button"
					onClick={() => onSelectTab?.(SettingsTabEnum.CONTACT_INFO)}
					className="flex items-center justify-between rounded-xl border border-[#dfe8df] bg-[#f9fbf9] p-3 text-left transition hover:bg-[#eef7f0]"
				>
					<div className="flex items-center gap-2.5">
						<CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
						<div>
							<p className="text-xs font-bold text-[#10221b]">Xác minh số điện thoại</p>
							<p className="text-[11px] font-medium text-[#627769]">Đã xác thực OTP (+84)</p>
						</div>
					</div>
				</button>
			</div>
		</div>
	);
}
