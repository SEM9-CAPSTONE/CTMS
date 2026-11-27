import { Bold, Italic, List, ListOrdered, Quote, Redo2, Underline, Undo2 } from "lucide-react";
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
type FontSizeOption = "12" | "14" | "16" | "18" | "20";

const FONT_SIZE_OPTIONS: ReadonlyArray<{
	value: FontSizeOption;
	label: string;
	execValue: string;
}> = [
	{ value: "12", label: "12", execValue: "1" },
	{ value: "14", label: "14", execValue: "2" },
	{ value: "16", label: "16", execValue: "3" },
	{ value: "18", label: "18", execValue: "4" },
	{ value: "20", label: "20", execValue: "5" },
];

export const TermsWordEditor: React.FC<TermsWordEditorProps> = ({
	documentKey,
	sections,
	onChangeSections,
}) => {
	const editorRef = useRef<HTMLDivElement>(null);
	const lastSyncedKeyRef = useRef<string>("");
	const [blockFormat, setBlockFormat] = useState<BlockFormatValue>("p");
	const [fontSize, setFontSize] = useState<FontSizeOption>("14");

	// Hydrate innerHTML only when switching versions/drafts so typing caret never jumps.
	useEffect(() => {
		if (!editorRef.current) return;
		if (documentKey === "init" && sections.length === 0) return;
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

	const detectCurrentSelectionStyles = () => {
		const selection = window.getSelection();
		if (!selection || !selection.anchorNode || !editorRef.current) return;
		let node: Node | null = selection.anchorNode;

		const anchorEl =
			node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
		if (anchorEl && editorRef.current.contains(anchorEl)) {
			const computedPx = Math.round(Number.parseFloat(window.getComputedStyle(anchorEl).fontSize));
			if (Number.isFinite(computedPx)) {
				const closest = FONT_SIZE_OPTIONS.reduce((best, opt) =>
					Math.abs(Number(opt.value) - computedPx) < Math.abs(Number(best.value) - computedPx)
						? opt
						: best
				);
				setFontSize(closest.value);
			}
		}

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
		detectCurrentSelectionStyles();
		syncToParent();
	};

	const handleBlockFormatChange = (nextTag: BlockFormatValue) => {
		setBlockFormat(nextTag);
		runCommand("formatBlock", `<${nextTag}>`);
	};

	const handleFontSizeChange = (nextSize: FontSizeOption) => {
		setFontSize(nextSize);
		const editor = editorRef.current;
		if (!editor) return;
		editor.focus();
		const option = FONT_SIZE_OPTIONS.find((item) => item.value === nextSize);
		if (!option) return;

		if (typeof document.execCommand === "function") {
			document.execCommand("fontSize", false, option.execValue);
			// Replace deprecated <font size="..."> elements with clean inline font-size spans
			const fontTags = editor.querySelectorAll(`font[size="${option.execValue}"]`);
			for (const fontTag of Array.from(fontTags)) {
				const span = document.createElement("span");
				span.style.fontSize = `${nextSize}px`;
				span.innerHTML = fontTag.innerHTML;
				fontTag.replaceWith(span);
			}
		}
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
					<option value="h2">Tiêu đề mục</option>
					<option value="h3">Tiêu đề nhỏ</option>
					<option value="p">Đoạn văn</option>
					<option value="blockquote">Ghi chú lưu ý</option>
				</select>

				<label htmlFor="terms-word-font-size" className="sr-only">
					Cỡ chữ
				</label>
				<select
					id="terms-word-font-size"
					aria-label="Cỡ chữ"
					value={fontSize}
					onChange={(event) => handleFontSizeChange(event.target.value as FontSizeOption)}
					className="h-8 w-16 rounded-lg border border-[#d6e2d7] bg-white px-2 text-xs font-semibold text-[#10221b] outline-none focus:border-[#164027]"
				>
					{FONT_SIZE_OPTIONS.map((opt) => (
						<option key={opt.value} value={opt.value}>
							{opt.label}
						</option>
					))}
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
				onKeyUp={detectCurrentSelectionStyles}
				onMouseUp={detectCurrentSelectionStyles}
				onPaste={handlePaste}
				className="h-[460px] overflow-y-auto bg-white px-6 py-5 text-sm leading-relaxed text-[#35463c] outline-none [&_blockquote]:my-3 [&_blockquote]:rounded-lg [&_blockquote]:border-l-4 [&_blockquote]:border-[#164027] [&_blockquote]:bg-[#f4f7f2] [&_blockquote]:px-3.5 [&_blockquote]:py-2 [&_blockquote]:text-xs [&_blockquote]:text-[#254431] [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h2]:text-[#10221b] [&_h2:first-child]:mt-0 [&_h3]:mt-3.5 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-[#10221b] [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
			/>
		</div>
	);
};
