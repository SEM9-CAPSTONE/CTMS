import { CATEGORY_LABELS } from "../constants";
import type { SourceVersion } from "../types";
const languageLabels: Record<string, string> = { vi: "Tiếng Việt", en: "Tiếng Anh" };

export function SourceVersionProvenance({ version }: { version: SourceVersion }) {
	const { metadata } = version;
	const language = languageLabels[metadata.locale] ?? metadata.locale;
	const overview = [
		["Phân loại", CATEGORY_LABELS[metadata.classification]],
		["Ngôn ngữ", language],
		["Tổ chức phát hành", metadata.publisher || "—"],
		["Tệp", version.originalFilename],
		["Dung lượng", formatFileSize(version.size)],
	];
	return (
		<div className="space-y-4">
			<h3 className="text-sm font-bold">Thông tin tài liệu</h3>
			<dl className="space-y-3 text-sm">
				{overview.map(([label, value]) => (
					<div key={label} className="flex justify-between gap-3">
						<dt className="shrink-0 text-[#526c5e]">{label}</dt>
						<dd className="min-w-0 break-words text-right font-semibold">{value}</dd>
					</div>
				))}
			</dl>
			<div className="space-y-2 border-t border-[#dfe8df] pt-3 text-sm">
				<h3 className="font-bold">Nguồn tài liệu</h3>
				{metadata.sourceUrl && (
					<a
						href={metadata.sourceUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1.5 font-semibold text-[#164027] underline"
					>
						<ExternalLink size={14} aria-hidden="true" />
						Xem nguồn gốc
					</a>
				)}
				{!metadata.sourceUrl && <p className="text-[#526c5e]">Chưa có URL nguồn.</p>}
			</div>
			{version.reason && (
				<p className="rounded-lg bg-amber-50 p-3 text-sm">Lý do: {version.reason}</p>
			)}
		</div>
	);
}
import { ExternalLink } from "lucide-react";
import { formatFileSize } from "../../../shared/components/FileDropzone";
