import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_CAMPSITES_LIMIT, DEFAULT_CAMPSITES_PAGE } from "../constants";
import { campsitesService } from "../services/campsites.service";
import type { CampsiteSearchItem, CampsiteSearchPagination, CampsiteSearchParams } from "../types";
import { mapCampsitesError } from "../utils/campsites.utils";

const EMPTY_PAGINATION: CampsiteSearchPagination = {
	page: DEFAULT_CAMPSITES_PAGE,
	limit: DEFAULT_CAMPSITES_LIMIT,
	total: 0,
	totalPages: 0,
};

function parseAmenities(rawInput: string): string[] | undefined {
	const amenities = rawInput
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry !== "");
	return amenities.length > 0 ? amenities : undefined;
}

function parsePrice(rawInput: string): number | undefined {
	if (rawInput.trim() === "") {
		return undefined;
	}
	const parsed = Number(rawInput);
	return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * CTMS-17-T02. `status` is never part of this hook's state or params --
 * search is always implicitly active-only, per CTMS-77's frozen contract
 * (see campsites.service.ts). There is no UI control for it because there
 * is nothing for it to control.
 */
export function useCampsitesSearch() {
	const [params, setParams] = useState<CampsiteSearchParams>({
		page: DEFAULT_CAMPSITES_PAGE,
		limit: DEFAULT_CAMPSITES_LIMIT,
	});

	const [provinceInput, setProvinceInput] = useState("");
	const [amenitiesInput, setAmenitiesInput] = useState("");
	const [minPriceInput, setMinPriceInput] = useState("");
	const [maxPriceInput, setMaxPriceInput] = useState("");

	const [items, setItems] = useState<CampsiteSearchItem[]>([]);
	const [pagination, setPagination] = useState<CampsiteSearchPagination>(EMPTY_PAGINATION);
	const [isLoading, setIsLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// BR-241: disabling Search/Reset/Pagination while `isLoading` (Step 3)
	// is the primary defense. This ref is a synchronous second guard --
	// `isLoading` state updates land a render behind, so a rapid
	// double-click could otherwise slip a second request through before
	// the disabled attribute actually applies.
	const requestInFlight = useRef(false);

	const runSearch = useCallback(async (nextParams: CampsiteSearchParams) => {
		if (requestInFlight.current) {
			return;
		}
		requestInFlight.current = true;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const result = await campsitesService.search(nextParams);
			setItems(result.items);
			setPagination(result.pagination);
		} catch (error) {
			setErrorMessage(mapCampsitesError(error));
		} finally {
			requestInFlight.current = false;
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void runSearch(params);
		// `runSearch` is a useCallback with an empty dep array, so its
		// reference is stable for the component's lifetime -- including it
		// here satisfies the linter with zero behavior change (it can never
		// itself trigger an extra re-run).
	}, [params, runSearch]);

	const submitFilters = useCallback(() => {
		if (requestInFlight.current) {
			return;
		}
		setParams({
			province: provinceInput.trim() || undefined,
			amenities: parseAmenities(amenitiesInput),
			minPrice: parsePrice(minPriceInput),
			maxPrice: parsePrice(maxPriceInput),
			page: DEFAULT_CAMPSITES_PAGE,
			limit: DEFAULT_CAMPSITES_LIMIT,
		});
	}, [provinceInput, amenitiesInput, minPriceInput, maxPriceInput]);

	const resetFilters = useCallback(() => {
		if (requestInFlight.current) {
			return;
		}
		setProvinceInput("");
		setAmenitiesInput("");
		setMinPriceInput("");
		setMaxPriceInput("");
		setParams({ page: DEFAULT_CAMPSITES_PAGE, limit: DEFAULT_CAMPSITES_LIMIT });
	}, []);

	const setPage = useCallback((page: number) => {
		if (requestInFlight.current) {
			return;
		}
		setParams((current) => ({ ...current, page }));
	}, []);

	return {
		provinceInput,
		amenitiesInput,
		minPriceInput,
		maxPriceInput,
		setProvinceInput,
		setAmenitiesInput,
		setMinPriceInput,
		setMaxPriceInput,
		items,
		pagination,
		isLoading,
		errorMessage,
		submitFilters,
		resetFilters,
		setPage,
		reload: () => runSearch(params),
	};
}
