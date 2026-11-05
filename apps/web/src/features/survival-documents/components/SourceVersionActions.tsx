import { useRef } from "react";
import { SOURCE_BUTTON } from "../constants";
import type { SourceAction, SourceDecision, SourceVersion } from "../types";

interface SourceVersionActionsProps {
	version: SourceVersion;
	busy: boolean;
	canPublish: boolean;
	onNewVersion: () => void;
	onEdit: (version: SourceVersion) => void;
	onAction: (
		version: SourceVersion,
		action: SourceAction,
		payload: SourceDecision
	) => Promise<void>;
}

export function SourceVersionActions({
	version,
	busy,
	canPublish,
	onNewVersion,
	onEdit,
	onAction,
}: SourceVersionActionsProps) {
	const lock = useRef(false);
	async function action(name: SourceAction, extra: Omit<SourceDecision, "expectedRevision">) {
		if (busy || lock.current) return;
		lock.current = true;
		try {
			await onAction(version, name, { expectedRevision: version.revision, ...extra });
		} finally {
			lock.current = false;
		}
	}
	return (
		<div className="flex flex-wrap items-center justify-end gap-2">
			{version.status === "DRAFT" && (
				<button
					type="button"
					className={SOURCE_BUTTON}
					disabled={busy}
					onClick={() => onEdit(version)}
				>
					Sửa thông tin
				</button>
			)}
			{version.status === "DRAFT" && !canPublish && (
				<p className="text-sm text-[#667a6d]">Một phiên bản mới hơn đã được xuất bản.</p>
			)}
			{canPublish && (
				<button
					type="button"
					className={SOURCE_BUTTON}
					disabled={busy}
					onClick={() => void action("publish", {})}
				>
					Xuất bản
				</button>
			)}
			<button type="button" className={SOURCE_BUTTON} disabled={busy} onClick={onNewVersion}>
				Tạo phiên bản mới
			</button>
		</div>
	);
}
