import { Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { geocodingService } from "../services/geocoding.service";
import type { PlaceSuggestion } from "../types";

interface LocationSearchProps {
	province: string;
	value: string;
	disabled?: boolean;
	errorMessage?: string;
	onInputChange: (value: string) => void;
	onSelect: (suggestion: PlaceSuggestion) => void;
}

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 350;

export function LocationSearch({
	province,
	value,
	disabled = false,
	errorMessage,
	onInputChange,
	onSelect,
}: LocationSearchProps) {
	const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [searchError, setSearchError] = useState("");
	const [hasSearched, setHasSearched] = useState(false);
	const [committedValue, setCommittedValue] = useState("");
	const searchValue = value ?? "";

	useEffect(() => {
		const query = searchValue.trim();
		const controller = new AbortController();

		if (query.length < MIN_QUERY_LENGTH || query === committedValue) {
			setSuggestions([]);
			setSearchError("");
			setHasSearched(false);
			setIsLoading(false);
			return () => controller.abort();
		}

		setIsLoading(true);
		setSearchError("");

		const timeout = window.setTimeout(() => {
			void geocodingService
				.searchPlaces(query, province, controller.signal)
				.then((nextSuggestions) => {
					setSuggestions(nextSuggestions);
					setHasSearched(true);
				})
				.catch((error: unknown) => {
					if (error instanceof DOMException && error.name === "AbortError") {
						return;
					}

					setSuggestions([]);
					setHasSearched(true);
					setSearchError(
						"Không thể tìm địa điểm lúc này. Bạn vẫn có thể chọn trực tiếp trên bản đồ."
					);
				})
				.finally(() => {
					if (!controller.signal.aborted) {
						setIsLoading(false);
					}
				});
		}, SEARCH_DEBOUNCE_MS);

		return () => {
			window.clearTimeout(timeout);
			controller.abort();
		};
	}, [committedValue, province, searchValue]);

	const changeInput = (nextValue: string) => {
		setCommittedValue("");
		onInputChange(nextValue);
	};

	const selectSuggestion = (suggestion: PlaceSuggestion) => {
		setCommittedValue(suggestion.label);
		setSuggestions([]);
		setHasSearched(false);
		setSearchError("");
		setIsLoading(false);
		onSelect(suggestion);
	};

	return (
		<div>
			<label htmlFor="placeLabel" className="text-sm font-bold text-[#34483b]">
				Địa điểm khu cắm trại *
			</label>

			<div className="relative mt-1.5">
				<Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-[#718579]" />
				<input
					id="placeLabel"
					value={searchValue}
					disabled={disabled}
					onChange={(event) => changeInput(event.target.value)}
					placeholder="Tìm địa chỉ hoặc tên địa điểm..."
					className="w-full rounded-xl border border-[#dfe8df] bg-white py-3 pr-10 pl-9 text-sm text-[#10221b] outline-none transition placeholder:text-[#9aaba0] focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 disabled:bg-gray-50"
				/>
				{isLoading && (
					<Loader2
						aria-label="Đang tìm địa điểm"
						className="-translate-y-1/2 absolute top-1/2 right-3 size-4 animate-spin text-[#164027]"
					/>
				)}
			</div>

			{errorMessage && <p className="mt-1 text-xs font-semibold text-red-600">{errorMessage}</p>}
			{searchError && <p className="mt-2 text-xs font-semibold text-amber-700">{searchError}</p>}

			{suggestions.length > 0 && (
				<ul className="mt-2 overflow-hidden rounded-xl border border-[#dfe8df] bg-white shadow-sm">
					{suggestions.map((suggestion) => (
						<li key={suggestion.id}>
							<button
								type="button"
								disabled={disabled}
								onClick={() => selectSuggestion(suggestion)}
								className="w-full px-3.5 py-3 text-left text-sm font-semibold text-[#10221b] hover:bg-[#eef6ef] disabled:opacity-60"
							>
								{suggestion.label}
							</button>
						</li>
					))}
				</ul>
			)}

			{hasSearched && !isLoading && !searchError && suggestions.length === 0 && (
				<p className="mt-2 text-xs font-semibold text-[#667a6d]">
					Không tìm thấy địa điểm phù hợp. Hãy thử từ khóa khác hoặc chọn trực tiếp trên bản đồ.
				</p>
			)}
		</div>
	);
}
