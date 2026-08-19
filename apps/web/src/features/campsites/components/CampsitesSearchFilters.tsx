import { RotateCcw, Search } from "lucide-react";
import type { FormEvent } from "react";

export interface CampsitesSearchFiltersProps {
	province: string;
	city: string;
	amenities: string;
	minPrice: string;
	maxPrice: string;
	/** Only Search/Reset are gated by loading -- input fields stay editable so a user can keep typing the next filter while the current search is still in flight (Step 2 review). */
	isLoading: boolean;
	onProvinceChange: (value: string) => void;
	onCityChange: (value: string) => void;
	onAmenitiesChange: (value: string) => void;
	onMinPriceChange: (value: string) => void;
	onMaxPriceChange: (value: string) => void;
	onSubmit: () => void;
	onReset: () => void;
}

/**
 * CTMS-17-T02. Exactly the 5 filters CTMS-77 accepts (province, city,
 * amenities, minPrice, maxPrice) -- no status selector, no date/guest-count/
 * type fields (those exist only in the landing page's static, non-functional
 * mockup, not in the backend contract this feature consumes).
 */
export function CampsitesSearchFilters(props: CampsitesSearchFiltersProps) {
	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		props.onSubmit();
	};

	return (
		<form onSubmit={handleSubmit} className="border-b border-[#e0ebe0] bg-white p-5">
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
				<div className="flex flex-col gap-1.5">
					<label
						htmlFor="filter-province"
						className="text-xs font-bold uppercase tracking-wide text-[#425048]"
					>
						Tỉnh/Thành
					</label>
					<input
						id="filter-province"
						value={props.province}
						onChange={(e) => props.onProvinceChange(e.target.value)}
						placeholder="Ví dụ: Lâm Đồng"
						className="rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#164027]"
					/>
				</div>

				<div className="flex flex-col gap-1.5">
					<label
						htmlFor="filter-city"
						className="text-xs font-bold uppercase tracking-wide text-[#425048]"
					>
						Thành phố
					</label>
					<input
						id="filter-city"
						value={props.city}
						onChange={(e) => props.onCityChange(e.target.value)}
						placeholder="Ví dụ: Đà Lạt"
						className="rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#164027]"
					/>
				</div>

				<div className="flex flex-col gap-1.5">
					<label
						htmlFor="filter-amenities"
						className="text-xs font-bold uppercase tracking-wide text-[#425048]"
					>
						Tiện ích
					</label>
					<input
						id="filter-amenities"
						value={props.amenities}
						onChange={(e) => props.onAmenitiesChange(e.target.value)}
						placeholder="wifi, nhà vệ sinh..."
						className="rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#164027]"
					/>
				</div>

				<div className="flex flex-col gap-1.5">
					<label
						htmlFor="filter-min-price"
						className="text-xs font-bold uppercase tracking-wide text-[#425048]"
					>
						Giá từ
					</label>
					<input
						id="filter-min-price"
						type="number"
						min={0}
						value={props.minPrice}
						onChange={(e) => props.onMinPriceChange(e.target.value)}
						placeholder="0"
						className="rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#164027]"
					/>
				</div>

				<div className="flex flex-col gap-1.5">
					<label
						htmlFor="filter-max-price"
						className="text-xs font-bold uppercase tracking-wide text-[#425048]"
					>
						Giá đến
					</label>
					<input
						id="filter-max-price"
						type="number"
						min={0}
						value={props.maxPrice}
						onChange={(e) => props.onMaxPriceChange(e.target.value)}
						placeholder="1000000"
						className="rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#164027]"
					/>
				</div>
			</div>

			<div className="mt-4 flex items-center gap-3">
				<button
					type="submit"
					disabled={props.isLoading}
					className="inline-flex items-center gap-2 rounded-xl bg-[#164027] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#0f3019] disabled:cursor-not-allowed disabled:opacity-50"
				>
					<Search className="size-4" /> Tìm kiếm
				</button>
				<button
					type="button"
					disabled={props.isLoading}
					onClick={props.onReset}
					className="inline-flex items-center gap-2 rounded-xl border border-[#dfe8df] px-5 py-2.5 text-sm font-bold text-[#425048] transition hover:bg-[#f1f5f0] disabled:cursor-not-allowed disabled:opacity-50"
				>
					<RotateCcw className="size-4" /> Đặt lại
				</button>
			</div>
		</form>
	);
}
