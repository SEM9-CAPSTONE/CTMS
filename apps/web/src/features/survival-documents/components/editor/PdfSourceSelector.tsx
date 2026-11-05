import { Link2, Upload } from "lucide-react";
import { cn } from "../../../../shared/utils/cn";
import type { PdfSource } from "../../types";

interface PdfSourceSelectorProps {
	method: PdfSource["kind"];
	onChange: (method: PdfSource["kind"]) => void;
}

export function PdfSourceSelector({ method, onChange }: PdfSourceSelectorProps) {
	return (
		<fieldset className="min-w-0 space-y-2">
			<legend className="text-sm font-semibold text-slate-900">
				Nguồn tài liệu{" "}
				<span aria-hidden="true" className="text-red-700">
					*
				</span>
			</legend>
			<div className="grid grid-cols-2 overflow-hidden rounded-lg border border-[#d6dfd7] bg-white">
				{options.map(({ value, label, Icon }) => {
					const selected = method === value;
					return (
						<button
							key={value}
							type="button"
							aria-pressed={selected}
							onClick={() => {
								if (!selected) onChange(value);
							}}
							className={cn(
								"flex min-h-9 items-center justify-center gap-2 px-2 py-2 text-xs transition focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#28613c] disabled:cursor-not-allowed sm:text-sm",
								value === "url" && "border-l border-[#d6dfd7]",
								selected
									? "bg-[#e3efe4] font-semibold text-[#16582b]"
									: "font-medium text-slate-700 hover:bg-[#f4f8f4]"
							)}
						>
							<Icon aria-hidden="true" className="size-4 shrink-0" />
							{label}
						</button>
					);
				})}
			</div>
		</fieldset>
	);
}

const options = [
	{ value: "upload", label: "Tải PDF từ máy", Icon: Upload },
	{ value: "url", label: "Nhập URL PDF", Icon: Link2 },
] as const;
