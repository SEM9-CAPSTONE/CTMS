import type React from "react";
import { useEffect, useState } from "react";
import { PageSkeleton, useToast } from "../../../shared/components";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { AdminTermsEditorPanel } from "../components/AdminTermsEditorPanel";
import { AdminTermsPreviewModal } from "../components/AdminTermsPreviewModal";
import { AdminTermsUpdatePanel } from "../components/AdminTermsUpdatePanel";
import { AdminTermsVersionSidebar } from "../components/AdminTermsVersionSidebar";
import { formatTermsVersionLabel } from "../constants";
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

interface StoredDraft {
	versionCode: string;
	title: string;
	summary: string;
	effectiveDate: string;
	requiresReconsent: boolean;
	sections: TermsSection[];
	updatedAtLabel: string;
}

const ADMIN_TERMS_DRAFT_STORAGE_KEY = "ctms:admin-terms-draft";

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

function formatNowLabel(): string {
	const now = new Date();
	const dd = String(now.getDate()).padStart(2, "0");
	const mm = String(now.getMonth() + 1).padStart(2, "0");
	const yyyy = now.getFullYear();
	const hh = String(now.getHours()).padStart(2, "0");
	const min = String(now.getMinutes()).padStart(2, "0");
	return `${dd}/${mm}/${yyyy}, ${hh}:${min}`;
}

function getTodayIsoDate(): string {
	const today = new Date();
	return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function readStoredDraft(): StoredDraft | null {
	try {
		const raw = localStorage.getItem(ADMIN_TERMS_DRAFT_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<StoredDraft>;
		if (!parsed.versionCode || !Array.isArray(parsed.sections)) return null;
		return {
			versionCode: parsed.versionCode,
			title: parsed.title ?? "",
			summary: parsed.summary ?? "",
			effectiveDate: parsed.effectiveDate ?? getTodayIsoDate(),
			requiresReconsent: parsed.requiresReconsent ?? true,
			sections: parsed.sections,
			updatedAtLabel: parsed.updatedAtLabel ?? formatNowLabel(),
		};
	} catch {
		return null;
	}
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

	const [savedDraft, setSavedDraft] = useState<StoredDraft | null>(() => readStoredDraft());
	const [isCreatingDraft, setIsCreatingDraft] = useState<boolean>(false);
	const [selectedCode, setSelectedCode] = useState<string | null>(null);
	const [isPreviewOpen, setIsPreviewOpen] = useState(false);
	const [editorSessionKey, setEditorSessionKey] = useState<string>("init");

	const selectedDetailQuery = useTermsVersionDetail(
		!isCreatingDraft && selectedCode && selectedCode !== currentQuery.data?.version
			? selectedCode
			: null
	);

	const sourceVersion =
		!isCreatingDraft && selectedCode && selectedCode !== currentQuery.data?.version
			? selectedDetailQuery.data
			: currentQuery.data;

	const [versionCode, setVersionCode] = useState("");
	const [title, setTitle] = useState("");
	const [summary, setSummary] = useState("");
	const [effectiveDate, setEffectiveDate] = useState("");
	const [requiresReconsent, setRequiresReconsent] = useState(true);
	const [sections, setSections] = useState<TermsSection[]>([]);

	useEffect(() => {
		if (isCreatingDraft || !sourceVersion) return;
		setVersionCode(sourceVersion.version);
		setTitle(sourceVersion.title);
		setSummary(sourceVersion.summary ?? "");
		setEffectiveDate(sourceVersion.effectiveDate.slice(0, 10));
		setRequiresReconsent(sourceVersion.requiresReconsent);
		setSections(structuredClone(sourceVersion.sections));
		setEditorSessionKey(`version-${sourceVersion.id}-${sourceVersion.version}`);
	}, [isCreatingDraft, sourceVersion]);

	const handleCreateNewDraft = () => {
		const base = currentQuery.data ?? sourceVersion;
		if (!base) return;
		const nextCode = suggestNextVersion(base.version);
		const draft: StoredDraft = {
			versionCode: nextCode,
			title: base.title,
			summary: "",
			effectiveDate: getTodayIsoDate(),
			requiresReconsent: true,
			sections: structuredClone(base.sections),
			updatedAtLabel: formatNowLabel(),
		};
		setSavedDraft(draft);
		setIsCreatingDraft(true);
		setVersionCode(draft.versionCode);
		setTitle(draft.title);
		setSummary(draft.summary);
		setEffectiveDate(draft.effectiveDate);
		setRequiresReconsent(draft.requiresReconsent);
		setSections(draft.sections);
		setEditorSessionKey(`draft-new-${Date.now()}`);
	};

	const handleSelectDraft = () => {
		if (!savedDraft) return;
		setIsCreatingDraft(true);
		setVersionCode(savedDraft.versionCode);
		setTitle(savedDraft.title);
		setSummary(savedDraft.summary);
		setEffectiveDate(savedDraft.effectiveDate);
		setRequiresReconsent(savedDraft.requiresReconsent);
		setSections(structuredClone(savedDraft.sections));
		setEditorSessionKey(`draft-resume-${savedDraft.versionCode}-${savedDraft.updatedAtLabel}`);
	};

	const handleSelectVersion = (code: string) => {
		setIsCreatingDraft(false);
		setSelectedCode(code);
	};

	const handleSaveDraftLocally = () => {
		if (!versionCode.trim()) {
			toast.error("Vui lòng nhập mã phiên bản nháp trước khi lưu.");
			return;
		}
		const draft: StoredDraft = {
			versionCode: versionCode.trim(),
			title: title.trim(),
			summary,
			effectiveDate: effectiveDate || getTodayIsoDate(),
			requiresReconsent,
			sections: structuredClone(sections),
			updatedAtLabel: formatNowLabel(),
		};
		setSavedDraft(draft);
		try {
			localStorage.setItem(ADMIN_TERMS_DRAFT_STORAGE_KEY, JSON.stringify(draft));
		} catch {
			// Ignore storage quota issues and keep draft in memory
		}
		toast.success(`Đã lưu nháp phiên bản ${formatTermsVersionLabel(draft.versionCode)}.`);
	};

	const handleSaveExistingVersion = async () => {
		if (!sourceVersion) return;
		if (!title.trim() || !effectiveDate.trim() || sections.length === 0) {
			toast.error("Vui lòng nhập đầy đủ tiêu đề, ngày hiệu lực và nội dung điều khoản.");
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
			toast.success(`Đã cập nhật phiên bản ${formatTermsVersionLabel(sourceVersion.version)}.`);
		} catch {
			toast.error("Không thể cập nhật phiên bản điều khoản. Vui lòng thử lại.");
		}
	};

	const handleSubmitVersion = async () => {
		if (isCreatingDraft) {
			if (!versionCode.trim() || !title.trim() || !effectiveDate.trim() || sections.length === 0) {
				toast.error("Vui lòng nhập mã phiên bản mới, tiêu đề, ngày hiệu lực và nội dung.");
				return;
			}
			if (!summary.trim()) {
				toast.error("Vui lòng nhập tóm tắt thay đổi cho phiên bản mới.");
				return;
			}
			try {
				const created = await publishMutation.mutateAsync({
					version: versionCode.trim(),
					title: title.trim(),
					summary: summary.trim(),
					effectiveDate,
					requiresReconsent,
					sections,
				});
				setSavedDraft(null);
				try {
					localStorage.removeItem(ADMIN_TERMS_DRAFT_STORAGE_KEY);
				} catch {
					// Ignore storage cleanup error
				}
				setIsCreatingDraft(false);
				setSelectedCode(created.version);
				toast.success(
					`Đã cập nhật phiên bản ${formatTermsVersionLabel(created.version)} làm phiên bản hiệu lực.`
				);
			} catch {
				toast.error(
					"Không thể cập nhật phiên bản mới. Kiểm tra mã phiên bản có bị trùng hay không."
				);
			}
			return;
		}

		await handleSaveExistingVersion();
	};

	const isLoading =
		currentQuery.isLoading ||
		(!isCreatingDraft && Boolean(selectedCode) && selectedDetailQuery.isLoading);

	const versions = versionsQuery.data ?? (currentQuery.data ? [currentQuery.data] : []);
	const activeStatusTone = isCreatingDraft
		? "warning"
		: sourceVersion?.isActive
			? "success"
			: "neutral";
	const activeStatusLabel = isCreatingDraft
		? "Đang soạn thảo"
		: sourceVersion?.isActive
			? "Đang áp dụng"
			: "Đã hết hiệu lực";

	return (
		<AdminLayout activeItem="terms-and-policy" onLogout={onLogout}>
			<div className="min-h-screen">
				{/* Sticky Page Header */}
				<header className="sticky top-0 z-20 border-b border-[#dfe8df] bg-white/95 backdrop-blur-xs">
					<div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
						<h1 className="text-xl font-bold tracking-tight text-[#10221b] sm:text-2xl">
							Điều khoản và Chính sách sử dụng
						</h1>
					</div>
				</header>

				<div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">
					{isLoading && <PageSkeleton />}

					{!isLoading && (isCreatingDraft || sourceVersion) && (
						<div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[260px_minmax(0,1fr)_310px]">
							<AdminTermsVersionSidebar
								versions={versions}
								selectedVersionCode={sourceVersion?.version ?? null}
								isCreatingDraft={isCreatingDraft}
								draftVersionCode={savedDraft?.versionCode ?? ""}
								draftUpdatedAtLabel={savedDraft?.updatedAtLabel ?? null}
								onCreateNewDraft={handleCreateNewDraft}
								onSelectDraft={handleSelectDraft}
								onSelectVersion={handleSelectVersion}
							/>

							<AdminTermsEditorPanel
								documentKey={editorSessionKey}
								versionCode={versionCode}
								statusTone={activeStatusTone}
								statusLabel={activeStatusLabel}
								isCreatingDraft={isCreatingDraft}
								title={title}
								effectiveDate={effectiveDate}
								sections={sections}
								isSaving={updateMutation.isPending}
								onChangeVersionCode={setVersionCode}
								onChangeTitle={setTitle}
								onChangeEffectiveDate={setEffectiveDate}
								onChangeSections={setSections}
								onOpenPreview={() => setIsPreviewOpen(true)}
								onSaveDraftOrChanges={
									isCreatingDraft ? handleSaveDraftLocally : () => void handleSaveExistingVersion()
								}
							/>

							<AdminTermsUpdatePanel
								summary={summary}
								requiresReconsent={requiresReconsent}
								isSubmitting={publishMutation.isPending || updateMutation.isPending}
								onChangeSummary={setSummary}
								onChangeRequiresReconsent={setRequiresReconsent}
								onSubmitVersion={() => void handleSubmitVersion()}
								onOpenPublicTerms={onOpenPublicTerms}
							/>
						</div>
					)}
				</div>
			</div>

			<AdminTermsPreviewModal
				isOpen={isPreviewOpen}
				onClose={() => setIsPreviewOpen(false)}
				title={title}
				versionCode={versionCode}
				effectiveDate={effectiveDate}
				sections={sections}
			/>
		</AdminLayout>
	);
};
