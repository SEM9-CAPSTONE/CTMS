import { useState } from "react";
import { Modal } from "../../../shared/components";
import { AUDIT_LABELS, SOURCE_INPUT, STATUS_LABELS } from "../constants";

import type { DocumentDetail, SourceAction, SourceDecision, SourceVersion } from "../types";
import { PrivateSourcePreview } from "./PrivateSourcePreview";
import { SourceVersionActions } from "./SourceVersionActions";
import { SourceVersionProvenance } from "./SourceVersionProvenance";

export function SourceDetail({
	document,
	busy,
	error,
	onClose,
	onNewVersion,
	onEdit,
	onAction,
}: {
	document: DocumentDetail;
	busy: boolean;
	error: Error | null;
	onClose: () => void;
	onNewVersion: () => void;
	onEdit: (version: SourceVersion) => void;
	onAction: (
		version: SourceVersion,
		action: SourceAction,
		payload: SourceDecision
	) => Promise<void>;
}) {
	const [selectedId, setSelectedId] = useState(document.versions[0].id);
	const version = document.versions.find((item) => item.id === selectedId) ?? document.versions[0];
	return (
		<Modal
			isOpen
			onClose={onClose}
			isCloseDisabled={busy}
			title={version.metadata.sourceTitle}
			size="xl"
		>
			<div className="space-y-4">
				<p className="text-sm">
					Phiên bản đang xuất bản:{" "}
					{document.versions.find((item) => item.id === document.currentPublishedVersionId)
						?.versionNumber ?? "Chưa có"}{" "}
					·{" "}
					{document.processingSyncStatus === "REGENERATION_NEEDED"
						? "Cần xử lý lại tri thức từ phiên bản nguồn"
						: "Chưa xử lý tri thức"}
				</p>
				<label className="block text-sm font-bold">
					Lịch sử phiên bản
					<select
						className={SOURCE_INPUT}
						disabled={busy}
						value={version.id}
						onChange={(event) => {
							setSelectedId(event.target.value);
						}}
					>
						{document.versions.map((item) => (
							<option key={item.id} value={item.id}>
								Phiên bản {item.versionNumber} · {STATUS_LABELS[item.status]}
							</option>
						))}
					</select>
				</label>
				<p className="font-bold text-[#164027]">{STATUS_LABELS[version.status]}</p>
				<SourceVersionProvenance version={version} />
				<PrivateSourcePreview version={version} />
				<SourceVersionActions
					key={version.id}
					version={version}
					busy={busy}
					onNewVersion={onNewVersion}
					onEdit={onEdit}
					onAction={onAction}
				/>
				{error && (
					<p role="alert" className="text-red-700">
						{error.message}
					</p>
				)}
				<details>
					<summary className="cursor-pointer font-bold">Lịch sử thao tác</summary>
					<ol className="mt-2 space-y-2 text-sm">
						{document.history.map((item) => (
							<li key={item.id} className="rounded-lg bg-[#f4f7f2] p-3">
								<p>
									{AUDIT_LABELS[item.action.split(".").pop() ?? ""] ?? "Cập nhật"} ·{" "}
									{new Date(item.createdAt).toLocaleString("vi-VN")}
								</p>
								<p className="break-all text-xs">Người thực hiện: {item.actorId}</p>
								{item.reason && <p>{item.reason}</p>}
							</li>
						))}
					</ol>
				</details>
			</div>
		</Modal>
	);
}
