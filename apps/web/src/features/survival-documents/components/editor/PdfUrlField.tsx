import { Info, Link2 } from "lucide-react";
import { useId } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

interface PdfUrlFieldProps {
	registration: UseFormRegisterReturn;
	error?: string;
}

export function PdfUrlField({ registration, error }: PdfUrlFieldProps) {
	const hintId = useId();
	const errorId = useId();
	return (
		<div className="space-y-2">
			<label className="block text-sm font-semibold text-slate-900">
				URL PDF{" "}
				<span aria-hidden="true" className="text-red-700">
					*
				</span>
				<span className="relative mt-1 block">
					<Link2
						aria-hidden="true"
						className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
					/>
					<input
						type="url"
						placeholder="https://example.org/cam-nang-sinh-ton.pdf"
						aria-invalid={!!error}
						aria-required="true"
						aria-describedby={error ? `${hintId} ${errorId}` : hintId}
						className="w-full rounded-lg border border-[#d6dfd7] bg-white py-2 pl-9 pr-3 text-sm font-normal placeholder:text-slate-500 aria-[invalid=true]:border-red-500"
						{...registration}
					/>
				</span>
			</label>
			{error && (
				<p id={errorId} className="text-xs text-red-700">
					{error}
				</p>
			)}
			<p
				id={hintId}
				className="flex items-start gap-2 rounded-lg bg-[#e8f3e9] px-3 py-2 text-xs text-[#285236]"
			>
				<Info aria-hidden="true" className="mt-px size-4 shrink-0" />
				Hệ thống sẽ tải tệp PDF từ đường dẫn và kiểm tra định dạng, dung lượng.
			</p>
		</div>
	);
}
