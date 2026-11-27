import { Eye, Plus, Save, Trash2 } from "lucide-react";
import type React from "react";
import { Button, StatusBadge } from "../../../shared/components";
import { formatTermsVersionLabel } from "../constants";
import type { TermsSection } from "../types";

export interface AdminTermsEditorPanelProps {
	versionCode: string;
	statusTone: "warning" | "success" | "neutral";
	statusLabel: string;
	isCreatingDraft: boolean;
	title: string;
	effectiveDate: string;
	sections: TermsSection[];
	activeSectionNumber: number;
	isSaving: boolean;
	onChangeVersionCode: (value: string) => void;
	onChangeTitle: (value: string) => void;
	onChangeEffectiveDate: (value: string) => void;
	onSelectSectionNumber: (sectionNumber: number) => void;
	onUpdateSection: (
		sectionNumber: number,
		updater: (section: TermsSection) => TermsSection
	) => void;
	onOpenPreview: () => void;
	onSaveDraftOrChanges: () => void;
}

export const AdminTermsEditorPanel: React.FC<AdminTermsEditorPanelProps> = ({
	versionCode,
	statusTone,
	statusLabel,
	isCreatingDraft,
	title,
	effectiveDate,
	sections,
	activeSectionNumber,
	isSaving,
	onChangeVersionCode,
	onChangeTitle,
	onChangeEffectiveDate,
	onSelectSectionNumber,
	onUpdateSection,
	onOpenPreview,
	onSaveDraftOrChanges,
}) => {
	const activeSection =
		sections.find((item) => item.number === activeSectionNumber) ?? sections[0] ?? null;

	const handleAddSubsection = () => {
		if (!activeSection) return;
		const nextIndex = activeSection.subsections.length + 1;
		onUpdateSection(activeSection.number, (sec) => ({
			...sec,
			subsections: [
				...sec.subsections,
				{
					code: `${sec.number}.${nextIndex}`,
					title: "Mục mới",
					body: "",
				},
			],
		}));
	};

	const handleRemoveSubsection = (idx: number) => {
		if (!activeSection || activeSection.subsections.length <= 1) return;
		onUpdateSection(activeSection.number, (sec) => ({
			...sec,
			subsections: sec.subsections.filter((_, i) => i !== idx),
		}));
	};

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

			{/* Document-style Section Editor */}
			{activeSection && (
				<div className="mt-5 overflow-hidden rounded-xl border border-[#dfe8df]">
					{/* Editor Toolbar */}
					<div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5ede6] bg-[#f8faf7] px-3.5 py-2.5">
						<div className="flex min-w-0 flex-1 items-center gap-2">
							<label htmlFor="admin-section-selector" className="sr-only">
								Chọn mục điều khoản
							</label>
							<select
								id="admin-section-selector"
								value={activeSection.number}
								onChange={(event) => onSelectSectionNumber(Number(event.target.value))}
								className="max-w-full truncate rounded-lg border border-[#d6e2d7] bg-white px-3 py-1.5 text-xs font-bold text-[#10221b] outline-none focus:border-[#164027]"
							>
								{sections.map((sec) => (
									<option key={sec.number} value={sec.number}>
										{sec.number}. {sec.title}
									</option>
								))}
							</select>
							<span className="hidden text-xs text-[#667a6d] sm:inline">
								Mục {activeSection.number}/{sections.length}
							</span>
						</div>

						<button
							type="button"
							onClick={handleAddSubsection}
							className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#d6e2d7] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#164027] transition hover:bg-[#eef7f0]"
						>
							<Plus className="size-3.5" />
							<span>Thêm điều mục</span>
						</button>
					</div>

					{/* Editable Document Canvas */}
					<div className="space-y-5 bg-white p-4 sm:p-5">
						<div>
							<label htmlFor="admin-section-title" className="sr-only">
								Tiêu đề mục {activeSection.number}
							</label>
							<div className="flex items-center gap-2">
								<span className="text-lg font-extrabold text-[#164027]">
									{activeSection.number}.
								</span>
								<input
									id="admin-section-title"
									type="text"
									value={activeSection.title}
									onChange={(event) =>
										onUpdateSection(activeSection.number, (sec) => ({
											...sec,
											title: event.target.value,
										}))
									}
									className="w-full rounded-lg border border-transparent px-2 py-1 text-lg font-extrabold text-[#10221b] outline-none transition hover:border-[#e5ede6] focus:border-[#164027] focus:bg-[#f9fbf9]"
								/>
							</div>
						</div>

						<div className="space-y-4">
							{activeSection.subsections.map((sub, idx) => (
								<div
									key={`${activeSection.number}-${idx}`}
									className="space-y-2 border-t border-[#f0f4f0] pt-4 first:border-t-0 first:pt-0"
								>
									<div className="flex items-center gap-2">
										<input
											aria-label={`Mã điều mục ${idx + 1}`}
											type="text"
											value={sub.code}
											onChange={(event) =>
												onUpdateSection(activeSection.number, (sec) => ({
													...sec,
													subsections: sec.subsections.map((item, i) =>
														i === idx ? { ...item, code: event.target.value } : item
													),
												}))
											}
											className="w-16 shrink-0 rounded-lg border border-[#e5ede6] bg-[#f9fbf9] px-2 py-1 text-xs font-bold text-[#164027] outline-none focus:border-[#164027]"
										/>
										<input
											aria-label={`Tiêu đề điều mục ${sub.code}`}
											type="text"
											value={sub.title}
											onChange={(event) =>
												onUpdateSection(activeSection.number, (sec) => ({
													...sec,
													subsections: sec.subsections.map((item, i) =>
														i === idx ? { ...item, title: event.target.value } : item
													),
												}))
											}
											className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 text-sm font-bold text-[#10221b] outline-none transition hover:border-[#e5ede6] focus:border-[#164027] focus:bg-[#f9fbf9]"
										/>
										{activeSection.subsections.length > 1 && (
											<button
												type="button"
												onClick={() => handleRemoveSubsection(idx)}
												aria-label={`Xóa điều mục ${sub.code}`}
												className="cursor-pointer rounded-lg p-1.5 text-[#809287] transition hover:bg-red-50 hover:text-red-600"
											>
												<Trash2 className="size-3.5" />
											</button>
										)}
									</div>

									<textarea
										aria-label={`Nội dung điều mục ${sub.code}`}
										rows={4}
										value={sub.body}
										onChange={(event) =>
											onUpdateSection(activeSection.number, (sec) => ({
												...sec,
												subsections: sec.subsections.map((item, i) =>
													i === idx ? { ...item, body: event.target.value } : item
												),
											}))
										}
										className="w-full rounded-xl border border-[#e5ede6] bg-[#fcfdfc] px-3.5 py-2.5 text-sm leading-relaxed text-[#2d3e34] outline-none transition focus:border-[#164027] focus:bg-white"
									/>
								</div>
							))}
						</div>

						<div className="border-t border-[#eef2ee] pt-4">
							<label
								htmlFor="admin-section-callout"
								className="mb-1.5 block text-xs font-semibold text-[#54655a]"
							>
								Ghi chú lưu ý cuối mục (không bắt buộc)
							</label>
							<textarea
								id="admin-section-callout"
								rows={2}
								value={activeSection.callout ?? ""}
								onChange={(event) =>
									onUpdateSection(activeSection.number, (sec) => ({
										...sec,
										callout: event.target.value || undefined,
									}))
								}
								placeholder="Để trống nếu mục này không cần ghi chú nổi bật."
								className="w-full rounded-xl border border-[#e5ede6] bg-[#fcfdfc] px-3.5 py-2 text-xs leading-relaxed text-[#2d3e34] outline-none transition focus:border-[#164027] focus:bg-white"
							/>
						</div>
					</div>
				</div>
			)}
		</section>
	);
};
