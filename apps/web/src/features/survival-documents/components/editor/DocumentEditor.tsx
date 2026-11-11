import { FileText, Save, Send } from "lucide-react";
import { Modal } from "../../../../shared/components";
import { SOURCE_BUTTON } from "../../constants";
import { useDocumentEditor } from "../../hooks/useDocumentEditor";
import type { DuplicatePdf } from "../../schema/source.schema";
import type { PdfSource, SourceMetadata } from "../../types";
import { DocumentMetadataDetails } from "./DocumentMetadataDetails";
import { DocumentMetadataFields } from "./DocumentMetadataFields";
import { LocalPdfPreview } from "./LocalPdfPreview";
import { PdfSourceSelector } from "./PdfSourceSelector";
import { PdfUploadField } from "./PdfUploadField";
import { PdfUrlField } from "./PdfUrlField";

interface DocumentEditorProps {
	kind: "create" | "version" | "edit";
	initial?: SourceMetadata;
	maxBytes?: number;
	busy: boolean;
	error: Error | null;
	duplicatePdf?: DuplicatePdf;
	onClose: () => void;
	onOpenDuplicate: () => void;
	onSourceChange: () => void;
	onSubmit: (
		metadata: SourceMetadata,
		source?: PdfSource,
		preparePublication?: boolean
	) => Promise<void>;
}

const titles: Record<DocumentEditorProps["kind"], string> = {
	create: "Thêm tài liệu sinh tồn",
	version: "Tạo phiên bản mới",
	edit: "Sửa thông tin bản nháp",
};
const editorSize = { upload: "2xl", url: "lg", edit: "xl" } as const;

export function DocumentEditor({
	kind,
	initial,
	maxBytes,
	busy,
	error,
	duplicatePdf,
	onClose,
	onOpenDuplicate,
	onSourceChange,
	onSubmit,
}: DocumentEditorProps) {
	const saveBlocked = busy || !!duplicatePdf;
	const { form, method, file, selectSource, submit, preparePublication, translated } =
		useDocumentEditor({
			initial,
			editing: kind === "edit",
			maxBytes,
			busy: saveBlocked,
			onSubmit,
		});
	const { errors, isSubmitting } = form.formState;
	const addingPdf = method !== "edit";
	return (
		<Modal
			isOpen
			onClose={onClose}
			isCloseDisabled={busy}
			title={titles[kind]}
			icon={<FileText className="size-6" aria-hidden="true" />}
			description={
				addingPdf ? "Tải lên tài liệu PDF và cung cấp thông tin để quản lý trong CTMS." : undefined
			}
			size={editorSize[method]}
		>
			<form noValidate onSubmit={submit} className="space-y-4">
				<fieldset disabled={busy} className="space-y-4">
					<div
						className={
							method === "upload"
								? "grid items-start gap-5 md:grid-cols-[2fr_3fr] md:gap-8"
								: "space-y-4"
						}
					>
						{method !== "edit" && (
							<div
								className={
									method === "upload"
										? "min-w-0 space-y-3 border-b border-[#dfe8df] pb-4 md:border-0 md:pb-0"
										: "min-w-0 space-y-3 border-b border-[#dfe8df] pb-4"
								}
							>
								<PdfSourceSelector
									method={method}
									onChange={(next) => {
										selectSource(next);
										onSourceChange();
									}}
								/>
								{method === "upload" ? (
									<PdfUploadField
										file={file}
										maxBytes={maxBytes}
										disabled={busy}
										error={errors.file?.message}
										onChange={(file) => {
											onSourceChange();
											form.setValue("file", file);
											form.clearErrors("file");
										}}
									/>
								) : (
									<PdfUrlField
										registration={form.register("sourceUrl", { onChange: onSourceChange })}
										error={errors.sourceUrl?.message}
									/>
								)}
							</div>
						)}
						<DocumentMetadataFields
							register={form.register}
							errors={errors.metadata ?? {}}
							existingLocale={kind === "edit" ? initial?.locale : undefined}
						/>
					</div>
					{method === "upload" && file && (!maxBytes || file.size <= maxBytes) && (
						<LocalPdfPreview file={file} />
					)}
					<DocumentMetadataDetails
						register={form.register}
						errors={errors.metadata ?? {}}
						includeSourceUrl={method !== "url"}
						editing={kind === "edit"}
						translated={translated}
					/>
				</fieldset>
				{error && (
					<p role="alert" className="text-sm text-red-700">
						{error.message}{" "}
						{duplicatePdf && (
							<strong>
								{duplicatePdf.sourceTitle} · Phiên bản {duplicatePdf.versionNumber}
							</strong>
						)}
					</p>
				)}
				{duplicatePdf && (
					<button type="button" disabled={busy} className={SOURCE_BUTTON} onClick={onOpenDuplicate}>
						Mở phiên bản đã có
					</button>
				)}
				<div className="flex flex-wrap justify-end gap-2 border-t border-[#dfe8df] pt-4">
					<button
						type="button"
						disabled={busy}
						className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
						onClick={onClose}
					>
						Hủy
					</button>
					<button
						disabled={saveBlocked || isSubmitting}
						type="submit"
						className="inline-flex items-center gap-2 rounded-lg border border-[#46845a] px-3 py-2 text-sm font-bold text-[#155c2a] hover:bg-[#edf6ee] disabled:opacity-50"
					>
						<Save className="size-4" aria-hidden="true" />
						{busy ? "Đang lưu…" : "Lưu bản nháp"}
					</button>
					{addingPdf && (
						<button
							disabled={saveBlocked || isSubmitting}
							type="button"
							className="inline-flex items-center gap-2 rounded-lg bg-[#075225] px-3 py-2 text-sm font-bold text-white hover:bg-[#063f1d] disabled:opacity-50"
							onClick={preparePublication}
						>
							<Send className="size-4" aria-hidden="true" />
							Xuất bản
						</button>
					)}
				</div>
			</form>
		</Modal>
	);
}
