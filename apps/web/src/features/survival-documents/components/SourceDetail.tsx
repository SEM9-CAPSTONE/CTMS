import { useState } from "react";
import { ConfirmModal, Modal } from "../../../shared/components";
import { SOURCE_BUTTON, STATUS_LABELS } from "../constants";
import type { DocumentDetail, SourceAction, SourceDecision, SourceVersion } from "../types";
import { ArchiveSourceVersionDialog } from "./ArchiveSourceVersionDialog";
import { PrivateSourcePreview } from "./PrivateSourcePreview";
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
	) => Promise<void>;
	onDelete: (id: string, expectedRevision: number) => Promise<void>;
}) {
	const [deleteRevision, setDeleteRevision] = useState<number | null>(null);
	const [archiveTarget, setArchiveTarget] = useState<SourceVersion | null>(null);
	const version =
		document.versions.find((item) => item.id === selectedVersionId) ?? document.versions[0];
	const canPublish =
		version.status === "DRAFT" &&
		!document.versions.some(
			(item) => item.versionNumber > version.versionNumber && item.publishedAt
		);
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
					{version.status === "PUBLISHED" && version.id === document.currentPublishedVersionId && (
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
					{error && (
						<p role="alert" className="text-red-700">
							{error.message}
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
							onNewVersion={() => onNewVersion(document, version)}
							onEdit={onEdit}
							onAction={onAction}
						/>
					</footer>
				</div>
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
