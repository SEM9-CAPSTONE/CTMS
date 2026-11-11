export interface AdminReviewFilterOption<T extends string> {
	value: T;
	label: string;
}

interface AdminReviewFiltersProps<T extends string> {
	value: T;
	options: Array<AdminReviewFilterOption<T>>;
	onChange: (value: T) => void;
}

export function AdminReviewFilters<T extends string>({
	value,
	options,
	onChange,
}: AdminReviewFiltersProps<T>) {
	return (
		<div className="flex flex-wrap items-center gap-2 border-t border-[#edf3ed] pt-4">
			<span className="mr-1 text-xs font-bold text-[#7b8c82]">Trạng thái xét duyệt:</span>
			{options.map((option) => {
				const selected = option.value === value;
				return (
					<button
						key={option.value}
						type="button"
						aria-pressed={selected}
						onClick={() => onChange(option.value)}
						className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
							selected
								? "bg-[#164027] text-white shadow-sm"
								: "bg-[#f4f7f2] text-[#55685a] hover:bg-[#e7eee7]"
						}`}
					>
						{option.label}
					</button>
				);
			})}
		</div>
	);
}
