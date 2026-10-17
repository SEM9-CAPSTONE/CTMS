import {
	AlertCircle,
	ArrowRight,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import { SettingsTabEnum } from "../enums/settings-tab.enum";
import type { CamperProfileData } from "../types";

interface ProfileCompletionCardProps {
	profile: CamperProfileData;
	onSelectTab?: (tab: SettingsTabEnum) => void;
}

interface ChecklistItem {
	id: string;
	label: string;
	value: string;
	isCompleted: boolean;
	tab: SettingsTabEnum;
	actionHint?: string;
}

function getGenderLabel(gender: string | null | undefined): string {
	if (!gender) return "Chưa chọn giới tính";
	if (gender === "male") return "Nam";
	if (gender === "female") return "Nữ";
	return "Khác";
}

export function ProfileCompletionCard({ profile, onSelectTab }: ProfileCompletionCardProps) {
	const [isExpanded, setIsExpanded] = useState<boolean>(false);

	const emergencyContactsCount = Array.isArray(profile.emergencyContacts)
		? profile.emergencyContacts.length
		: profile.emergencyContactAdded
			? 1
			: 0;

	const checklist: ChecklistItem[] = [
		{
			id: "fullName",
			label: "Họ và tên",
			value: profile.fullName?.trim() || "Chưa cập nhật",
			isCompleted: Boolean(profile.fullName?.trim()),
			tab: SettingsTabEnum.PERSONAL_PROFILE,
			actionHint: "Cập nhật họ và tên",
		},
		{
			id: "phone",
			label: "Số điện thoại",
			value: profile.phone?.trim() || "Chưa cập nhật SĐT",
			isCompleted: Boolean(profile.phone?.trim()),
			tab: SettingsTabEnum.PERSONAL_PROFILE,
			actionHint: "Bổ sung số điện thoại",
		},
		{
			id: "emergencyContacts",
			label: "Liên hệ khẩn cấp",
			value:
				emergencyContactsCount > 0
					? `Đã lưu ${emergencyContactsCount} người thân`
					: "Chưa bổ sung thân nhân",
			isCompleted: emergencyContactsCount > 0,
			tab: SettingsTabEnum.EMERGENCY_INFO,
			actionHint: "Thêm người thân khẩn cấp",
		},
		{
			id: "dateOfBirth",
			label: "Ngày sinh",
			value: profile.dateOfBirth?.trim() || "Chưa cập nhật ngày sinh",
			isCompleted: Boolean(profile.dateOfBirth?.trim()),
			tab: SettingsTabEnum.PERSONAL_PROFILE,
			actionHint: "Điền ngày sinh",
		},
		{
			id: "gender",
			label: "Giới tính",
			value: getGenderLabel(profile.gender),
			isCompleted: Boolean(profile.gender),
			tab: SettingsTabEnum.PERSONAL_PROFILE,
			actionHint: "Chọn giới tính",
		},
		{
			id: "address",
			label: "Địa chỉ",
			value: profile.address?.trim() || "Chưa cập nhật địa chỉ",
			isCompleted: Boolean(profile.address?.trim()),
			tab: SettingsTabEnum.PERSONAL_PROFILE,
			actionHint: "Cập nhật địa chỉ",
		},
	];

	const completedCount = checklist.filter((item) => item.isCompleted).length;
	const totalCount = checklist.length;
	const calculatedPercentage = Math.round((completedCount / totalCount) * 100);
	const percentage =
		typeof profile.completionPercentage === "number"
			? profile.completionPercentage
			: calculatedPercentage;

	const pendingItems = checklist.filter((item) => !item.isCompleted);
	const completedItems = checklist.filter((item) => item.isCompleted);

	return (
		<div className="w-full flex flex-col gap-3.5 rounded-2xl border border-[#e0ebe0] bg-white p-5 sm:p-6 shadow-sm transition">
			{/* Widget Header with Progress Info & Toggle */}
			<div className="flex items-center justify-between gap-4">
				<div className="flex items-center gap-2.5 min-w-0">
					<div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#eef7f0] text-[#164027]">
						<ShieldAlert size={18} />
					</div>
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<h3 className="font-extrabold text-[#164027] text-sm sm:text-base">
								Hoàn thiện hồ sơ
							</h3>
							<span className="rounded-md bg-[#eef7f0] px-2 py-0.5 font-extrabold text-[#164027] text-xs">
								{completedCount}/{totalCount} mục
							</span>
						</div>
						<p className="text-xs font-medium text-[#627769] truncate">
							Đảm bảo an toàn tuyệt đối và quy trình ứng cứu khẩn cấp.
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2 shrink-0">
					<span className="rounded-lg bg-[#eef7f0] px-3 py-1 font-extrabold text-[#164027] text-xs sm:text-sm">
						{percentage}%
					</span>
					<button
						type="button"
						onClick={() => setIsExpanded((prev) => !prev)}
						className="flex items-center gap-1.5 rounded-xl border border-[#dfe8df] bg-[#f9fbf9] px-3 py-1.5 text-xs font-bold text-[#164027] hover:bg-[#eef7f0] transition cursor-pointer"
						aria-expanded={isExpanded}
					>
						<span>{isExpanded ? "Thu gọn" : `Chi tiết (${completedCount}/${totalCount})`}</span>
						{isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
					</button>
				</div>
			</div>

			{/* Main Highlighted Progress Bar */}
			<div className="h-2 w-full overflow-hidden rounded-full bg-[#eef7f0]">
				<div
					className="h-full bg-gradient-to-r from-emerald-600 to-[#164027] transition-all duration-500 rounded-full"
					style={{ width: `${percentage}%` }}
				/>
			</div>

			{/* Quick Summary / Status Indicator when collapsed */}
			{!isExpanded && pendingItems.length > 0 && (
				<div className="flex items-center justify-between text-xs text-[#566b5d] pt-0.5">
					<p className="text-[11px] font-medium text-amber-800 flex items-center gap-1.5">
						<AlertCircle size={13} className="text-amber-600 shrink-0" />
						<span>
							Còn <strong>{pendingItems.length} mục</strong> chưa hoàn thành (
							{pendingItems.map((item) => item.label).join(", ")}).
						</span>
					</p>
					<button
						type="button"
						onClick={() => setIsExpanded(true)}
						className="text-[11px] font-bold text-[#164027] hover:underline cursor-pointer shrink-0 ml-2"
					>
						Xem ngay
					</button>
				</div>
			)}

			{!isExpanded && pendingItems.length === 0 && (
				<p className="text-[11px] font-medium text-emerald-700 flex items-center gap-1.5 pt-0.5">
					<CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
					<span>Hồ sơ đã được hoàn thiện 100%!</span>
				</p>
			)}

			{/* Expanded Details: Shows all items categorized */}
			{isExpanded && (
				<div className="border-t border-[#f0f4f1] pt-3.5 flex flex-col gap-3 animate-in fade-in duration-200">
					{/* Pending Items (Needs attention) */}
					{pendingItems.length > 0 && (
						<div className="flex flex-col gap-2">
							<p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
								<AlertCircle size={13} className="text-amber-600" />
								<span>Cần bổ sung ({pendingItems.length} mục):</span>
							</p>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
								{pendingItems.map((item) => (
									<button
										key={item.id}
										type="button"
										onClick={() => onSelectTab?.(item.tab)}
										className="flex items-center justify-between gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-left transition hover:bg-amber-100/70 cursor-pointer"
									>
										<div className="flex items-center gap-2.5 min-w-0">
											<AlertCircle size={16} className="text-amber-600 shrink-0" />
											<div className="min-w-0">
												<p className="text-xs font-bold text-amber-950 truncate">{item.label}</p>
												<p className="text-[11px] font-medium text-amber-800 truncate">
													{item.value}
												</p>
											</div>
										</div>
										<ArrowRight size={14} className="text-amber-700 shrink-0" />
									</button>
								))}
							</div>
						</div>
					)}

					{/* Completed Items */}
					{completedItems.length > 0 && (
						<div className="flex flex-col gap-2">
							<p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
								<CheckCircle2 size={13} className="text-emerald-600" />
								<span>Đã hoàn thành ({completedItems.length} mục):</span>
							</p>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
								{completedItems.map((item) => (
									<button
										key={item.id}
										type="button"
										onClick={() => onSelectTab?.(item.tab)}
										className="flex items-center justify-between gap-2.5 rounded-xl border border-[#dfe8df] bg-[#f9fbf9] p-3 text-left transition hover:bg-[#eef7f0] cursor-pointer"
									>
										<div className="flex items-center gap-2.5 min-w-0">
											<CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
											<div className="min-w-0">
												<p className="text-xs font-bold text-[#10221b] truncate">{item.label}</p>
												<p className="text-[11px] font-medium text-[#627769] truncate">
													{item.value}
												</p>
											</div>
										</div>
										<ArrowRight size={14} className="text-[#627769] shrink-0" />
									</button>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
