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
		<div className="flex flex-col gap-3 rounded-2xl border border-[#e0ebe0] bg-white p-4 shadow-sm">
			{/* Widget Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div className="flex size-7 items-center justify-center rounded-lg bg-[#eef7f0] text-[#164027]">
						<ShieldAlert size={15} />
					</div>
					<h3 className="font-extrabold text-[#164027] text-xs">Hoàn thiện hồ sơ</h3>
				</div>
				<span className="rounded-md bg-[#eef7f0] px-2 py-0.5 font-extrabold text-[#164027] text-xs">
					{percentage}%
				</span>
			</div>

			{/* Progress Bar */}
			<div className="h-1.5 w-full overflow-hidden rounded-full bg-[#eef7f0]">
				<div
					className="h-full bg-gradient-to-r from-emerald-600 to-[#164027] transition-all duration-500 rounded-full"
					style={{ width: `${percentage}%` }}
				/>
			</div>

			<p className="text-[11px] font-medium text-[#566b5d]">
				Đảm bảo an toàn tuyệt đối và quy trình ứng cứu khẩn cấp.
			</p>

			<div className="border-t border-[#f0f4f1] pt-2.5 flex flex-col gap-2">
				<p className="text-[10px] font-extrabold uppercase tracking-wider text-[#88998d]">
					Hành động cần làm:
				</p>

				{/* Emergency Contact Action */}
				<button
					type="button"
					onClick={() => onSelectTab?.(SettingsTabEnum.EMERGENCY_INFO)}
					className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 text-left transition hover:bg-amber-100/70"
				>
					<div className="flex items-center gap-2 min-w-0">
						<AlertCircle size={15} className="text-amber-600 shrink-0" />
						<div className="min-w-0">
							<p className="text-xs font-bold text-amber-950 truncate">Liên hệ khẩn cấp</p>
							<p className="text-[10px] font-medium text-amber-800 truncate">
								Chưa bổ sung thân nhân
							</p>
						</div>
					</div>
					<ArrowRight size={13} className="text-amber-700 shrink-0" />
				</button>

				{/* Phone Verification Action */}
				<button
					type="button"
					onClick={() => onSelectTab?.(SettingsTabEnum.CONTACT_INFO)}
					className="flex items-center justify-between gap-2 rounded-xl border border-[#dfe8df] bg-[#f9fbf9] p-2.5 text-left transition hover:bg-[#eef7f0]"
				>
					<div className="flex items-center gap-2 min-w-0">
						<CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
						<div className="min-w-0">
							<p className="text-xs font-bold text-[#10221b] truncate">Xác minh SĐT</p>
							<p className="text-[10px] font-medium text-[#627769] truncate">Đã xác thực OTP</p>
						</div>
					</div>
				</button>
			</div>
		</div>
	);
}
