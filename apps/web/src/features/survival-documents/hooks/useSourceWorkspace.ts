import { useState } from "react";
import { HttpError } from "../../../core/api/httpClient";
import { toast } from "../../../shared/components/Toast";
import { SOURCE_PAGE_SIZE } from "../constants";
import { duplicatePdfSchema } from "../schema/source.schema";
import { sourceActionErrorMessage } from "../services/survival-documents.service";
import type {
	DocumentDetail,
	PdfSource,
	SourceAction,
	SourceDecision,
	SourceFilters,
	SourceMetadata,
	SourceRights,
	SourceVersion,
} from "../types";
import { useSurvivalDocuments } from "./useSurvivalDocuments";
type FormMode =
	| { kind: "create" }
	| { kind: "version"; document: DocumentDetail; version: SourceVersion }
	| { kind: "edit"; version: SourceVersion };

function publicationRights(metadata: SourceMetadata): SourceRights | undefined {
	const { attribution, classification, licenseType, locale, originalLocale, permissionEvidence } =
		metadata;
	if (
		!attribution ||
		!licenseType ||
		!permissionEvidence ||
		classification === "FIRST_AID" ||
		classification === "MEDICAL_REFERENCE" ||
		(originalLocale && originalLocale !== locale)
	)
		return;
	return {
		rightsReviewStatus: "PERMITTED",
		sourceReviewConfirmed: true,
		internalRagUseAllowed: true,
		offlineRedistributionAllowed: false,
		translationAllowed: false,
		medicalContentReviewStatus: "NOT_REVIEWED",
		evidence: permissionEvidence,
	};
}

export function useSourceWorkspace() {
	const [filters, setFilters] = useState<SourceFilters>({
		page: 1,
		limit: SOURCE_PAGE_SIZE,
		search: "",
	});
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
	const [mode, setMode] = useState<FormMode | null>(null);
	const [notice, setNotice] = useState("");
	const state = useSurvivalDocuments(filters, selectedId);
	const busy =
		state.upload.isPending ||
		state.importUrl.isPending ||
		state.action.isPending ||
		state.remove.isPending ||
		state.edit.isPending;
	function openForm(next: FormMode) {
		state.upload.reset();
		state.importUrl.reset();
		state.edit.reset();
		state.action.reset();
		setNotice("");
		setMode(next);
	}
	function openDocument(id: string | null, versionId: string | null = null) {
		state.action.reset();
		state.remove.reset();
		setSelectedId(id);
		setSelectedVersionId(versionId);
	}
	async function deleteDocument(documentId: string, expectedRevision: number) {
		setNotice("");
		try {
			await state.remove.mutateAsync({ documentId, expectedRevision });
			openDocument(null);
			setFilters((current) => ({ ...current, page: 1 }));
			setNotice("Đã xóa tài liệu.");
		} catch {
			/* The detail dialog shows the server error and refreshed revision. */
		}
	}
	function selectVersion(id: string) {
		state.action.reset();
		setSelectedVersionId(id);
	}
	async function actOnVersion(
		version: SourceVersion,
		action: SourceAction,
		payload: SourceDecision,
		savedFromEditor = false
	) {
		setNotice("");
		try {
			const decision =
				action === "publish" || action === "prepare"
					? {
							...payload,
							expectedDocumentRevision:
								payload.expectedDocumentRevision ?? state.detail.data?.revision,
							confirmSource: true,
							rights: publicationRights(version.metadata) ?? payload.rights,
						}
					: action === "restore"
						? {
								...payload,
								expectedDocumentRevision:
									payload.expectedDocumentRevision ?? state.detail.data?.revision,
							}
						: payload;
			const updated = await state.action.mutateAsync({
				documentId: version.documentId,
				versionId: version.id,
				action,
				payload: decision,
			});
			if (action === "publish") {
				openDocument(null);
				toast.success("Đã xuất bản tài liệu.");
			} else if (action === "prepare") {
				openDocument(updated.id, version.id);
				toast.success("Đã ghi nhận xác nhận nguồn. Hệ thống sẽ chuẩn bị nội dung cho bản nháp.");
			} else if (action === "restore") {
				openDocument(updated.id, updated.versions[0].id);
				toast.success("Đã khôi phục nội dung thành bản nháp mới.");
			} else {
				toast.success("Đã ngừng sử dụng tài liệu.");
			}
			return true;
		} catch (error) {
			if (savedFromEditor) {
				const message = sourceActionErrorMessage(error);
				toast.error(message, "Đã lưu bản nháp. Thao tác chưa hoàn tất.");
			} else toast.error(sourceActionErrorMessage(error));
			return false;
		}
	}
	async function save(metadata: SourceMetadata, source?: PdfSource, preparePublication = false) {
		if (!mode) return;
		try {
			if (mode.kind === "edit")
				await state.edit.mutateAsync({
					documentId: mode.version.documentId,
					versionId: mode.version.id,
					revision: mode.version.revision,
					metadata,
				});
			else {
				if (!source) return;
				const document = mode.kind === "version" ? mode.document : undefined;
				const result =
					source.kind === "upload"
						? await state.upload.mutateAsync({ metadata, document, file: source.file })
						: await state.importUrl.mutateAsync({
								metadata,
								document,
								sourceUrl: source.sourceUrl,
							});
				const versionNumber = (document?.versionCount ?? 0) + 1;
				const savedVersion = result.versions.find(
					(version) => version.versionNumber === versionNumber
				);
				if (preparePublication && savedVersion) {
					setMode(null);
					openDocument(result.id, savedVersion.id);
					await actOnVersion(
						savedVersion,
						"prepare",
						{ expectedRevision: savedVersion.revision, expectedDocumentRevision: result.revision },
						true
					);
					return;
				}
				openDocument(result.id, savedVersion?.id);
			}
			setMode(null);
			setNotice("Đã lưu bản nháp riêng tư.");
		} catch {
			/* Preserve form values and show the validated server response. */
		}
	}
	let formMetadata: SourceMetadata | undefined;
	if (mode?.kind === "edit") formMetadata = mode.version.metadata;
	if (mode?.kind === "version") {
		const { sourceTitle, classification, locale, publisher } = mode.version.metadata;
		formMetadata = { sourceTitle, classification, locale, publisher };
	}
	const mutationError =
		mode?.kind === "edit" ? state.edit.error : (state.upload.error ?? state.importUrl.error);
	const formError =
		mutationError instanceof HttpError && mutationError.status === 413
			? new Error("Tệp PDF vượt quá dung lượng cho phép.")
			: mutationError;
	const duplicate =
		formError instanceof HttpError && formError.status === 409
			? duplicatePdfSchema.safeParse(formError.errorData)
			: undefined;
	const duplicatePdf = duplicate?.success ? duplicate.data : undefined;
	function openDuplicate() {
		if (!duplicatePdf) return;
		openDocument(duplicatePdf.documentId, duplicatePdf.versionId);
		setMode(null);
	}
	function resetPdfError() {
		state.upload.reset();
		state.importUrl.reset();
	}
	return {
		state,
		filters,
		setFilters,
		selectedId,
		selectedVersionId,
		openDocument,
		selectVersion,
		mode,
		setMode,
		notice,
		busy,
		openForm,
		actOnVersion,
		deleteDocument,
		save,
		formMetadata,
		formError,
		duplicatePdf,
		openDuplicate,
		resetPdfError,
	};
}
