import { Eye, Save } from "lucide-react";
import type React from "react";
import { Button, StatusBadge } from "../../../shared/components";
import { formatTermsVersionLabel } from "../constants";
import type { TermsSection } from "../types";
import { TermsWordEditor } from "./TermsWordEditor";

export interface AdminTermsEditorPanelProps {
	documentKey: string;
	versionCode: string;
	statusTone: "warning" | "success" | "neutral";
	statusLabel: string;
	isCreatingDraft: boolean;
	title: string;
	effectiveDate: string;
	sections: TermsSection[];
	isSaving: boolean;
	onChangeVersionCode: (value: string) => void;
	onChangeTitle: (value: string) => void;
	onChangeEffectiveDate: (value: string) => void;
	onChangeSections: (sections: TermsSection[]) => void;
	onOpenPreview: () => void;
	onSaveDraftOrChanges: () => void;
}

export const AdminTermsEditorPanel: React.FC<AdminTermsEditorPanelProps> = ({
	documentKey,
	versionCode,
	statusTone,
	statusLabel,
	isCreatingDraft,
	title,
	effectiveDate,
	sections,
	isSaving,
	onChangeVersionCode,
	onChangeTitle,
	onChangeEffectiveDate,
	onChangeSections,
	onOpenPreview,
	onSaveDraftOrChanges,
}) => {
	return (
		<section className="rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-xs">
			{/* Top bar */}
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef2ee] pb-4">
				<div className="flex flex-wrap items-center gap-2.5">
					<h2 className="text-base font-bold text-[#10221b]">
						Chỉnh sửa phiên bản {formatTermsVersionLabel(versionCode || "1.0")}
					</h2>
					<StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<Button variant="outline" size="sm" onClick={onOpenPreview} className="gap-1.5">
						<Eye className="size-4" />
						<span>Xem trước</span>
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={onSaveDraftOrChanges}
						disabled={isSaving}
						className="gap-1.5"
					>
						<Save className="size-4" />
						<span>{isSaving ? "Đang lưu..." : isCreatingDraft ? "Lưu nháp" : "Lưu thay đổi"}</span>
					</Button>
				</div>
			</div>

			{/* Metadata inputs */}
			<div className="mt-4 space-y-4">
				<div>
					<label
						htmlFor="admin-terms-title"
						className="mb-1.5 block text-xs font-semibold text-[#2f4c40]"
					>
						Tiêu đề <span className="text-red-600">*</span>
					</label>
					<input
						id="admin-terms-title"
						type="text"
						value={title}
						onChange={(event) => onChangeTitle(event.target.value)}
						placeholder="Điều khoản và Chính sách sử dụng CTMS"
						className="w-full rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2 text-sm text-[#10221b] outline-none transition focus:border-[#164027]"
					/>
				</div>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<label
							htmlFor="admin-terms-version"
							className="mb-1.5 block text-xs font-semibold text-[#2f4c40]"
						>
							Phiên bản
						</label>
						<input
							id="admin-terms-version"
							type="text"
							value={versionCode}
							readOnly={!isCreatingDraft}
							onChange={(event) => onChangeVersionCode(event.target.value)}
							placeholder="Ví dụ: 1.1"
							className={`w-full rounded-xl border border-[#dfe8df] px-3.5 py-2 text-sm outline-none transition ${
								isCreatingDraft
									? "bg-white text-[#10221b] focus:border-[#164027]"
									: "bg-[#f4f7f2] text-[#54655a]"
							}`}
						/>
					</div>

					<div>
						<label
							htmlFor="admin-terms-date"
							className="mb-1.5 block text-xs font-semibold text-[#2f4c40]"
						>
							Ngày hiệu lực <span className="text-red-600">*</span>
						</label>
						<input
							id="admin-terms-date"
							type="date"
							value={effectiveDate}
							onChange={(event) => onChangeEffectiveDate(event.target.value)}
							className="w-full rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2 text-sm text-[#10221b] outline-none transition focus:border-[#164027]"
						/>
					</div>
				</div>
			</div>

			{/* Word-like Continuous Document Editor */}
			<TermsWordEditor
				documentKey={documentKey}
				sections={sections}
				onChangeSections={onChangeSections}
			/>
		</section>
	);
};
