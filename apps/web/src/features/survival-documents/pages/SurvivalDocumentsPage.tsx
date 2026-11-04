import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { SourceDetail } from "../components/SourceDetail";
import { SourceDocumentTable } from "../components/SourceDocumentTable";
import { SourceFilters } from "../components/SourceFilters";
import { SourceReferenceCatalog } from "../components/SourceReferenceCatalog";
import { SourceUploadForm } from "../components/SourceUploadForm";
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
		setSelectedId,
		mode,
		setMode,
		notice,
		busy,
		openForm,
		actOnVersion,
		save,
		formMetadata,
	} = useSourceWorkspace();
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
							Thêm nguồn tài liệu
						</button>
					</div>
				</header>
				{notice && (
					<output className="block rounded-xl bg-green-50 p-3 text-sm text-[#164027]">
						{notice}
					</output>
				)}
				{state.references.data && (
					<SourceReferenceCatalog
						items={state.references.data.items}
						disabled={busy}
						onSelect={(reference) => openForm({ kind: "create", reference })}
					/>
				)}
				{state.references.error && (
					<p role="alert">Không tải được nguồn gợi ý. Bạn vẫn có thể thêm tài liệu thủ công.</p>
				)}
				<SourceFilters filters={filters} onChange={setFilters} />
				{state.list.isPending && <output>Đang tải tài liệu…</output>}
				{state.list.error && (
					<p role="alert" className="text-red-700">
						{state.list.error.message} Dùng nút Tải lại để thử lại.
					</p>
				)}
				{state.list.data && (
					<SourceDocumentTable
						items={state.list.data.items}
						total={state.list.data.total}
						page={filters.page}
						disabled={busy}
						onPage={(page) => setFilters({ ...filters, page })}
						onOpen={(id) => {
							state.action.reset();
							setSelectedId(id);
						}}
					/>
				)}
				{selectedId && state.detail.isPending && <output>Đang tải chi tiết…</output>}
				{selectedId && state.detail.error && (
					<p role="alert" className="text-red-700">
						{state.detail.error.message}
					</p>
				)}
				{state.detail.data && selectedId && !mode && (
					<SourceDetail
						key={state.detail.data.id}
						document={state.detail.data}
						busy={busy}
						error={state.action.error}
						onClose={() => setSelectedId(null)}
						onNewVersion={() => openForm({ kind: "version" })}
						onEdit={(version) => openForm({ kind: "edit", version })}
						onAction={actOnVersion}
					/>
				)}
				{mode && (
					<SourceUploadForm
						key={`${mode.kind}-${mode.kind === "edit" ? mode.version.id : "new"}`}
						initial={formMetadata}
						reference={mode.kind === "create" ? mode.reference : undefined}
						editing={mode.kind === "edit"}
						maxBytes={state.references.data?.maxBytes ?? 10485760}
						busy={busy}
						error={mode.kind === "edit" ? state.edit.error : state.upload.error}
						onClose={() => setMode(null)}
						onSubmit={save}
					/>
				)}
			</div>
		</AdminLayout>
	);
}
