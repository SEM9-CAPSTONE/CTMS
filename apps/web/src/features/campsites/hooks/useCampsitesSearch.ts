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

function parsePrice(rawInput: string): number | undefined {
	if (rawInput.trim() === "") {
		return undefined;
	}
	const parsed = Number(rawInput);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function getUrlParams(): CampsiteSearchParams {
	const searchParams = new URLSearchParams(window.location.search);
	const name = searchParams.get("name") || undefined;
	const maxPriceStr = searchParams.get("maxPrice");
	const maxPrice = maxPriceStr ? Number(maxPriceStr) : undefined;
	const pageStr = searchParams.get("page");
	const page = pageStr ? Number(pageStr) : DEFAULT_CAMPSITES_PAGE;
	const limitStr = searchParams.get("limit");
	const limit = limitStr ? Number(limitStr) : DEFAULT_CAMPSITES_LIMIT;

	return { name, maxPrice, page, limit };
}

/**
 * CTMS-17-T02. `status` is never part of this hook's state or params --
 * search is always implicitly active-only, per CTMS-77's frozen contract
 * (see campsites.service.ts). There is no UI control for it because there
 * is nothing for it to control.
 */
export function useCampsitesSearch() {
	const initialParams = getUrlParams();
	const [params, setParams] = useState<CampsiteSearchParams>(initialParams);

	const [nameInput, setNameInput] = useState(initialParams.name || "");
	const [maxPriceInput, setMaxPriceInput] = useState(
		initialParams.maxPrice !== undefined ? String(initialParams.maxPrice) : ""
	);
	const [ratingInput, setRatingInput] = useState("");

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

	// Sync URL search parameters on params change
	useEffect(() => {
		const searchParams = new URLSearchParams();
		if (params.name) searchParams.set("name", params.name);
		if (params.maxPrice !== undefined) searchParams.set("maxPrice", String(params.maxPrice));
		if (params.page !== DEFAULT_CAMPSITES_PAGE) searchParams.set("page", String(params.page));
		if (params.limit !== DEFAULT_CAMPSITES_LIMIT) searchParams.set("limit", String(params.limit));

		const newSearch = searchParams.toString();
		const currentSearch = window.location.search.replace(/^\?/, "");
		if (newSearch !== currentSearch && window.location.pathname === "/campsites") {
			window.history.pushState({}, "", `/campsites?${newSearch}`);
		}
	}, [params]);

	// Listen to browser history popstate (back/forward actions)
	useEffect(() => {
		const handlePopState = () => {
			const urlParams = getUrlParams();
			setParams(urlParams);
			setNameInput(urlParams.name || "");
			setMaxPriceInput(urlParams.maxPrice !== undefined ? String(urlParams.maxPrice) : "");
		};

		window.addEventListener("popstate", handlePopState);
		return () => {
			window.removeEventListener("popstate", handlePopState);
		};
	}, []);

	useEffect(() => {
		void runSearch(params);
	}, [params, runSearch]);

	const submitFilters = useCallback(() => {
		if (requestInFlight.current) {
			return;
		}
		setParams({
			name: nameInput.trim() || undefined,
			maxPrice: parsePrice(maxPriceInput),
			page: DEFAULT_CAMPSITES_PAGE,
			limit: DEFAULT_CAMPSITES_LIMIT,
		});
	}, [nameInput, maxPriceInput]);

	const resetFilters = useCallback(() => {
		if (requestInFlight.current) {
			return;
		}
		setNameInput("");
		setMaxPriceInput("");
		setRatingInput("");
		setParams({ page: DEFAULT_CAMPSITES_PAGE, limit: DEFAULT_CAMPSITES_LIMIT });
	}, []);

	const setPage = useCallback((page: number) => {
		if (requestInFlight.current) {
			return;
		}
		setParams((current) => ({ ...current, page }));
	}, []);

	return {
		nameInput,
		maxPriceInput,
		ratingInput,
		setNameInput,
		setMaxPriceInput,
		setRatingInput,
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
