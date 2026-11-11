import { AlertCircle, Plus, X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { MAX_TAG_LENGTH } from "../constants";

interface TagListInputProps {
	id?: string;
	label: string;
	placeholder?: string;
	tags: string[];
	onChange: (nextTags: string[]) => void;
	maxItems: number;
	disabled?: boolean;
	error?: string;
	helperText?: string;
}

export function TagListInput({
	id,
	label,
	placeholder = "Nhập và nhấn Enter...",
	tags,
	onChange,
	maxItems,
	disabled = false,
	error,
	helperText,
}: TagListInputProps) {
	const [inputValue, setInputValue] = useState("");
	const [localError, setLocalError] = useState<string | null>(null);

	const handleAdd = () => {
		const trimmed = inputValue.trim();
		if (!trimmed) {
			setLocalError("Không được để trống");
			return;
		}

		if (trimmed.length > MAX_TAG_LENGTH) {
			setLocalError(`Tối đa ${MAX_TAG_LENGTH} ký tự`);
			return;
		}

		if (tags.length >= maxItems) {
			setLocalError(`Đã đạt giới hạn tối đa ${maxItems} mục`);
			return;
		}

		const isDuplicate = tags.some((tag) => tag.trim().toLowerCase() === trimmed.toLowerCase());
		if (isDuplicate) {
			setLocalError("Mục này đã tồn tại trong danh sách");
			return;
		}

		onChange([...tags, trimmed]);
		setInputValue("");
		setLocalError(null);
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleAdd();
		}
	};

	const handleRemove = (indexToRemove: number) => {
		if (disabled) return;
		onChange(tags.filter((_, idx) => idx !== indexToRemove));
		setLocalError(null);
	};

	const displayedError = error || localError;

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between">
				<label
					htmlFor={id}
					className="text-xs font-extrabold uppercase tracking-wider text-[#4a5e51]"
				>
					{label}
				</label>
				<span className="text-[11px] font-bold text-[#8fa096]">
					{tags.length}/{maxItems}
				</span>
			</div>

			<div className="flex gap-2">
				<input
					id={id}
					type="text"
					value={inputValue}
					disabled={disabled || tags.length >= maxItems}
					onChange={(e) => {
						setInputValue(e.target.value);
						if (localError) setLocalError(null);
					}}
					onKeyDown={handleKeyDown}
					placeholder={tags.length >= maxItems ? "Đã đạt số lượng tối đa" : placeholder}
					className="flex-1 rounded-xl border border-[#d2ded2] bg-white px-3.5 py-2.5 text-sm font-medium text-[#10221b] outline-none transition focus:border-[#164027] focus:ring-1 focus:ring-[#164027] disabled:bg-[#f4f7f2] disabled:text-[#8fa096]"
				/>
				<button
					type="button"
					onClick={handleAdd}
					disabled={disabled || !inputValue.trim() || tags.length >= maxItems}
					className="flex items-center gap-1 rounded-xl bg-[#164027] px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#205234] disabled:cursor-not-allowed disabled:opacity-50"
				>
					<Plus size={16} />
					<span>Thêm</span>
				</button>
			</div>

			{displayedError && (
				<div className="flex items-center gap-1.5 text-xs font-bold text-red-600">
					<AlertCircle size={14} className="shrink-0" />
					<span>{displayedError}</span>
				</div>
			)}

			{helperText && !displayedError && <p className="text-[11px] text-[#627769]">{helperText}</p>}

			{tags.length > 0 && (
				<div className="mt-1 flex flex-wrap gap-2">
					{tags.map((tag, idx) => (
						<span
							key={tag}
							className="inline-flex items-center gap-1.5 rounded-lg border border-[#cbe0cb] bg-[#eef7f0] px-2.5 py-1 text-xs font-bold text-[#164027]"
						>
							<span>{tag}</span>
							{!disabled && (
								<button
									type="button"
									onClick={() => handleRemove(idx)}
									aria-label={`Xóa ${tag}`}
									className="rounded p-0.5 text-[#164027]/70 hover:bg-[#164027]/10 hover:text-[#164027]"
								>
									<X size={13} />
								</button>
							)}
						</span>
					))}
				</div>
			)}
		</div>
	);
}
