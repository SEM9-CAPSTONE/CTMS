import { DollarSign, MapPin, RotateCcw, Search, Star } from "lucide-react";
import type { FormEvent } from "react";

export interface CampsitesSearchFiltersProps {
	name: string;
	maxPrice: string;
	rating: string;
	isLoading: boolean;
	onNameChange: (value: string) => void;
	onMaxPriceChange: (value: string) => void;
	onRatingChange: (value: string) => void;
	onSubmit: () => void;
	onReset: () => void;
	className?: string;
}

const RATING_OPTIONS = [
	{ value: "", label: "Tất cả" },
	{ value: "3", label: "3+" },
	{ value: "4", label: "4+" },
	{ value: "5", label: "5" },
];

const MAX_PRICE_LIMIT = 3000000;
const PRICE_STEP = 50000;

export function CampsitesSearchFilters(props: CampsitesSearchFiltersProps) {
	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		props.onSubmit();
	};

	const maxPriceValue = props.maxPrice ? Number(props.maxPrice) : MAX_PRICE_LIMIT;
	const priceLabel =
		maxPriceValue >= MAX_PRICE_LIMIT ? "Tất cả" : `${maxPriceValue.toLocaleString("vi-VN")}đ`;

	return (
		<form
			onSubmit={handleSubmit}
			className={props.className ?? "border-b border-[#e0ebe0] bg-white p-5"}
		>
			<div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.2fr_0.8fr_auto]">
				{/* Tên khu cắm trại */}
				<div className="flex flex-col gap-2">
					<label htmlFor="filter-name" className="text-xs font-bold text-[#425048]">
						Tên khu cắm trại
					</label>
					<div className="flex h-13 items-center gap-2.5 rounded-2xl border border-[#e0ebe0] bg-[#f7faf6] px-4">
						<MapPin size={18} className="shrink-0 text-[#276143]" />
						<input
							id="filter-name"
							value={props.name}
							onChange={(e) => props.onNameChange(e.target.value)}
							placeholder="Nhập tên địa điểm..."
							className="w-full bg-transparent text-sm text-[#10221b] outline-none"
						/>
					</div>
				</div>

				{/* Khoảng giá (single max slider) */}
				<div className="flex flex-col gap-2">
					<label
						htmlFor="filter-max-price"
						className="flex justify-between text-xs font-bold text-[#425048]"
					>
						<span>Khoảng giá tối đa</span>
						<span className="font-extrabold text-[#276143]">{priceLabel}</span>
					</label>
					<div className="flex h-13 items-center gap-2.5 rounded-2xl border border-[#e0ebe0] bg-[#f7faf6] px-4">
						<DollarSign size={18} className="shrink-0 text-[#276143]" />
						<input
							id="filter-max-price"
							type="range"
							min="0"
							max={MAX_PRICE_LIMIT}
							step={PRICE_STEP}
							value={maxPriceValue}
							onChange={(e) => {
								const val = Number(e.target.value);
								props.onMaxPriceChange(val >= MAX_PRICE_LIMIT ? "" : String(val));
							}}
							className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#dfe8df] accent-[#276143]"
						/>
					</div>
				</div>

				{/* Đánh giá sao */}
				<div className="flex flex-col gap-2">
					<label className="text-xs font-bold text-[#425048]">Đánh giá</label>
					<div className="flex h-13 items-center gap-1.5 rounded-2xl border border-[#e0ebe0] bg-[#f7faf6] px-3">
						{RATING_OPTIONS.map((opt) => {
							const isActive = props.rating === opt.value;
							return (
								<button
									key={opt.value}
									type="button"
									onClick={() => props.onRatingChange(opt.value)}
									className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold transition ${
										isActive
											? "bg-[#1c442f] text-white shadow-sm"
											: "bg-white text-[#425048] hover:bg-[#eef7f0]"
									}`}
								>
									{opt.value && (
										<Star
											size={12}
											className={isActive ? "fill-yellow-300 text-yellow-300" : "text-[#d87d05]"}
										/>
									)}
									<span>{opt.label}</span>
								</button>
							);
						})}
					</div>
				</div>

				{/* Buttons */}
				<div className="mt-auto flex items-center gap-3">
					<button
						type="submit"
						disabled={props.isLoading}
						className="inline-flex h-13 min-w-[130px] cursor-pointer items-center justify-center gap-2 rounded-full bg-[#1c442f] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#143323] disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Search className="size-4" /> Tìm kiếm
					</button>
					<button
						type="button"
						disabled={props.isLoading}
						onClick={props.onReset}
						className="inline-flex h-13 min-w-[100px] cursor-pointer items-center justify-center gap-2 rounded-full border border-[#dfe8df] bg-white px-4 text-sm font-bold text-[#425048] transition hover:bg-[#f1f5f0] disabled:cursor-not-allowed disabled:opacity-50"
					>
						<RotateCcw className="size-4" /> Đặt lại
					</button>
				</div>
			</div>
		</form>
	);
}
