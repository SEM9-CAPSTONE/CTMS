import { RotateCcw, Search } from "lucide-react";
import type { FormEvent } from "react";
import { FIXED_EXPLORE_PROVINCE } from "../hooks/useCampsitesSearch";

export interface CampsitesSearchFiltersProps {
	amenities: string;
	minPrice: string;
	maxPrice: string;
	/** Only Search/Reset are gated by loading -- input fields stay editable so a user can keep typing the next filter while the current search is still in flight (Step 2 review). */
	isLoading: boolean;
	onAmenitiesChange: (value: string) => void;
	onMinPriceChange: (value: string) => void;
	onMaxPriceChange: (value: string) => void;
	onSubmit: () => void;
	onReset: () => void;
	className?: string;
}

/**
 * CTMS-17-T02. Exactly the DB-backed filters accepted by the API
 * (province, amenities, minPrice, maxPrice) -- no status selector, no date/guest-count/
 * type fields (those exist only in the landing page's static, non-functional
 * mockup, not in the backend contract this feature consumes).
 *
 * `province` is not a user input: Explore is scoped to Đà Nẵng only (product
 * decision), shown as a static line rather than a field -- there is no
 * backend support for a finer-grained district/"city" filter (no such
 * column exists on `campsites` at all), so this deliberately does not offer
 * one instead of shipping a control that would look like it filters but
 * silently wouldn't.
 */
export function CampsitesSearchFilters(props: CampsitesSearchFiltersProps) {
	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		props.onSubmit();
	};

	return (
		<form
			onSubmit={handleSubmit}
			className={props.className ?? "border-b border-[#e0ebe0] bg-white p-5"}
		>
			<div className="mb-4 flex items-center gap-2 text-sm font-bold text-[#425048]">
				<span aria-hidden="true">📍</span>
				<span>Khu vực: {FIXED_EXPLORE_PROVINCE}</span>
			</div>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
