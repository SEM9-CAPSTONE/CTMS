import { useState } from "react";
import { HttpError } from "../../../core/api/httpClient";
import { toast } from "../../../shared/components/Toast";
import { SOURCE_PAGE_SIZE } from "../constants";
import { duplicatePdfSchema } from "../schema/source.schema";
import type {
	DocumentDetail,
	PdfSource,
	SourceAction,
	SourceDecision,
	SourceFilters,
	SourceMetadata,
	SourceVersion,
} from "../types";
import { useSurvivalDocuments } from "./useSurvivalDocuments";
type FormMode =
	| { kind: "create" }
	| { kind: "version"; document: DocumentDetail; version: SourceVersion }
	| { kind: "edit"; version: SourceVersion };
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
			await state.action.mutateAsync({
				documentId: version.documentId,
				versionId: version.id,
				action,
				payload,
			});
			if (action === "publish") {
				openDocument(null);
				toast.success("Đã xuất bản tài liệu.");
			} else {
				setNotice("Đã ngừng sử dụng tài liệu.");
			}
		} catch (error) {
			if (savedFromEditor) {
				const message = error instanceof Error ? error.message : "Vui lòng thử lại.";
				toast.error(message, "Đã lưu bản nháp. Xuất bản chưa thành công.");
			}
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
					openDocument(null);
					await actOnVersion(
						savedVersion,
						"publish",
						{ expectedRevision: savedVersion.revision },
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
	const formError =
		mode?.kind === "edit" ? state.edit.error : (state.upload.error ?? state.importUrl.error);
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
