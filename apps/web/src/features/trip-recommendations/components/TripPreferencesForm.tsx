import { Loader2, RefreshCw } from "lucide-react";
import { type FormEvent, useEffect, useId, useState } from "react";
import type { TrekkingRouteDifficulty, TripType } from "../../trips/types";
import { useSaveTripPreferences, useTripPreferences } from "../hooks/useTripRecommendations";
import type { TripPreferences, TripRegionCode } from "../types";

export interface TripPreferencesFormProps {
	/** Called after the preferences were saved (a toast has already been shown). */
	onSaved: () => void;
	onCancel: () => void;
	/** Lets the surrounding modal block closing while the save request runs. */
	onSavingChange?: (saving: boolean) => void;
}

export const TRIP_TYPE_OPTIONS: Array<{ value: TripType; label: string }> = [
	{ value: "day_trip", label: "Trong ngày" },
	{ value: "overnight", label: "Qua đêm" },
];

export const DIFFICULTY_OPTIONS: Array<{ value: TrekkingRouteDifficulty; label: string }> = [
	{ value: "easy", label: "Dễ" },
	{ value: "moderate", label: "Trung bình" },
	{ value: "hard", label: "Khó" },
	{ value: "expert", label: "Chuyên gia" },
];

const MAX_PRICE_VND = 1_000_000_000;

const vnd = (amount: number) => `${new Intl.NumberFormat("vi-VN").format(amount)} đ`;

/** "500.000 đ – 2.500.000 đ", "Từ 500.000 đ", "Đến 2.000.000 đ", or null without a range. */
export function formatPriceRange(minPrice: number | null, maxPrice: number | null): string | null {
	if (minPrice !== null && maxPrice !== null) return `${vnd(minPrice)} – ${vnd(maxPrice)}`;
	if (minPrice !== null) return `Từ ${vnd(minPrice)}`;
	if (maxPrice !== null) return `Đến ${vnd(maxPrice)}`;
	return null;
}

interface FormState {
	tripTypes: TripType[];
	difficulties: TrekkingRouteDifficulty[];
	regions: TripRegionCode[];
	minPrice: string;
	maxPrice: string;
}

const EMPTY_FORM: FormState = {
	tripTypes: [],
	difficulties: [],
	regions: [],
	minPrice: "",
	maxPrice: "",
};

function toForm(preferences: TripPreferences): FormState {
	return {
		tripTypes: preferences.tripTypes,
		difficulties: preferences.difficulties,
		regions: preferences.regions,
		minPrice: preferences.minPrice === null ? "" : String(preferences.minPrice),
		maxPrice: preferences.maxPrice === null ? "" : String(preferences.maxPrice),
	};
}

function parsePrice(value: string): number | null | "invalid" {
	const trimmed = value.trim();
	if (trimmed === "") return null;
	if (!/^\d+$/.test(trimmed)) return "invalid";
	const amount = Number(trimmed);
	return amount > MAX_PRICE_VND ? "invalid" : amount;
}

function toggle<T>(list: T[], value: T): T[] {
	return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function ChoiceGroup<T extends string>({
	legend,
	options,
	selected,
	onToggle,
}: {
	legend: string;
	options: Array<{ value: T; label: string }>;
	selected: T[];
	onToggle: (value: T) => void;
}) {
	return (
		<fieldset>
			<legend className="mb-2 text-sm font-extrabold text-[#10221b]">{legend}</legend>
			<div className="flex flex-wrap gap-2">
				{options.map((option) => {
					const checked = selected.includes(option.value);
					return (
						<label
							key={option.value}
							className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
								checked
									? "border-[#164027] bg-[#164027] text-white"
									: "border-[#dfe8df] bg-white text-[#55685a] hover:bg-[#f4f7f2]"
							}`}
						>
							<input
								type="checkbox"
								className="sr-only"
								checked={checked}
								onChange={() => onToggle(option.value)}
							/>
							{option.label}
						</label>
					);
				})}
			</div>
		</fieldset>
	);
}

/**
 * Same structure as the mobile form: trip type, difficulty, area, price range. Each part is optional,
 * but at least one choice (or a booking history) is needed before trips can be suggested.
 * Preferences only reorder suggestions and never hide a Trip.
 */
export function TripPreferencesForm({
	onSaved,
	onCancel,
	onSavingChange,
}: TripPreferencesFormProps) {
	const preferences = useTripPreferences(true);
	const save = useSaveTripPreferences(onSaved);
	const [form, setForm] = useState<FormState>(EMPTY_FORM);
	const [priceError, setPriceError] = useState<string | null>(null);
	const minId = useId();
	const maxId = useId();
	const errorId = useId();

	useEffect(() => {
		if (preferences.data) {
			setForm(toForm(preferences.data));
			setPriceError(null);
		}
	}, [preferences.data]);

	useEffect(() => {
		onSavingChange?.(save.isPending);
	}, [onSavingChange, save.isPending]);

	const submit = (event: FormEvent) => {
		event.preventDefault();
		const minPrice = parsePrice(form.minPrice);
		const maxPrice = parsePrice(form.maxPrice);
		if (minPrice === "invalid" || maxPrice === "invalid") {
			setPriceError("Nhập số tiền hợp lệ, không quá 1 tỷ đồng.");
			return;
		}
		if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
			setPriceError("Giá thấp nhất không được lớn hơn giá cao nhất.");
			return;
		}
		setPriceError(null);
		save.mutate({
			tripTypes: form.tripTypes,
			difficulties: form.difficulties,
			regions: form.regions,
			minPrice,
			maxPrice,
		});
	};

	return (
		<>
			{preferences.isLoading && (
				<div className="flex items-center justify-center gap-2 p-10 text-sm font-bold text-[#164027]">
					<Loader2 className="size-5 animate-spin" />
					<span>Đang tải sở thích của bạn...</span>
				</div>
			)}
			{preferences.isError && (
				<div role="alert" className="p-8 text-center">
					<p className="font-extrabold text-rose-800">Không tải được sở thích của bạn.</p>
					<button
						type="button"
						onClick={() => void preferences.refetch()}
						className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-800"
					>
						<RefreshCw className="size-4" />
						Thử lại
					</button>
				</div>
			)}
			{preferences.data && (
				<form onSubmit={submit} className="flex flex-col gap-5 overflow-y-auto px-5 py-5">
					<ChoiceGroup
						legend="Loại chuyến"
						options={TRIP_TYPE_OPTIONS}
						selected={form.tripTypes}
						onToggle={(value) => setForm((f) => ({ ...f, tripTypes: toggle(f.tripTypes, value) }))}
					/>
					<ChoiceGroup
						legend="Độ khó"
						options={DIFFICULTY_OPTIONS}
						selected={form.difficulties}
						onToggle={(value) =>
							setForm((f) => ({ ...f, difficulties: toggle(f.difficulties, value) }))
						}
					/>
					<ChoiceGroup
						legend="Khu vực"
						options={preferences.data.regionOptions.map((region) => ({
							value: region.code,
							label: region.label,
						}))}
						selected={form.regions}
						onToggle={(value) => setForm((f) => ({ ...f, regions: toggle(f.regions, value) }))}
					/>
					<fieldset>
						<legend className="mb-2 text-sm font-extrabold text-[#10221b]">
							Khoảng giá mỗi người (đồng)
						</legend>
						<div className="grid gap-3 sm:grid-cols-2">
							<label htmlFor={minId} className="text-xs font-bold text-[#55685a]">
								Từ
								<input
									id={minId}
									inputMode="numeric"
									value={form.minPrice}
									onChange={(event) => setForm((f) => ({ ...f, minPrice: event.target.value }))}
									placeholder="Ví dụ 500000"
									aria-invalid={priceError ? true : undefined}
									aria-describedby={priceError ? errorId : undefined}
									className="mt-1 w-full rounded-xl border border-[#dfe8df] px-3 py-2 text-sm text-[#10221b]"
								/>
							</label>
							<label htmlFor={maxId} className="text-xs font-bold text-[#55685a]">
								Đến
								<input
									id={maxId}
									inputMode="numeric"
									value={form.maxPrice}
									onChange={(event) => setForm((f) => ({ ...f, maxPrice: event.target.value }))}
									placeholder="Ví dụ 2000000"
									aria-invalid={priceError ? true : undefined}
									aria-describedby={priceError ? errorId : undefined}
									className="mt-1 w-full rounded-xl border border-[#dfe8df] px-3 py-2 text-sm text-[#10221b]"
								/>
							</label>
						</div>
						{priceError && (
							<p id={errorId} className="mt-2 text-xs font-semibold text-rose-700">
								{priceError}
							</p>
						)}
					</fieldset>
					<div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e0ebe0] pt-4">
						<button
							type="button"
							onClick={onCancel}
							disabled={save.isPending}
							className="rounded-xl px-3 py-2 text-xs font-bold text-[#55685a] hover:bg-[#f4f7f2] disabled:opacity-50"
						>
							Quay lại
						</button>
						<button
							type="button"
							onClick={() => {
								setForm(EMPTY_FORM);
								setPriceError(null);
							}}
							disabled={save.isPending}
							className="rounded-xl px-3 py-2 text-xs font-bold text-[#55685a] hover:bg-[#f4f7f2] disabled:opacity-50"
						>
							Bỏ chọn tất cả
						</button>
						<button
							type="submit"
							disabled={save.isPending}
							className="inline-flex items-center gap-2 rounded-xl bg-[#164027] px-4 py-2 text-xs font-bold text-white hover:bg-[#10301d] disabled:opacity-60"
						>
							{save.isPending && <Loader2 className="size-4 animate-spin" />}
							Lưu sở thích
						</button>
					</div>
				</form>
			)}
		</>
	);
}
