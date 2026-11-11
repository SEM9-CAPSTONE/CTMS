import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { SearchTripsQuery, TrekkingRouteDifficulty, TripType } from "../types";
import {
	DEFAULT_MAX_PRICE,
	DEFAULT_MIN_PRICE,
	DEFAULT_PRICE_STEP,
	PriceRangeSlider,
	formatPriceVND,
} from "./PriceRangeSlider";

export interface TripFilterBarProps {
	currentFilters: SearchTripsQuery;
	onFilterChange: (filters: Partial<SearchTripsQuery>) => void;
	onReset: () => void;
}

export function TripFilterBar({ currentFilters, onFilterChange, onReset }: TripFilterBarProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [search, setSearch] = useState(currentFilters.search ?? "");
	const [tripType, setTripType] = useState<TripType | "">(currentFilters.tripType ?? "");
	const [difficulty, setDifficulty] = useState<TrekkingRouteDifficulty | "">(
		currentFilters.difficulty ?? ""
	);
	const [startDate, setStartDate] = useState(currentFilters.startDate ?? "");
	const [endDate, setEndDate] = useState(currentFilters.endDate ?? "");
	const [minPrice, setMinPrice] = useState<number>(currentFilters.minPrice ?? DEFAULT_MIN_PRICE);
	const [maxPrice, setMaxPrice] = useState<number>(currentFilters.maxPrice ?? DEFAULT_MAX_PRICE);
	const [validationError, setValidationError] = useState<string | null>(null);

	// Count active advanced filters
	let activeFilterCount = 0;
	if (tripType) activeFilterCount++;
	if (difficulty) activeFilterCount++;
	if (startDate) activeFilterCount++;
	if (endDate) activeFilterCount++;
	if (minPrice > DEFAULT_MIN_PRICE || maxPrice < DEFAULT_MAX_PRICE) activeFilterCount++;

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		setValidationError(null);

		if (minPrice > maxPrice) {
			setValidationError("Giá tối thiểu không thể lớn hơn giá tối đa.");
			return;
		}

		if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
			setValidationError("Ngày bắt đầu không thể diễn ra sau ngày kết thúc.");
			return;
		}

		onFilterChange({
			search: search.trim() || undefined,
			tripType: (tripType as TripType) || undefined,
			difficulty: (difficulty as TrekkingRouteDifficulty) || undefined,
			startDate: startDate || undefined,
			endDate: endDate || undefined,
			minPrice: minPrice > DEFAULT_MIN_PRICE ? minPrice : undefined,
			maxPrice: maxPrice < DEFAULT_MAX_PRICE ? maxPrice : undefined,
		});
	};

	const handleReset = () => {
		setSearch("");
		setTripType("");
		setDifficulty("");
		setStartDate("");
		setEndDate("");
		setMinPrice(DEFAULT_MIN_PRICE);
		setMaxPrice(DEFAULT_MAX_PRICE);
		setValidationError(null);
		onReset();
	};

	return (
		<div className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm">
			<form onSubmit={handleSubmit} className="space-y-4">
				{/* Top Search & Toggle Bar */}
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<div className="relative flex-1">
						<Search className="absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-[#8fa096]" />
						<input
							type="text"
							aria-label="Tìm kiếm chuyến đi"
							placeholder="Tìm theo tên chuyến đi, cung đường hoặc địa danh..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="w-full rounded-2xl border border-[#dfe8df] bg-[#fbfdfb] py-3 pr-4 pl-11 text-sm font-medium text-[#10221b] placeholder:text-[#8fa096] focus:border-[#164027] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#164027]/10 transition"
						/>
					</div>

					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setIsOpen((prev) => !prev)}
							className={`inline-flex cursor-pointer items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-bold transition ${
								isOpen || activeFilterCount > 0
									? "border-[#164027] bg-[#164027]/5 text-[#164027]"
									: "border-[#dfe8df] bg-white text-[#55685a] hover:bg-[#f6f9f6]"
							}`}
						>
							<SlidersHorizontal className="size-4" />
							<span>Bộ lọc nâng cao</span>
							{activeFilterCount > 0 && (
								<span className="flex size-4.5 items-center justify-center rounded-full bg-[#164027] text-[10px] font-extrabold text-white">
									{activeFilterCount}
								</span>
							)}
						</button>

						<button
							type="submit"
							className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-[#164027] px-6 py-3 text-xs font-bold text-white shadow-xs transition hover:bg-[#0f2e1c]"
						>
							<span>Tìm kiếm</span>
						</button>
					</div>
				</div>

				{/* Active Filter Chips (if any) */}
				{activeFilterCount > 0 && (
					<div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
						<span className="text-[#7b8c82] font-bold mr-1">Đang lọc:</span>

						{tripType && (
							<span className="inline-flex items-center gap-1.5 rounded-xl border border-[#dfe8df] bg-[#f4f7f2] px-2.5 py-1 font-bold text-[#55685a]">
								{tripType === "day_trip" ? "Trong ngày" : "Qua đêm"}
								<button
									type="button"
									onClick={() => {
										setTripType("");
										onFilterChange({ tripType: undefined });
									}}
									className="text-[#8fa096] hover:text-[#10221b] cursor-pointer"
								>
									<X className="size-3" />
								</button>
							</span>
						)}

						{difficulty && (
							<span className="inline-flex items-center gap-1.5 rounded-xl border border-[#dfe8df] bg-[#f4f7f2] px-2.5 py-1 font-bold text-[#55685a]">
								{difficulty === "easy"
									? "Dễ"
									: difficulty === "moderate"
										? "Trung bình"
										: difficulty === "hard"
											? "Khó"
											: "Chuyên gia"}
								<button
									type="button"
									onClick={() => {
										setDifficulty("");
										onFilterChange({ difficulty: undefined });
									}}
									className="text-[#8fa096] hover:text-[#10221b] cursor-pointer"
								>
									<X className="size-3" />
								</button>
							</span>
						)}

						{(minPrice > DEFAULT_MIN_PRICE || maxPrice < DEFAULT_MAX_PRICE) && (
							<span className="inline-flex items-center gap-1.5 rounded-xl border border-[#dfe8df] bg-[#f4f7f2] px-2.5 py-1 font-bold text-[#55685a]">
								{formatPriceVND(minPrice)} -{" "}
								{maxPrice >= DEFAULT_MAX_PRICE ? "10M+ VNĐ" : formatPriceVND(maxPrice)}
								<button
									type="button"
									onClick={() => {
										setMinPrice(DEFAULT_MIN_PRICE);
										setMaxPrice(DEFAULT_MAX_PRICE);
										onFilterChange({ minPrice: undefined, maxPrice: undefined });
									}}
									className="text-[#8fa096] hover:text-[#10221b] cursor-pointer"
								>
									<X className="size-3" />
								</button>
							</span>
						)}

						<button
							type="button"
							onClick={handleReset}
							className="text-xs font-bold text-[#164027] hover:underline ml-1 cursor-pointer"
						>
							Xóa tất cả
						</button>
					</div>
				)}

				{/* Collapsible Advanced Filters Panel */}
				{isOpen && (
					<div className="grid gap-4 border-t border-[#edf3ed] pt-4 sm:grid-cols-2 lg:grid-cols-4">
						{/* Trip Type */}
						<div>
							<label htmlFor="filter-trip-type" className="block text-xs font-bold text-[#55685a]">
								Loại chuyến đi
							</label>
							<select
								id="filter-trip-type"
								aria-label="Loại chuyến đi"
								value={tripType}
								onChange={(e) => setTripType(e.target.value as TripType | "")}
								className="mt-1 w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-xs font-medium text-[#10221b] focus:border-[#164027] focus:outline-none"
							>
								<option value="">Tất cả loại chuyến</option>
								<option value="day_trip">Trong ngày</option>
								<option value="overnight">Qua đêm</option>
							</select>
						</div>

						{/* Difficulty */}
						<div>
							<label htmlFor="filter-difficulty" className="block text-xs font-bold text-[#55685a]">
								Độ khó
							</label>
							<select
								id="filter-difficulty"
								aria-label="Độ khó"
								value={difficulty}
								onChange={(e) => setDifficulty(e.target.value as TrekkingRouteDifficulty | "")}
								className="mt-1 w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-xs font-medium text-[#10221b] focus:border-[#164027] focus:outline-none"
							>
								<option value="">Tất cả độ khó</option>
								<option value="easy">Dễ</option>
								<option value="moderate">Trung bình</option>
								<option value="hard">Khó</option>
								<option value="expert">Chuyên gia</option>
							</select>
						</div>

						{/* Date range */}
						<div>
							<label htmlFor="filter-start-date" className="block text-xs font-bold text-[#55685a]">
								Từ ngày
							</label>
							<input
								id="filter-start-date"
								aria-label="Từ ngày"
								type="date"
								value={startDate}
								onChange={(e) => setStartDate(e.target.value)}
								className="mt-1 w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-xs font-medium text-[#10221b] focus:border-[#164027] focus:outline-none"
							/>
						</div>

						<div>
							<label htmlFor="filter-end-date" className="block text-xs font-bold text-[#55685a]">
								Đến ngày
							</label>
							<input
								id="filter-end-date"
								aria-label="Đến ngày"
								type="date"
								value={endDate}
								onChange={(e) => setEndDate(e.target.value)}
								className="mt-1 w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-xs font-medium text-[#10221b] focus:border-[#164027] focus:outline-none"
							/>
						</div>

						{/* Dual-thumb Price Range Slider */}
						<div className="sm:col-span-2 lg:col-span-3">
							<PriceRangeSlider
								min={DEFAULT_MIN_PRICE}
								max={DEFAULT_MAX_PRICE}
								step={DEFAULT_PRICE_STEP}
								minValue={minPrice}
								maxValue={maxPrice}
								onChange={(newMin, newMax) => {
									setMinPrice(newMin);
									setMaxPrice(newMax);
									setValidationError(null);
								}}
							/>
						</div>

						{/* Reset Actions */}
						<div className="flex items-end justify-end sm:col-span-2 lg:col-span-1">
							<button
								type="button"
								onClick={handleReset}
								className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#dfe8df] px-4 py-2 text-xs font-bold text-[#55685a] transition hover:bg-[#f6f9f6] lg:w-auto cursor-pointer"
							>
								<RotateCcw className="size-3.5" />
								<span>Xóa bộ lọc</span>
							</button>
						</div>
					</div>
				)}

				{/* Validation alert */}
				{validationError && (
					<div
						role="alert"
						className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700"
					>
						{validationError}
					</div>
				)}
			</form>
		</div>
	);
}
