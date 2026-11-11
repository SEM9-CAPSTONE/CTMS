import { SOURCE_INPUT } from "../constants";
import type { DocumentDetail, SourceVersion } from "../types";

interface DocumentVersionHistoryProps {
	document: DocumentDetail;
	version: SourceVersion;
	busy: boolean;
	onSelectVersion: (id: string) => void;
}

export function DocumentVersionHistory({
	document,
	version,
	busy,
	onSelectVersion,
}: DocumentVersionHistoryProps) {
	return (
		<label className="block text-sm font-bold">
			Lịch sử phiên bản
			<select
				className={SOURCE_INPUT}
				disabled={busy}
				value={version.id}
				onChange={(event) => onSelectVersion(event.target.value)}
			>
				{document.versions.map((item) => (
					<option key={item.id} value={item.id}>
						Phiên bản {item.versionNumber}
					</option>
				))}
			</select>
		</label>
	);
}

export function DocumentAuditHistory({ publishedAt }: Pick<SourceVersion, "publishedAt">) {
	return (
		<section>
			<h3 className="text-sm font-bold">Ngày xuất bản</h3>
			<p className="mt-2 rounded-lg bg-[#f4f7f2] p-3 text-sm">
				{publishedAt
					? new Intl.DateTimeFormat("vi-VN", {
							dateStyle: "short",
							timeStyle: "medium",
							timeZone: "Asia/Ho_Chi_Minh",
						}).format(new Date(publishedAt))
					: "Chưa xuất bản"}
			</p>
		</section>
	);
}
