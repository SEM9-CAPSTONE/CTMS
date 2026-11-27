import { ExternalLink, FilePlus2, Save } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { Button, Modal, PageSkeleton, StatusBadge, useToast } from "../../../shared/components";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { formatTermsDate, formatTermsVersionLabel } from "../constants";
import {
	useCurrentTerms,
	usePublishTermsVersion,
	useTermsVersionDetail,
	useTermsVersions,
	useUpdateTermsVersion,
} from "../hooks/useTerms";
import type { TermsSection } from "../types";

export interface AdminTermsManagementPageProps {
	onLogout: (allDevices: boolean) => Promise<void>;
	onOpenPublicTerms: () => void;
}

function suggestNextVersion(currentVersion: string): string {
	const clean = currentVersion.trim().replace(/^[vV]/, "");
	const parts = clean.split(".");
	if (parts.length >= 2) {
		const minor = Number(parts[1]);
		if (Number.isInteger(minor)) {
			return `${parts[0]}.${minor + 1}`;
		}
	}
	return `${clean}.1`;
}

export const AdminTermsManagementPage: React.FC<AdminTermsManagementPageProps> = ({
	onLogout,
	onOpenPublicTerms,
}) => {
	const toast = useToast();
	const currentQuery = useCurrentTerms();
	const versionsQuery = useTermsVersions(true);
	const publishMutation = usePublishTermsVersion();
	const updateMutation = useUpdateTermsVersion();

	const [selectedCode, setSelectedCode] = useState<string | null>(null);
	const selectedDetailQuery = useTermsVersionDetail(
		selectedCode && selectedCode !== currentQuery.data?.version ? selectedCode : null
	);

	const sourceVersion =
		selectedCode && selectedCode !== currentQuery.data?.version
			? selectedDetailQuery.data
			: currentQuery.data;

	const [title, setTitle] = useState("");
	const [summary, setSummary] = useState("");
	const [effectiveDate, setEffectiveDate] = useState("");
	const [requiresReconsent, setRequiresReconsent] = useState(true);
	const [sections, setSections] = useState<TermsSection[]>([]);
	const [activeSectionNumber, setActiveSectionNumber] = useState<number>(1);
	const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
	const [newVersionCode, setNewVersionCode] = useState("1.1");
	const [newVersionEffectiveDate, setNewVersionEffectiveDate] = useState("");
	const [newVersionSummary, setNewVersionSummary] = useState("");
	const [newVersionRequiresReconsent, setNewVersionRequiresReconsent] = useState(true);

	useEffect(() => {
		if (!sourceVersion) return;
		setTitle(sourceVersion.title);
		setSummary(sourceVersion.summary ?? "");
		setEffectiveDate(sourceVersion.effectiveDate.slice(0, 10));
		setRequiresReconsent(sourceVersion.requiresReconsent);
		setSections(structuredClone(sourceVersion.sections));
		setActiveSectionNumber(sourceVersion.sections[0]?.number ?? 1);
	}, [sourceVersion]);

	const activeSection = sections.find((item) => item.number === activeSectionNumber) ?? sections[0];

	const updateSectionField = (
		sectionNumber: number,
		updater: (section: TermsSection) => TermsSection
	) => {
		setSections((prev) =>
			prev.map((item) => (item.number === sectionNumber ? updater(item) : item))
		);
	};

	const handleSaveExisting = async () => {
		if (!sourceVersion) return;
		if (!title.trim() || !effectiveDate.trim() || sections.length === 0) {
			toast.error("Vui lòng nhập đầy đủ tiêu đề, ngày hiệu lực và nội dung các mục.");
			return;
		}
		try {
			await updateMutation.mutateAsync({
				id: sourceVersion.id,
				payload: {
					title: title.trim(),
					summary: summary.trim() || null,
					effectiveDate,
					requiresReconsent,
					sections,
				},
			});
			toast.success(
				`Đã cập nhật nội dung phiên bản ${formatTermsVersionLabel(sourceVersion.version)}.`
			);
		} catch {
			toast.error("Không thể lưu thay đổi điều khoản. Vui lòng thử lại.");
		}
	};

	const openPublishModal = () => {
		const baseVersion = currentQuery.data?.version ?? sourceVersion?.version ?? "1.0";
		setNewVersionCode(suggestNextVersion(baseVersion));
		const today = new Date();
		const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
		setNewVersionEffectiveDate(isoToday);
		setNewVersionSummary(summary.trim());
		setNewVersionRequiresReconsent(true);
		setIsPublishModalOpen(true);
	};

	const handlePublishNewVersion = async () => {
		if (!newVersionCode.trim() || !title.trim() || !newVersionEffectiveDate.trim()) {
			toast.error("Vui lòng nhập mã phiên bản mới, tiêu đề và ngày hiệu lực.");
			return;
		}
		try {
			const created = await publishMutation.mutateAsync({
				version: newVersionCode.trim(),
				title: title.trim(),
				summary: newVersionSummary.trim() || null,
				effectiveDate: newVersionEffectiveDate,
				requiresReconsent: newVersionRequiresReconsent,
				sections,
			});
			setIsPublishModalOpen(false);
			setSelectedCode(created.version);
			toast.success(
				`Đã công bố phiên bản ${formatTermsVersionLabel(created.version)} làm phiên bản hiệu lực.`
			);
		} catch {
			toast.error("Không thể công bố phiên bản mới. Kiểm tra mã phiên bản có bị trùng hay không.");
		}
	};

	const isLoading =
		currentQuery.isLoading || (Boolean(selectedCode) && selectedDetailQuery.isLoading);

	return (
		<AdminLayout activeItem="terms-and-policy" onLogout={onLogout}>
			<main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
				{/* Header */}
				<div className="flex flex-col gap-4 border-b border-[#dfe8df] pb-5 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h1 className="text-2xl font-bold tracking-tight text-[#10221b]">
							Quản lý Điều khoản và Chính sách
						</h1>
						<p className="mt-1 text-sm text-[#54655a]">
							Chỉnh sửa nội dung 12 mục chính sách và công bố phiên bản mới đồng bộ trên trang web
							và ứng dụng di động.
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2.5">
						<Button variant="outline" size="sm" onClick={onOpenPublicTerms} className="gap-1.5">
							<ExternalLink className="size-4" />
							<span>Xem trang công khai</span>
						</Button>
						<Button
							variant="secondary"
							size="sm"
							onClick={() => void handleSaveExisting()}
							disabled={!sourceVersion || updateMutation.isPending}
							className="gap-1.5"
						>
							<Save className="size-4" />
							<span>{updateMutation.isPending ? "Đang lưu..." : "Lưu bản đang chọn"}</span>
						</Button>
						<Button
							variant="primary"
							size="sm"
							onClick={openPublishModal}
							disabled={!sourceVersion || publishMutation.isPending}
							className="gap-1.5 bg-[#164027] hover:bg-[#0f2e1c]"
						>
							<FilePlus2 className="size-4" />
							<span>Công bố phiên bản mới</span>
						</Button>
					</div>
				</div>

				{isLoading && <PageSkeleton />}

				{!isLoading && sourceVersion && (
					<>
						{/* Version bar + Metadata */}
						<section className="rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-xs">
							<div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef2ee] pb-4">
								<div className="flex flex-wrap items-center gap-2.5">
									<span className="text-xs font-semibold tracking-wide text-[#54655a]">
										Phiên bản đang chỉnh sửa:
									</span>
									<select
										aria-label="Chọn phiên bản điều khoản"
										value={sourceVersion.version}
										onChange={(event) => setSelectedCode(event.target.value)}
										className="rounded-xl border border-[#dfe8df] bg-[#f9fbf8] px-3 py-1.5 text-sm font-bold text-[#10221b] focus:border-[#164027] focus:outline-none"
									>
										{(versionsQuery.data ?? [sourceVersion]).map((item) => (
											<option key={item.id} value={item.version}>
												{formatTermsVersionLabel(item.version)} ({item.isActive ? "hiện tại" : "cũ"}
												) · {formatTermsDate(item.effectiveDate)}
											</option>
										))}
									</select>
									<StatusBadge tone={sourceVersion.isActive ? "success" : "neutral"}>
										{sourceVersion.isActive ? "đang hiệu lực" : "lịch sử"}
									</StatusBadge>
								</div>
								<span className="text-xs text-[#667a6d]">
									Số mục: <strong className="text-[#10221b]">{sections.length}</strong>
								</span>
							</div>

							<div className="mt-4 grid gap-4 md:grid-cols-3">
								<div className="md:col-span-2">
									<label
										htmlFor="admin-terms-title"
										className="mb-1.5 block text-xs font-semibold text-[#425048]"
									>
										Tiêu đề tài liệu
									</label>
									<input
										id="admin-terms-title"
										type="text"
										value={title}
										onChange={(event) => setTitle(event.target.value)}
										className="w-full rounded-xl border border-[#dfe8df] px-3.5 py-2 text-sm text-[#10221b] focus:border-[#164027] focus:outline-none"
									/>
								</div>
								<div>
									<label
										htmlFor="admin-terms-date"
										className="mb-1.5 block text-xs font-semibold text-[#425048]"
									>
										Ngày hiệu lực
									</label>
									<input
										id="admin-terms-date"
										type="date"
										value={effectiveDate}
										onChange={(event) => setEffectiveDate(event.target.value)}
										className="w-full rounded-xl border border-[#dfe8df] px-3.5 py-2 text-sm text-[#10221b] focus:border-[#164027] focus:outline-none"
									/>
								</div>
							</div>

							<div className="mt-4">
								<label
									htmlFor="admin-terms-summary"
									className="mb-1.5 block text-xs font-semibold text-[#425048]"
								>
									Tóm tắt thay đổi (hiển thị trong lịch sử phiên bản và hộp thoại thông báo)
								</label>
								<textarea
									id="admin-terms-summary"
									rows={2}
									value={summary}
									onChange={(event) => setSummary(event.target.value)}
									className="w-full rounded-xl border border-[#dfe8df] px-3.5 py-2 text-sm text-[#10221b] focus:border-[#164027] focus:outline-none"
								/>
							</div>

							<label className="mt-4 flex cursor-pointer items-start gap-2.5 text-xs text-[#2f4c40]">
								<input
									type="checkbox"
									checked={requiresReconsent}
									onChange={(event) => setRequiresReconsent(event.target.checked)}
									className="mt-0.5 size-4 rounded border-[#b8c7bc] accent-[#164027]"
								/>
								<span>
									Yêu cầu người dùng xác nhận lại điều khoản cho phiên bản này (chỉ áp dụng cho
									Người tham gia, Đơn vị tổ chức và Người dẫn đường; Quản trị viên không nhận hộp
									thoại nhắc).
								</span>
							</label>
						</section>

						{/* 12 Sections Editor */}
						<section className="grid gap-6 lg:grid-cols-12">
							<nav
								aria-label="Danh sách 12 mục chỉnh sửa"
								className="rounded-2xl border border-[#dfe8df] bg-white p-3 shadow-xs lg:col-span-4"
							>
								<h2 className="px-2 pb-2.5 text-xs font-bold tracking-wide text-[#54655a]">
									Danh mục 12 mục điều khoản
								</h2>
								<ul className="space-y-1">
									{sections.map((section) => {
										const isSelected = section.number === activeSection?.number;
										return (
											<li key={section.number}>
												<button
													type="button"
													onClick={() => setActiveSectionNumber(section.number)}
													className={`w-full cursor-pointer rounded-xl px-3 py-2 text-left text-sm transition-colors ${
														isSelected
															? "bg-[#e8f3eb] font-bold text-[#164027]"
															: "font-medium text-[#425048] hover:bg-[#f4f7f2]"
													}`}
												>
													{section.number}. {section.title}
												</button>
											</li>
										);
									})}
								</ul>
							</nav>

							{activeSection && (
								<div className="space-y-5 rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-xs lg:col-span-8">
									<div className="border-b border-[#eef2ee] pb-4">
										<label
											htmlFor="admin-section-title"
											className="mb-1.5 block text-xs font-semibold text-[#54655a]"
										>
											Tiêu đề Mục {activeSection.number}
										</label>
										<input
											id="admin-section-title"
											type="text"
											value={activeSection.title}
											onChange={(event) =>
												updateSectionField(activeSection.number, (sec) => ({
													...sec,
													title: event.target.value,
												}))
											}
											className="w-full rounded-xl border border-[#dfe8df] px-3.5 py-2 text-sm font-bold text-[#10221b] focus:border-[#164027] focus:outline-none"
										/>
									</div>

									<div className="space-y-4">
										{activeSection.subsections.map((sub, idx) => (
											<div
												key={sub.code}
												className="space-y-2.5 border-b border-[#eef2ee] pb-4 last:border-b-0 last:pb-0"
											>
												<div className="grid gap-3 sm:grid-cols-4">
													<div>
														<label
															htmlFor={`sub-code-${idx}`}
															className="mb-1 block text-xs font-medium text-[#54655a]"
														>
															Mã mục con
														</label>
														<input
															id={`sub-code-${idx}`}
															type="text"
															value={sub.code}
															onChange={(event) =>
																updateSectionField(activeSection.number, (sec) => ({
																	...sec,
																	subsections: sec.subsections.map((item, i) =>
																		i === idx ? { ...item, code: event.target.value } : item
																	),
																}))
															}
															className="w-full rounded-xl border border-[#dfe8df] px-3 py-1.5 text-sm text-[#10221b]"
														/>
													</div>
													<div className="sm:col-span-3">
														<label
															htmlFor={`sub-title-${idx}`}
															className="mb-1 block text-xs font-medium text-[#54655a]"
														>
															Tiêu đề mục con
														</label>
														<input
															id={`sub-title-${idx}`}
															type="text"
															value={sub.title}
															onChange={(event) =>
																updateSectionField(activeSection.number, (sec) => ({
																	...sec,
																	subsections: sec.subsections.map((item, i) =>
																		i === idx ? { ...item, title: event.target.value } : item
																	),
																}))
															}
															className="w-full rounded-xl border border-[#dfe8df] px-3 py-1.5 text-sm font-semibold text-[#10221b]"
														/>
													</div>
												</div>

												<div>
													<label
														htmlFor={`sub-body-${idx}`}
														className="mb-1 block text-xs font-medium text-[#54655a]"
													>
														Nội dung chi tiết
													</label>
													<textarea
														id={`sub-body-${idx}`}
														rows={4}
														value={sub.body}
														onChange={(event) =>
															updateSectionField(activeSection.number, (sec) => ({
																...sec,
																subsections: sec.subsections.map((item, i) =>
																	i === idx ? { ...item, body: event.target.value } : item
																),
															}))
														}
														className="w-full rounded-xl border border-[#dfe8df] px-3.5 py-2 text-sm leading-relaxed text-[#10221b] focus:border-[#164027] focus:outline-none"
													/>
												</div>
											</div>
										))}
									</div>

									<div className="border-t border-[#eef2ee] pt-4">
										<label
											htmlFor="admin-section-callout"
											className="mb-1.5 block text-xs font-semibold text-[#54655a]"
										>
											Ghi chú nhấn mạnh cuối mục (không bắt buộc)
										</label>
										<textarea
											id="admin-section-callout"
											rows={2}
											value={activeSection.callout ?? ""}
											onChange={(event) =>
												updateSectionField(activeSection.number, (sec) => ({
													...sec,
													callout: event.target.value || undefined,
												}))
											}
											placeholder="Để trống nếu mục này không cần khung ghi chú nổi bật."
											className="w-full rounded-xl border border-[#dfe8df] px-3.5 py-2 text-sm text-[#10221b] focus:border-[#164027] focus:outline-none"
										/>
									</div>
								</div>
							)}
						</section>
					</>
				)}
			</main>

			<Modal
				isOpen={isPublishModalOpen}
				onClose={() => setIsPublishModalOpen(false)}
				title="Công bố phiên bản Điều khoản mới"
				description="Phiên bản cũ sẽ được giữ lại trong Lịch sử phiên bản và phiên bản mới sẽ có hiệu lực ngay."
				size="md"
				isCloseDisabled={publishMutation.isPending}
			>
				<div className="space-y-4">
					<div>
						<label
							htmlFor="publish-version-code"
							className="mb-1 block text-xs font-semibold text-[#425048]"
						>
							Số phiên bản mới
						</label>
						<input
							id="publish-version-code"
							type="text"
							value={newVersionCode}
							onChange={(event) => setNewVersionCode(event.target.value)}
							placeholder="Ví dụ: 1.1"
							className="w-full rounded-xl border border-[#dfe8df] px-3.5 py-2 text-sm text-[#10221b]"
						/>
					</div>

					<div>
						<label
							htmlFor="publish-effective-date"
							className="mb-1 block text-xs font-semibold text-[#425048]"
						>
							Ngày hiệu lực
						</label>
						<input
							id="publish-effective-date"
							type="date"
							value={newVersionEffectiveDate}
							onChange={(event) => setNewVersionEffectiveDate(event.target.value)}
							className="w-full rounded-xl border border-[#dfe8df] px-3.5 py-2 text-sm text-[#10221b]"
						/>
					</div>

					<div>
						<label
							htmlFor="publish-summary"
							className="mb-1 block text-xs font-semibold text-[#425048]"
						>
							Tóm tắt điểm thay đổi
						</label>
						<textarea
							id="publish-summary"
							rows={3}
							value={newVersionSummary}
							onChange={(event) => setNewVersionSummary(event.target.value)}
							placeholder="Nêu ngắn gọn các điểm thay đổi chính để người dùng nắm bắt..."
							className="w-full rounded-xl border border-[#dfe8df] px-3.5 py-2 text-sm text-[#10221b]"
						/>
					</div>

					<label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#dfe8df] bg-[#f9fbf8] p-3 text-xs text-[#2f4c40]">
						<input
							type="checkbox"
							checked={newVersionRequiresReconsent}
							onChange={(event) => setNewVersionRequiresReconsent(event.target.checked)}
							className="mt-0.5 size-4 rounded border-[#b8c7bc] accent-[#164027]"
						/>
						<span>
							Thông báo và yêu cầu người dùng đọc, xác nhận lại phiên bản mới trên trang web và ứng
							dụng di động.
						</span>
					</label>

					<div className="flex justify-end gap-2.5 border-t border-[#eef2ee] pt-4">
						<Button
							variant="outline"
							onClick={() => setIsPublishModalOpen(false)}
							disabled={publishMutation.isPending}
						>
							Hủy
						</Button>
						<Button
							variant="primary"
							onClick={() => void handlePublishNewVersion()}
							disabled={publishMutation.isPending}
							className="bg-[#164027] hover:bg-[#0f2e1c]"
						>
							{publishMutation.isPending ? "Đang công bố..." : "Xác nhận công bố"}
						</Button>
					</div>
				</div>
			</Modal>
		</AdminLayout>
	);
};
