import { ExternalLink, FileText, Trash2 } from "lucide-react";
import { formatFileSize } from "./FileDropzone";

export interface DocumentPreviewProps {
	url: string;
	name: string;
	mimeType: string;
	sizeBytes?: number;
	onRemove?: () => void;
	isRemoving?: boolean;
}

/** Card showing an uploaded document: image thumbnail or PDF icon, with an open link. */
export function DocumentPreview({
	url,
	name,
	mimeType,
	sizeBytes,
	onRemove,
	isRemoving = false,
}: DocumentPreviewProps) {
	const isImage = mimeType.startsWith("image/");

	return (
		<div className="flex items-center gap-3 rounded-xl border border-[#dfe8df] bg-white p-3 shadow-sm">
			<a
				href={url}
				target="_blank"
				rel="noreferrer"
				className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#e7eee7] bg-[#f4f7f2]"
				aria-label={`Xem ${name}`}
			>
				{isImage ? (
					<img src={url} alt={name} className="size-full object-cover" />
				) : (
					<FileText className="size-7 text-red-600" />
				)}
			</a>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-bold text-[#10221b]" title={name}>
					{name}
				</p>
				<p className="text-xs font-medium text-[#667a6d]">
					{isImage ? "Hình ảnh" : "PDF"}
					{sizeBytes !== undefined && ` · ${formatFileSize(sizeBytes)}`}
				</p>
				<a
					href={url}
					target="_blank"
					rel="noreferrer"
					className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#164027] hover:underline"
				>
					<ExternalLink className="size-3.5" /> Mở tài liệu
				</a>
			</div>
			{onRemove && (
				<button
					type="button"
					onClick={onRemove}
					disabled={isRemoving}
					aria-label={`Xóa ${name}`}
					className="rounded-lg p-2 text-[#667a6d] transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
				>
					<Trash2 className="size-4" />
				</button>
			)}
		</div>
	);
}
