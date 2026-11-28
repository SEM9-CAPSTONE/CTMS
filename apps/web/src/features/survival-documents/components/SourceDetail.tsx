import { useState } from "react";
import { ConfirmModal, Modal } from "../../../shared/components";
import { SOURCE_BUTTON, STATUS_LABELS } from "../constants";
import { useSourceChunking } from "../hooks/useSourceChunking";
import { sourceActionErrorMessage } from "../services/survival-documents.service";
import type { DocumentDetail, SourceAction, SourceDecision, SourceVersion } from "../types";
import { ArchiveSourceVersionDialog } from "./ArchiveSourceVersionDialog";
import { PrivateSourcePreview } from "./PrivateSourcePreview";
import { SourceChunkingStatus } from "./SourceChunkingStatus";
import { SourceDetailTabs } from "./SourceDetailTabs";
import { SourceVersionActions } from "./SourceVersionActions";

const vietnameseDate = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

export function SourceDetail({
	document,
	selectedVersionId,
	busy,
	error,
	onClose,
	onNewVersion,
	onSelectVersion,
	onEdit,
	onAction,
	onDelete,
}: {
	document: DocumentDetail;
	selectedVersionId: string | null;
	busy: boolean;
	error: Error | null;
	onClose: () => void;
	onNewVersion: (document: DocumentDetail, version: SourceVersion) => void;
	onSelectVersion: (id: string) => void;
	onEdit: (version: SourceVersion) => void;
	onAction: (
		version: SourceVersion,
		action: SourceAction,
		payload: SourceDecision
	) => Promise<boolean>;
	onDelete: (id: string, expectedRevision: number) => Promise<void>;
}) {
	const [deleteRevision, setDeleteRevision] = useState<number | null>(null);
	const [archiveTarget, setArchiveTarget] = useState<SourceVersion | null>(null);
	const [restoreOpen, setRestoreOpen] = useState(false);
	const [restorationReason, setRestorationReason] = useState("");
	const version =
		document.versions.find((item) => item.id === selectedVersionId) ?? document.versions[0];
	const isCurrent =
		version.status === "PUBLISHED" && version.id === document.currentPublishedVersionId;
	const canPublish =
		version.status === "DRAFT" &&
		!document.versions.some(
			(item) => item.versionNumber > version.versionNumber && item.publishedAt
		);
	const draft = version.status === "DRAFT";
	const chunking = useSourceChunking(
		document.id,
		version.id,
		draft && version.preparationEligible === true
	);
	const prepared = chunking.data?.[0];
	const publicationBlockedReason =
		draft && version.requiresKnowledge !== false
			? !version.preparationEligible
				? (version.preparationBlockedReason ??
					"Hãy xác nhận nguồn và chuẩn bị nội dung trước khi xuất bản.")
				: chunking.isError
					? "Chưa tải được trạng thái chuẩn bị nội dung."
					: prepared?.status === "READY" &&
							prepared.input_revision === (version.knowledgeRevision ?? 1)
						? undefined
						: "Chỉ có thể xuất bản khi nội dung của bản nháp đã sẵn sàng."
			: undefined;
	return (
		<>
			<Modal
				isOpen
				onClose={onClose}
				isCloseDisabled={busy || deleteRevision !== null || archiveTarget !== null}
				title={version.metadata.sourceTitle}
				description={
					<span className="mt-1 flex flex-wrap items-center gap-2">
						<span
							className={`rounded-full px-2 py-0.5 text-xs font-semibold ${version.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"}`}
						>
							{STATUS_LABELS[version.status]}
						</span>
						Phiên bản {version.versionNumber} ·{" "}
						{vietnameseDate.format(new Date(version.publishedAt ?? version.createdAt))}
					</span>
				}
				size="2xl"
			>
				<div className="space-y-4">
					{isCurrent && (
						<div className="flex justify-end">
							<button
								type="button"
								disabled={busy}
								className={SOURCE_BUTTON}
								onClick={() => setArchiveTarget(version)}
							>
								Ngừng sử dụng
							</button>
						</div>
					)}
					<div className="grid items-start gap-4 md:grid-cols-2">
						<PrivateSourcePreview key={version.id} version={version} />
						<SourceDetailTabs
							document={document}
							version={version}
							busy={busy}
							onSelectVersion={onSelectVersion}
						/>
					</div>
					{(draft || isCurrent) && (
						<SourceChunkingStatus
							key={version.id}
							documentId={document.id}
							versionId={version.id}
							current={isCurrent || draft}
							eligible={
								draft
									? version.preparationEligible === true
									: isCurrent && document.processingSyncStatus === "REGENERATION_NEEDED"
							}
							blockedReason={
								draft ? version.preparationBlockedReason : document.processingBlockedReason
							}
						/>
					)}
					{draft && version.requiresKnowledge !== false && !version.preparationEligible && (
						<button
							type="button"
							className={SOURCE_BUTTON}
							disabled={busy}
							onClick={() =>
								void onAction(version, "prepare", { expectedRevision: version.revision })
							}
						>
							Xác nhận nguồn và chuẩn bị nội dung
						</button>
					)}
					{draft && (
						<p className="text-sm text-[#667a6d]">
							Chuẩn bị nội dung không làm thay đổi phiên bản đang được sử dụng. Bạn cần xác nhận
							xuất bản sau khi nội dung đã sẵn sàng.
						</p>
					)}
					{version.status === "SUPERSEDED" && version.restorationEligible !== false && (
						<button
							type="button"
							className={SOURCE_BUTTON}
							disabled={busy}
							onClick={() => {
								setRestorationReason("");
								setRestoreOpen(true);
							}}
						>
							Khôi phục thành bản nháp mới
						</button>
					)}
					{error && (
						<p role="alert" className="text-red-700">
							{sourceActionErrorMessage(error)}
						</p>
					)}
					<footer className="flex flex-wrap items-start justify-between gap-3 border-t border-[#dfe8df] pt-4">
						<button
							type="button"
							disabled={busy}
							onClick={() => setDeleteRevision(document.revision)}
							className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
						>
							Xóa tài liệu
						</button>
						<SourceVersionActions
							key={version.id}
							version={version}
							busy={busy}
							canPublish={canPublish}
							publicationBlockedReason={publicationBlockedReason}
							onNewVersion={() => onNewVersion(document, version)}
							onEdit={onEdit}
							onAction={onAction}
						/>
					</footer>
				</div>
			</Modal>
			<Modal
				isOpen={restoreOpen}
				onClose={() => setRestoreOpen(false)}
				isCloseDisabled={busy}
				title="Khôi phục tài liệu thành bản nháp mới"
			>
				<p className="text-sm">
					Khôi phục toàn bộ nội dung phiên bản {version.versionNumber} của{" "}
					{version.metadata.sourceTitle}. Bản nháp mới cần được kiểm tra và chuẩn bị nội dung trước
					khi xuất bản.
				</p>
				<label className="mt-3 block text-sm">
					Lý do khôi phục
					<textarea
						aria-label="Lý do khôi phục"
						value={restorationReason}
						onChange={(event) => setRestorationReason(event.target.value)}
						maxLength={2000}
						className="mt-1 w-full rounded-lg border p-2"
					/>
				</label>
				<button
					type="button"
					className={`${SOURCE_BUTTON} mt-3`}
					disabled={busy || restorationReason.trim().length < 10}
					onClick={async () => {
						const succeeded = await onAction(version, "restore", {
							expectedRevision: version.revision,
							reason: restorationReason.trim(),
						});
						if (succeeded !== false) setRestoreOpen(false);
					}}
				>
					Xác nhận tạo bản nháp
				</button>
			</Modal>
			{archiveTarget && (
				<ArchiveSourceVersionDialog
					version={archiveTarget}
					busy={busy}
					onAction={onAction}
					onClose={() => setArchiveTarget(null)}
				/>
			)}
			<ConfirmModal
				isOpen={deleteRevision !== null}
				isLoading={busy}
				variant="danger"
				title="Xóa vĩnh viễn tài liệu?"
				description="Tài liệu, toàn bộ phiên bản và các tệp PDF sẽ bị xóa vĩnh viễn."
				confirmText="Xóa vĩnh viễn"
				onClose={() => setDeleteRevision(null)}
				onConfirm={async () => {
					if (deleteRevision === null || busy) return;
					await onDelete(document.id, deleteRevision);
					setDeleteRevision(null);
				}}
			/>
		</>
	);
}
