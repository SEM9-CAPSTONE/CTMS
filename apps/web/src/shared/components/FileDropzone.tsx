import { Loader2, UploadCloud } from "lucide-react";
import { type DragEvent, useId, useRef, useState } from "react";

export interface FileDropzoneProps {
	/** MIME types accepted, e.g. ["application/pdf", "image/png"]. */
	acceptMimeTypes: readonly string[];
	maxSizeBytes: number;
	onFilesSelected: (files: File[]) => void;
	/** Called with one Vietnamese message per rejected file. */
	onFilesRejected?: (messages: string[]) => void;
	multiple?: boolean;
	disabled?: boolean;
	isUploading?: boolean;
	title?: string;
	hint?: string;
}

export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Drag-and-drop / click-to-browse file picker with type and size validation. */
export function FileDropzone({
	acceptMimeTypes,
	maxSizeBytes,
	onFilesSelected,
	onFilesRejected,
	multiple = false,
	disabled = false,
	isUploading = false,
	title = "Kéo thả file vào đây hoặc bấm để chọn",
	hint,
}: FileDropzoneProps) {
	const inputId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const [isDragging, setIsDragging] = useState(false);
	const isDisabled = disabled || isUploading;

	const handleFiles = (fileList: FileList | null) => {
		if (!fileList || fileList.length === 0) return;
		const accepted: File[] = [];
		const rejected: string[] = [];
		for (const file of Array.from(fileList)) {
			if (!acceptMimeTypes.includes(file.type)) {
				rejected.push(`"${file.name}" không đúng định dạng cho phép.`);
			} else if (file.size > maxSizeBytes) {
				rejected.push(`"${file.name}" vượt quá ${formatFileSize(maxSizeBytes)}.`);
			} else {
				accepted.push(file);
			}
		}
		if (rejected.length > 0) onFilesRejected?.(rejected);
		if (accepted.length > 0) onFilesSelected(multiple ? accepted : accepted.slice(0, 1));
	};

	const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
		event.preventDefault();
		setIsDragging(false);
		if (!isDisabled) handleFiles(event.dataTransfer.files);
	};

	return (
		<label
			htmlFor={inputId}
			onDragOver={(event) => {
				event.preventDefault();
				if (!isDisabled) setIsDragging(true);
			}}
			onDragLeave={() => setIsDragging(false)}
			onDrop={handleDrop}
			aria-disabled={isDisabled}
			data-testid="file-dropzone"
			className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${
				isDisabled
					? "cursor-not-allowed border-[#dfe8df] bg-[#f7f9f6] opacity-70"
					: isDragging
						? "cursor-pointer border-[#164027] bg-[#eef7f0]"
						: "cursor-pointer border-[#cfdccf] bg-white hover:border-[#276143] hover:bg-[#f7fbf7]"
			}`}
		>
			<div className="rounded-full bg-[#eef7f0] p-3 text-[#164027]">
				{isUploading ? (
					<Loader2 className="size-6 animate-spin" />
				) : (
					<UploadCloud className="size-6" />
				)}
			</div>
			<p className="text-sm font-bold text-[#10221b]">{isUploading ? "Đang tải lên..." : title}</p>
			{hint && <p className="text-xs font-medium text-[#667a6d]">{hint}</p>}
			<input
				ref={inputRef}
				id={inputId}
				type="file"
				className="sr-only"
				accept={acceptMimeTypes.join(",")}
				multiple={multiple}
				disabled={isDisabled}
				onChange={(event) => {
					handleFiles(event.target.files);
					// Allow picking the same file again after removing it.
					event.target.value = "";
				}}
			/>
		</label>
	);
}
