import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { SourceDetail } from "../components/SourceDetail";
import { SourceDocumentTable } from "../components/SourceDocumentTable";
import { SourceFilters } from "../components/SourceFilters";
import { DocumentEditor } from "../components/editor/DocumentEditor";
import { SOURCE_BUTTON } from "../constants";
import { useSourceWorkspace } from "../hooks/useSourceWorkspace";

export function SurvivalDocumentsPage({
	onLogout,
}: { onLogout?: (allDevices: boolean) => Promise<void> }) {
	const {
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
	} = useSourceWorkspace();
	const filtered = !!(filters.search || filters.classification || filters.locale || filters.status);
	const empty = state.list.data?.total === 0;
	const missingSelectedVersion =
		!!selectedVersionId &&
		!state.detail.data?.versions.some((item) => item.id === selectedVersionId);
	const loadingDetail =
		state.detail.isPending || (missingSelectedVersion && state.detail.isFetching);
	return (
		<AdminLayout activeItem="survival-documents" onLogout={onLogout}>
			<div className="mx-auto max-w-7xl space-y-5 px-6 py-6">
				<header className="flex items-center justify-between gap-4">
					<div>
						<h1 className="text-2xl font-extrabold text-[#164027]">Kho tài liệu sinh tồn</h1>
						{state.list.data && (
							<p className="text-sm text-[#667a6d]">
								{state.list.data.total} tài liệu trong kết quả
							</p>
						)}
					</div>
					<div className="flex gap-3">
						<button
							type="button"
							className={SOURCE_BUTTON}
							disabled={busy}
							onClick={() => void state.refresh()}
						>
							Tải lại
						</button>
						<button
							type="button"
							className={SOURCE_BUTTON}
							disabled={busy}
							onClick={() => openForm({ kind: "create" })}
						>
							Thêm tài liệu
						</button>
					</div>
				</header>
				{notice && (
					<output className="block rounded-xl bg-green-50 p-3 text-sm text-[#164027]">
						{notice}
					</output>
				)}
				<div className="rounded-2xl border border-[#dfe8df] bg-white p-4">
					<SourceFilters filters={filters} onChange={setFilters} />
				</div>
				{state.list.isPending && <output>Đang tải tài liệu…</output>}
				{state.list.error && (
					<p role="alert" className="text-red-700">
						{state.list.error.message} Dùng nút Tải lại để thử lại.
					</p>
				)}
				{empty && (
					<div className="rounded-2xl border border-dashed border-[#dfe8df] bg-white px-5 py-12 text-center">
						<p className="font-bold text-[#164027]">
							{filtered ? "Chưa có tài liệu phù hợp." : "Kho tài liệu đang trống."}
						</p>
						<p className="mt-1 text-sm text-[#667a6d]">
							{filtered
								? "Thử đổi từ khóa hoặc bộ lọc."
								: "Thêm tài liệu đầu tiên bằng tệp PDF hoặc URL PDF."}
						</p>
					</div>
				)}
				{state.list.data && !empty && (
					<SourceDocumentTable
						items={state.list.data.items}
						total={state.list.data.total}
						page={filters.page}
						disabled={busy}
						onPage={(page) => setFilters({ ...filters, page })}
						onOpen={openDocument}
					/>
				)}
				{selectedId && loadingDetail && <output>Đang tải chi tiết…</output>}
				{selectedId && state.detail.error && (
					<p role="alert" className="text-red-700">
						{state.detail.error.message}
					</p>
				)}
				{selectedId && !loadingDetail && !state.detail.error && missingSelectedVersion && (
					<p role="alert" className="text-red-700">
						Không tìm thấy phiên bản PDF đã chọn.
					</p>
				)}
				{state.detail.data && selectedId && !mode && !missingSelectedVersion && (
					<SourceDetail
						key={state.detail.data.id}
						document={state.detail.data}
						selectedVersionId={selectedVersionId}
						busy={busy}
						error={state.remove.error ?? state.action.error}
						onClose={() => openDocument(null)}
						onNewVersion={(document, version) => openForm({ kind: "version", document, version })}
						onSelectVersion={selectVersion}
						onEdit={(version) => openForm({ kind: "edit", version })}
						onAction={actOnVersion}
						onDelete={deleteDocument}
					/>
				)}
				{mode && (
					<DocumentEditor
						key={`${mode.kind}-${mode.kind === "edit" ? mode.version.id : "new"}`}
						initial={formMetadata}
						kind={mode.kind}
						maxBytes={state.list.data?.maxBytes}
						busy={busy}
						error={formError}
						duplicatePdf={duplicatePdf}
						onClose={() => setMode(null)}
						onOpenDuplicate={openDuplicate}
						onSubmit={save}
						onSourceChange={resetPdfError}
					/>
				)}
			</div>
		</AdminLayout>
	);
}
