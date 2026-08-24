import { AlertCircle, MapPin } from "lucide-react";
import { Suspense, lazy, useCallback, useState } from "react";
import { geocodingService } from "../services/geocoding.service";
import type { CampsiteLocationState, PlaceSuggestion } from "../types";
import { CurrentLocationButton } from "./CurrentLocationButton";
import { LocationSearch } from "./LocationSearch";

const CampsiteMap = lazy(() => import("./CampsiteMap"));

interface CampsiteLocationPickerProps {
	province: string;
	value: CampsiteLocationState;
	disabled?: boolean;
	errors?: {
		placeLabel?: string;
		latitude?: string;
		longitude?: string;
	};
	onChange: (location: CampsiteLocationState) => void;
	onProvinceChange?: (province: string) => void;
}

function mapLocationError(errors?: CampsiteLocationPickerProps["errors"]): string | undefined {
	return errors?.latitude ?? errors?.longitude;
}

export function CampsiteLocationPicker({
	province,
	value,
	disabled = false,
	errors,
	onChange,
	onProvinceChange,
}: CampsiteLocationPickerProps) {
	const [locationError, setLocationError] = useState("");
	const coordinateError = mapLocationError(errors);

	const updateLocation = useCallback(
		(location: CampsiteLocationState) => {
			setLocationError("");
			onChange(location);
		},
		[onChange]
	);

	const reverseAndUpdate = useCallback(
		(latitude: number, longitude: number) => {
			updateLocation({
				placeLabel: value.placeLabel,
				latitude,
				longitude,
			});

			void geocodingService
				.reverseGeocode(latitude, longitude)
				.then(({ placeLabel, province: resolvedProvince }) => {
					onChange({
						placeLabel,
						latitude,
						longitude,
					});

					if (resolvedProvince) {
						onProvinceChange?.(resolvedProvince);
					}
				})
				.catch(() => {
					setLocationError("Không thể lấy tên địa điểm. Tọa độ đã chọn vẫn được giữ.");
				});
		},
		[onChange, onProvinceChange, updateLocation, value.placeLabel]
	);

	const selectSuggestion = (suggestion: PlaceSuggestion) => {
		updateLocation({
			placeLabel: suggestion.label,
			latitude: suggestion.latitude,
			longitude: suggestion.longitude,
		});

		if (suggestion.province) {
			onProvinceChange?.(suggestion.province);
		}
	};

	return (
		<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm sm:p-6">
			<div className="flex items-center gap-2">
				<MapPin className="size-5 text-[#164027]" />
				<h2 className="text-lg font-extrabold text-[#10221b]">Vị trí campsite</h2>
			</div>

			<div className="mt-5 grid gap-5">
				<LocationSearch
					province={province}
					value={value.placeLabel}
					disabled={disabled}
					errorMessage={errors?.placeLabel}
					onInputChange={(placeLabel) =>
						updateLocation({
							placeLabel,
							latitude: value.latitude,
							longitude: value.longitude,
						})
					}
					onSelect={selectSuggestion}
				/>

				<Suspense
					fallback={
						<div className="h-72 animate-pulse rounded-xl border border-[#dfe8df] bg-[#eef5ef]" />
					}
				>
					<CampsiteMap value={value} disabled={disabled} onPick={reverseAndUpdate} />
				</Suspense>

				<div className="flex flex-wrap items-center justify-between gap-3">
					<CurrentLocationButton
						disabled={disabled}
						onLocation={reverseAndUpdate}
						onError={setLocationError}
					/>

					{value.latitude !== null && value.longitude !== null && (
						<p className="text-xs font-bold text-[#667a6d]" data-testid="selected-location">
							{value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
						</p>
					)}
				</div>

				{coordinateError && (
					<p className="text-xs font-semibold text-red-600">
						Vui lòng chọn vị trí campsite trên bản đồ.
					</p>
				)}

				{locationError && (
					<div
						role="alert"
						className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"
					>
						<AlertCircle className="mt-0.5 size-4 shrink-0" />
						<span>{locationError}</span>
					</div>
				)}
			</div>
		</section>
	);
}
