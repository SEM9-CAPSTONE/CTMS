import {
	Bold,
	Italic,
	List,
	ListOrdered,
	Plus,
	Quote,
	Redo2,
	Underline,
	Undo2,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { TermsSection } from "../types";
import { htmlToSections, sectionsToHtml } from "../utils/termsDocumentConverter";

export interface TermsWordEditorProps {
	documentKey: string;
	sections: TermsSection[];
	onChangeSections: (sections: TermsSection[]) => void;
}

type BlockFormatValue = "h2" | "h3" | "p" | "blockquote";

export const TermsWordEditor: React.FC<TermsWordEditorProps> = ({
	documentKey,
	sections,
	onChangeSections,
}) => {
	const editorRef = useRef<HTMLDivElement>(null);
	const lastSyncedKeyRef = useRef<string>("");
	const [blockFormat, setBlockFormat] = useState<BlockFormatValue>("p");

	// Hydrate innerHTML only when switching versions/drafts so typing caret never jumps.
	useEffect(() => {
		if (!editorRef.current) return;
		if (lastSyncedKeyRef.current === documentKey) return;
		editorRef.current.innerHTML = sectionsToHtml(sections);
		lastSyncedKeyRef.current = documentKey;
	}, [documentKey, sections]);

	const syncToParent = () => {
		if (!editorRef.current) return;
		const parsed = htmlToSections(editorRef.current.innerHTML);
		if (parsed.length > 0) {
			onChangeSections(parsed);
		}
	};

	const detectCurrentBlockFormat = () => {
		const selection = window.getSelection();
		if (!selection || !selection.anchorNode || !editorRef.current) return;
		let node: Node | null = selection.anchorNode;
		while (node && node !== editorRef.current) {
			if (node.nodeType === Node.ELEMENT_NODE) {
				const tag = (node as Element).tagName.toLowerCase();
				if (tag === "h2" || tag === "h3" || tag === "p" || tag === "blockquote") {
					setBlockFormat(tag);
					return;
				}
			}
			node = node.parentNode;
		}
		setBlockFormat("p");
	};

	const runCommand = (command: string, value?: string) => {
		editorRef.current?.focus();
		if (typeof document.execCommand === "function") {
			document.execCommand(command, false, value);
		}
		detectCurrentBlockFormat();
		syncToParent();
	};

	const handleBlockFormatChange = (nextTag: BlockFormatValue) => {
		setBlockFormat(nextTag);
		runCommand("formatBlock", `<${nextTag}>`);
	};

	const handleAppendNewSection = () => {
		if (!editorRef.current) return;
		const currentSections = htmlToSections(editorRef.current.innerHTML);
		const nextNumber = currentSections.length + 1;

		const h2 = document.createElement("h2");
		h2.textContent = `${nextNumber}. Chính sách mục ${nextNumber}`;

		const h3 = document.createElement("h3");
		h3.textContent = `${nextNumber}.1. Nội dung chi tiết`;

		const p = document.createElement("p");
		p.textContent = "Nhập nội dung chi tiết cho mục chính sách mới tại đây.";

		editorRef.current.appendChild(h2);
		editorRef.current.appendChild(h3);
		editorRef.current.appendChild(p);

		// Scroll to bottom and select the new H2 title so Admin can type immediately
		editorRef.current.scrollTop = editorRef.current.scrollHeight;
		const selection = window.getSelection();
		if (selection) {
			const range = document.createRange();
			range.selectNodeContents(h2);
			selection.removeAllRanges();
			selection.addRange(range);
		}
		setBlockFormat("h2");
		syncToParent();
	};

	const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
		event.preventDefault();
		const plainText = event.clipboardData.getData("text/plain");
		if (!plainText) return;
		if (typeof document.execCommand === "function") {
			document.execCommand("insertText", false, plainText);
		}
		syncToParent();
	};

	const preventFocusLoss = (event: React.MouseEvent) => {
		event.preventDefault();
	};

	return (
		<div className="mt-5 overflow-hidden rounded-xl border border-[#dfe8df] bg-white">
			{/* Word-style Formatting Toolbar */}
			<div
				role="toolbar"
				aria-label="Thanh công cụ soạn thảo điều khoản"
				className="flex flex-wrap items-center gap-1 border-b border-[#e5ede6] bg-[#fafcfa] px-3 py-2"
			>
				<label htmlFor="terms-word-block-format" className="sr-only">
					Kiểu chữ
				</label>
				<select
					id="terms-word-block-format"
					value={blockFormat}
					onChange={(event) => handleBlockFormatChange(event.target.value as BlockFormatValue)}
					className="h-8 rounded-lg border border-[#d6e2d7] bg-white px-2.5 text-xs font-semibold text-[#10221b] outline-none focus:border-[#164027]"
				>
					<option value="h2">Tiêu đề mục (H2)</option>
					<option value="h3">Tiêu đề nhỏ (H3)</option>
					<option value="p">Đoạn văn</option>
					<option value="blockquote">Ghi chú lưu ý</option>
				</select>

				<div className="mx-1 h-5 w-px bg-[#dfe8df]" />

				<button
					type="button"
					title="In đậm"
					aria-label="In đậm"
					onMouseDown={preventFocusLoss}
					onClick={() => runCommand("bold")}
					className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-[#2f4c40] transition hover:bg-[#eef7f0] hover:text-[#164027]"
				>
					<Bold className="size-4" />
				</button>
				<button
					type="button"
					title="In nghiêng"
					aria-label="In nghiêng"
					onMouseDown={preventFocusLoss}
					onClick={() => runCommand("italic")}
					className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-[#2f4c40] transition hover:bg-[#eef7f0] hover:text-[#164027]"
				>
					<Italic className="size-4" />
				</button>
				<button
					type="button"
					title="Gạch chân"
					aria-label="Gạch chân"
					onMouseDown={preventFocusLoss}
					onClick={() => runCommand("underline")}
					className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-[#2f4c40] transition hover:bg-[#eef7f0] hover:text-[#164027]"
				>
					<Underline className="size-4" />
				</button>

				<div className="mx-1 h-5 w-px bg-[#dfe8df]" />

				<button
					type="button"
					title="Danh sách chấm đầu dòng"
					aria-label="Danh sách chấm đầu dòng"
					onMouseDown={preventFocusLoss}
					onClick={() => runCommand("insertUnorderedList")}
					className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-[#2f4c40] transition hover:bg-[#eef7f0] hover:text-[#164027]"
				>
					<List className="size-4" />
				</button>
				<button
					type="button"
					title="Danh sách đánh số"
					aria-label="Danh sách đánh số"
					onMouseDown={preventFocusLoss}
					onClick={() => runCommand("insertOrderedList")}
					className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-[#2f4c40] transition hover:bg-[#eef7f0] hover:text-[#164027]"
				>
					<ListOrdered className="size-4" />
				</button>
				<button
					type="button"
					title="Khung ghi chú lưu ý"
					aria-label="Khung ghi chú lưu ý"
					onMouseDown={preventFocusLoss}
					onClick={() => handleBlockFormatChange("blockquote")}
					className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-[#2f4c40] transition hover:bg-[#eef7f0] hover:text-[#164027]"
				>
					<Quote className="size-4" />
				</button>

				<div className="mx-1 h-5 w-px bg-[#dfe8df]" />

				<button
					type="button"
					onMouseDown={preventFocusLoss}
					onClick={handleAppendNewSection}
					className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-[#cde0d1] bg-[#f3faf5] px-2.5 text-xs font-semibold text-[#164027] transition hover:bg-[#e5f3e9]"
				>
					<Plus className="size-3.5" />
					<span>Thêm mục mới</span>
				</button>

				<div className="ml-auto flex items-center gap-0.5">
					<button
						type="button"
						title="Hoàn tác"
						aria-label="Hoàn tác"
						onMouseDown={preventFocusLoss}
						onClick={() => runCommand("undo")}
						className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-[#54655a] transition hover:bg-[#eef7f0] hover:text-[#164027]"
					>
						<Undo2 className="size-4" />
					</button>
					<button
						type="button"
						title="Làm lại"
						aria-label="Làm lại"
						onMouseDown={preventFocusLoss}
						onClick={() => runCommand("redo")}
						className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-[#54655a] transition hover:bg-[#eef7f0] hover:text-[#164027]"
					>
						<Redo2 className="size-4" />
					</button>
				</div>
			</div>

			{/* Continuous Word-like Editable Canvas */}
			<div
				ref={editorRef}
				role="textbox"
				tabIndex={0}
				aria-multiline="true"
				aria-label="Trình soạn thảo nội dung Điều khoản và Chính sách"
				contentEditable
				suppressContentEditableWarning
				onInput={syncToParent}
				onKeyUp={detectCurrentBlockFormat}
				onMouseUp={detectCurrentBlockFormat}
				onPaste={handlePaste}
				className="h-[460px] overflow-y-auto bg-white px-6 py-5 text-sm leading-relaxed text-[#35463c] outline-none [&_blockquote]:my-3 [&_blockquote]:rounded-lg [&_blockquote]:border-l-4 [&_blockquote]:border-[#164027] [&_blockquote]:bg-[#f4f7f2] [&_blockquote]:px-3.5 [&_blockquote]:py-2 [&_blockquote]:text-xs [&_blockquote]:text-[#254431] [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h2]:text-[#10221b] [&_h2:first-child]:mt-0 [&_h3]:mt-3.5 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-[#10221b] [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
			/>
		</div>
	);
};
