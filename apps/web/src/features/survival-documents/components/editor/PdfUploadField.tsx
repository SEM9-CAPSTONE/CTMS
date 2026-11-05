import { CloudUpload, FileText, FolderOpen } from "lucide-react";
import { type DragEvent, useId, useRef, useState } from "react";
import { formatFileSize } from "../../../../shared/components/FileDropzone";
import { cn } from "../../../../shared/utils/cn";

interface PdfUploadFieldProps {
	file?: File;
	maxBytes?: number;
	disabled?: boolean;
	error?: string;
	onChange: (file?: File) => void;
}

export function PdfUploadField({ file, maxBytes, disabled, error, onChange }: PdfUploadFieldProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const hintId = useId();
	const errorId = useId();
	const [dragging, setDragging] = useState(false);
	const [dropError, setDropError] = useState("");
	const message = dropError || error;

	function handleDrop(event: DragEvent<HTMLDivElement>) {
		event.preventDefault();
		setDragging(false);
		if (disabled) return;
		const files = event.dataTransfer.files;
		if (files.length > 1) {
			setDropError("Chỉ chọn một tệp PDF cho mỗi tài liệu.");
			return;
		}
		if (files[0]) {
			setDropError("");
			onChange(files[0]);
		}
	}

	return (
		<div className="space-y-1">
			<div
				onDragOver={(event) => {
					event.preventDefault();
					if (!disabled) setDragging(true);
				}}
				onDragLeave={(event) => {
					const next = event.relatedTarget;
					if (!(next instanceof Node) || !event.currentTarget.contains(next)) setDragging(false);
				}}
				onDrop={handleDrop}
				className={cn(
					"flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-4 text-center transition-colors",
					dragging ? "border-[#29734a] bg-[#e3efe4]" : "border-[#79a48b] bg-[#f3f8f4]",
					message && "border-red-500",
					disabled && "opacity-60"
				)}
			>
				<input
					ref={inputRef}
					type="file"
					accept="application/pdf,.pdf"
					aria-label="Tệp PDF"
					aria-describedby={message ? `${hintId} ${errorId}` : hintId}
					aria-invalid={!!message}
					className="sr-only"
					tabIndex={-1}
					disabled={disabled}
					onChange={(event) => {
						const selected = event.currentTarget.files?.[0];
						if (selected) {
							setDropError("");
							onChange(selected);
						}
						event.currentTarget.value = "";
					}}
				/>
				{file ? (
					<>
						<FileText aria-hidden="true" className="size-8 text-[#1c6135]" />
						<p className="max-w-full break-all text-sm font-semibold text-slate-900">{file.name}</p>
					</>
				) : (
					<>
						<CloudUpload aria-hidden="true" className="size-9 text-[#1c6135]" />
						<p className="text-sm font-medium text-slate-900">Kéo thả tệp PDF vào đây hoặc</p>
					</>
				)}
				<button
					type="button"
					disabled={disabled}
					aria-describedby={hintId}
					onClick={() => inputRef.current?.click()}
					className="inline-flex items-center gap-2 rounded-lg border border-[#699c75] bg-white px-3 py-1.5 text-sm font-semibold text-[#16582b] transition hover:bg-[#e8f3e9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#28613c] disabled:cursor-not-allowed"
				>
					<FolderOpen aria-hidden="true" className="size-4" />
					{file ? "Chọn tệp khác" : "Chọn tệp"}
				</button>
				<p id={hintId} className="text-xs text-slate-600">
					Chỉ hỗ trợ PDF
					{maxBytes ? ` · Dung lượng tối đa ${formatFileSize(maxBytes)}` : ""}
				</p>
			</div>
			{message && (
				<p id={errorId} role="alert" className="text-xs text-red-700">
					{message}
				</p>
			)}
		</div>
	);
}
