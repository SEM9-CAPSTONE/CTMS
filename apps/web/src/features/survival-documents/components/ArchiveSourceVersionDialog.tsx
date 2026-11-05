import { type FormEvent, useRef, useState } from "react";
import { Modal } from "../../../shared/components";
import { SOURCE_BUTTON, SOURCE_INPUT } from "../constants";
import type { SourceAction, SourceDecision, SourceVersion } from "../types";

interface ArchiveSourceVersionDialogProps {
	version: SourceVersion;
	busy: boolean;
	onClose: () => void;
	onAction: (
		version: SourceVersion,
		action: SourceAction,
		payload: SourceDecision
	) => Promise<void>;
}

export function ArchiveSourceVersionDialog({
	version,
	busy,
	onClose,
	onAction,
}: ArchiveSourceVersionDialogProps) {
	const [reason, setReason] = useState("");
	const lock = useRef(false);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (busy || lock.current || !reason.trim()) return;
		lock.current = true;
		try {
			await onAction(version, "archive", {
				expectedRevision: version.revision,
				reason: reason.trim(),
			});
			onClose();
		} finally {
			lock.current = false;
		}
	}
	return (
		<Modal isOpen title="Ngừng sử dụng tài liệu" onClose={onClose} isCloseDisabled={busy}>
			<form onSubmit={(event) => void submit(event)} className="space-y-4">
				<label className="block text-sm font-semibold">
					Lý do ngừng sử dụng
					<textarea
						className={SOURCE_INPUT}
						rows={4}
						value={reason}
						disabled={busy}
						required
						maxLength={2000}
						onChange={(event) => setReason(event.target.value)}
					/>
				</label>
				<div className="flex justify-end gap-2">
					<button
						type="button"
						disabled={busy}
						onClick={onClose}
						className="rounded-lg border px-3 py-2 text-sm"
					>
						Hủy
					</button>
					<button type="submit" className={SOURCE_BUTTON} disabled={busy || !reason.trim()}>
						Xác nhận ngừng sử dụng
					</button>
				</div>
			</form>
		</Modal>
	);
}
