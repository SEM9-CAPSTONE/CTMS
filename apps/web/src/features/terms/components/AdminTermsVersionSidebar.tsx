import { Plus } from "lucide-react";
import type React from "react";
import { Button, StatusBadge } from "../../../shared/components";
import { formatTermsDate, formatTermsVersionLabel } from "../constants";
import type { TermsVersionSummary } from "../types";

export interface AdminTermsVersionSidebarProps {
	versions: TermsVersionSummary[];
	selectedVersionCode: string | null;
	isCreatingDraft: boolean;
	draftVersionCode: string;
	draftUpdatedAtLabel: string | null;
	onCreateNewDraft: () => void;
	onSelectDraft: () => void;
	onSelectVersion: (versionCode: string) => void;
}

export const AdminTermsVersionSidebar: React.FC<AdminTermsVersionSidebarProps> = ({
	versions,
	selectedVersionCode,
	isCreatingDraft,
	draftVersionCode,
	draftUpdatedAtLabel,
	onCreateNewDraft,
	onSelectDraft,
	onSelectVersion,
}) => {
	return (
		<aside className="rounded-2xl border border-[#dfe8df] bg-white p-4 shadow-xs">
			<h2 className="text-sm font-bold text-[#10221b]">Phiên bản</h2>

			<Button
				variant="primary"
				size="sm"
				onClick={onCreateNewDraft}
				className="mt-3 w-full justify-center gap-1.5 bg-[#164027] hover:bg-[#0f2e1c]"
			>
				<Plus className="size-4" />
				<span>Tạo phiên bản mới</span>
			</Button>

			<div className="mt-4 space-y-2.5">
				{draftVersionCode && (
					<button
						type="button"
						onClick={onSelectDraft}
						className={`w-full cursor-pointer rounded-xl border p-3 text-left transition ${
							isCreatingDraft
								? "border-[#9bc4a5] bg-[#eef7f0]"
								: "border-[#e6eee7] bg-white hover:bg-[#f7faf7]"
						}`}
					>
						<div className="flex items-center justify-between gap-2">
							<span className="text-sm font-bold text-[#10221b]">
								{formatTermsVersionLabel(draftVersionCode)}
							</span>
							<StatusBadge tone="warning">Đang soạn thảo</StatusBadge>
						</div>
						<p className="mt-1.5 text-xs text-[#54655a]">
							{draftUpdatedAtLabel ? `Cập nhật: ${draftUpdatedAtLabel}` : "Bản nháp mới"}
						</p>
					</button>
				)}

				{versions.map((item) => {
					const isSelected = !isCreatingDraft && selectedVersionCode === item.version;
					return (
						<button
							key={item.id}
							type="button"
							onClick={() => onSelectVersion(item.version)}
							className={`w-full cursor-pointer rounded-xl border p-3 text-left transition ${
								isSelected
									? "border-[#9bc4a5] bg-[#eef7f0]"
									: "border-[#e6eee7] bg-white hover:bg-[#f7faf7]"
							}`}
						>
							<div className="flex items-center justify-between gap-2">
								<span className="text-sm font-bold text-[#10221b]">
									{formatTermsVersionLabel(item.version)}
								</span>
								<StatusBadge tone={item.isActive ? "success" : "neutral"}>
									{item.isActive ? "Đang áp dụng" : "Đã hết hiệu lực"}
								</StatusBadge>
							</div>
							<p className="mt-1.5 text-xs text-[#54655a]">
								Hiệu lực: {formatTermsDate(item.effectiveDate)}
							</p>
						</button>
					);
				})}
			</div>
		</aside>
	);
};
