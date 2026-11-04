import { useState } from "react";
import { SOURCE_PAGE_SIZE } from "../constants";
import type {
	SourceAction,
	SourceDecision,
	SourceFilters,
	SourceMetadata,
	SourceReference,
	SourceVersion,
} from "../types";
import { useSurvivalDocuments } from "./useSurvivalDocuments";
type FormMode =
	| { kind: "create"; reference?: SourceReference }
	| { kind: "version" }
	| { kind: "edit"; version: SourceVersion };
export function useSourceWorkspace() {
	const [filters, setFilters] = useState<SourceFilters>({
		page: 1,
		limit: SOURCE_PAGE_SIZE,
		search: "",
	});
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [mode, setMode] = useState<FormMode | null>(null);
	const [notice, setNotice] = useState("");
	const state = useSurvivalDocuments(filters, selectedId);
	const busy = state.upload.isPending || state.action.isPending || state.edit.isPending;
	function openForm(next: FormMode) {
		state.upload.reset();
		state.edit.reset();
		setMode(next);
	}
	async function actOnVersion(
		version: SourceVersion,
		action: SourceAction,
		payload: SourceDecision
	) {
		try {
			await state.action.mutateAsync({
				documentId: version.documentId,
				versionId: version.id,
				action,
				payload,
			});
			setNotice("Đã cập nhật trạng thái tài liệu.");
		} catch {
			/* The server error is shown beside the action; stale state is refreshed. */
		}
	}
	async function save(metadata: SourceMetadata, file?: File) {
		if (!mode) return;
		try {
			if (mode.kind === "edit")
				await state.edit.mutateAsync({
					documentId: mode.version.documentId,
					versionId: mode.version.id,
					revision: mode.version.revision,
					metadata,
				});
			else if (file) {
				const result = await state.upload.mutateAsync({
					metadata,
					file,
					document: mode.kind === "version" ? state.detail.data : undefined,
				});
				setSelectedId(result.id);
			}
			setMode(null);
			setNotice("Đã lưu bản nháp riêng tư. Tài liệu chưa được xuất bản.");
		} catch {
			/* Preserve form values and show the validated server response. */
		}
	}
	const initialMetadata = mode?.kind === "edit" ? mode.version.metadata : undefined;
	const formMetadata =
		mode?.kind === "version" ? state.detail.data?.versions[0].metadata : initialMetadata;
	return {
		state,
		filters,
		setFilters,
		selectedId,
		setSelectedId,
		mode,
		setMode,
		notice,
		busy,
		openForm,
		actOnVersion,
		save,
		formMetadata,
	};
}
