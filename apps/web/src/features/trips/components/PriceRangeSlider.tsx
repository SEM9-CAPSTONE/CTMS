import type { ChangeEvent } from "react";

export interface PriceRangeSliderProps {
	min?: number;
	max?: number;
	step?: number;
	minValue: number;
	maxValue: number;
	onChange: (min: number, max: number) => void;
}

export const DEFAULT_MIN_PRICE = 0;
export const DEFAULT_MAX_PRICE = 10_000_000;
export const DEFAULT_PRICE_STEP = 100_000;

export function formatPriceVND(amount: number): string {
	return `${amount.toLocaleString("vi-VN")} VNĐ`;
}

export function PriceRangeSlider({
	min = DEFAULT_MIN_PRICE,
	max = DEFAULT_MAX_PRICE,
	step = DEFAULT_PRICE_STEP,
	minValue,
	maxValue,
	onChange,
}: PriceRangeSliderProps) {
	// Calculate safe bounds for track rendering
	const safeTrackMin = Math.max(min, Math.min(minValue, max));
	const safeTrackMax = Math.max(min, Math.min(maxValue, max));
	const visualMin = Math.min(safeTrackMin, safeTrackMax);
	const visualMax = Math.max(safeTrackMin, safeTrackMax);

	const range = max - min || 1;
	const minPercent = Math.min(100, Math.max(0, ((visualMin - min) / range) * 100));
	const maxPercent = Math.min(100, Math.max(0, ((visualMax - min) / range) * 100));

	const handleMinChange = (e: ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value);
		onChange(val, maxValue);
	};

	const handleMaxChange = (e: ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value);
		onChange(minValue, val);
	};

	// Determine z-index dynamically to avoid thumb traps at extremes
	const isMinNearRight = minValue > max - range * 0.05;

	return (
		<div className="space-y-2.5">
			{/* Top Bar: Clean Title & Value Range Chips */}
			<div className="flex flex-wrap items-center justify-between gap-2">
				<label className="text-xs font-bold text-[#55685a]">Khoảng giá (VNĐ)</label>

				<div className="flex items-center gap-1.5 text-xs">
					<span className="rounded-lg border border-[#dfe8df] bg-[#fbfdfb] px-2.5 py-0.5 font-bold text-[#10221b]">
						{formatPriceVND(minValue)}
					</span>
					<span className="text-[#8fa096] font-bold">—</span>
					<span className="rounded-lg border border-[#dfe8df] bg-[#fbfdfb] px-2.5 py-0.5 font-bold text-[#10221b]">
						{maxValue >= max ? `${max.toLocaleString("vi-VN")}+ VNĐ` : formatPriceVND(maxValue)}
					</span>
				</div>
			</div>

			{/* Dual Slider Track */}
			<div className="relative flex h-7 w-full items-center">
				{/* Background track */}
				<div className="h-1.5 w-full rounded-full bg-[#e6ede6]" />

				{/* Active range track */}
				<div
					data-testid="price-slider-active-track"
					className="absolute h-1.5 rounded-full bg-[#164027]"
					style={{
						left: `${minPercent}%`,
						width: `${Math.max(0, maxPercent - minPercent)}%`,
					}}
				/>

				{/* Min Price Slider Input (Left thumb) */}
				<input
					type="range"
					min={min}
					max={max}
					step={step}
					value={minValue}
					onChange={handleMinChange}
					aria-label="Giá tối thiểu"
					className={`pointer-events-none absolute inset-0 h-7 w-full appearance-none bg-transparent ${
						isMinNearRight ? "z-30" : "z-10"
					} [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4.5 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[#164027] [&::-moz-range-thumb]:shadow-sm [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:active:cursor-grabbing [&::-moz-range-thumb]:active:scale-110 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4.5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#164027] [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-webkit-slider-thumb]:active:scale-110`}
				/>

				{/* Max Price Slider Input (Right thumb) */}
				<input
					type="range"
					min={min}
					max={max}
					step={step}
					value={maxValue}
					onChange={handleMaxChange}
					aria-label="Giá tối đa"
					className="pointer-events-none absolute inset-0 z-20 h-7 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4.5 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[#164027] [&::-moz-range-thumb]:shadow-sm [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:active:cursor-grabbing [&::-moz-range-thumb]:active:scale-110 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4.5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#164027] [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-webkit-slider-thumb]:active:scale-110"
				/>
			</div>

			{/* Subtext: Min & Max boundary labels */}
			<div className="flex items-center justify-between text-[11px] font-medium text-stone-600">
				<span>{formatPriceVND(min)}</span>
				<span>{formatPriceVND(max)}</span>
			</div>
		</div>
	);
}
