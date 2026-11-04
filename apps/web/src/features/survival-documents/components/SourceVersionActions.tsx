import { useRef, useState } from "react";
import { SOURCE_BUTTON, SOURCE_INPUT } from "../constants";
import type { SourceAction, SourceDecision, SourceVersion } from "../types";
import { SourceReviewForm } from "./SourceReviewForm";
export function SourceVersionActions({
	version,
	busy,
	onNewVersion,
	onEdit,
	onAction,
}: {
	version: SourceVersion;
	busy: boolean;
	onNewVersion: () => void;
	onEdit: (version: SourceVersion) => void;
	onAction: (
		version: SourceVersion,
		action: SourceAction,
		payload: SourceDecision
	) => Promise<void>;
}) {
	const [reason, setReason] = useState("");
	const lock = useRef(false);
	async function action(name: SourceAction, extra: Omit<SourceDecision, "expectedRevision"> = {}) {
		if (busy || lock.current) return;
		lock.current = true;
		try {
			await onAction(version, name, { expectedRevision: version.revision, ...extra });
		} finally {
			lock.current = false;
		}
	}
	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-3">
				<button type="button" className={SOURCE_BUTTON} disabled={busy} onClick={onNewVersion}>
					Tạo phiên bản mới
				</button>
				{version.status === "DRAFT" && (
					<>
						<button
							type="button"
							className={SOURCE_BUTTON}
							disabled={busy}
							onClick={() => onEdit(version)}
						>
							Sửa thông tin
						</button>
						<button
							type="button"
							className={SOURCE_BUTTON}
							disabled={busy}
							onClick={() => void action("submit")}
						>
							Gửi duyệt
						</button>
					</>
				)}
				{version.status === "APPROVED" && (
					<button
						type="button"
						className={SOURCE_BUTTON}
						disabled={busy}
						onClick={() => void action("publish")}
					>
						Xuất bản
					</button>
				)}
			</div>
			{version.status === "IN_REVIEW" && (
				<SourceReviewForm
					busy={busy}
					onReview={(decision, reviewReason, rights) =>
						action("review", { decision, reason: reviewReason, rights })
					}
				/>
			)}
			{version.status === "PUBLISHED" && (
				<div className="space-y-2">
					<label className="block text-sm">
						Lý do ngừng sử dụng
						<textarea
							className={SOURCE_INPUT}
							value={reason}
							disabled={busy}
							onChange={(event) => setReason(event.target.value)}
						/>
					</label>
					<button
						type="button"
						disabled={busy || !reason.trim()}
						className={SOURCE_BUTTON}
						onClick={() => void action("archive", { reason })}
					>
						Ngừng sử dụng
					</button>
				</div>
			)}
		</div>
	);
}
