/**
 * CTMS-17-T02. Mirrors CTMS-17-T01's frozen backend contract exactly
 * (services/api/src/modules/campsites/dto/*.ts) -- no extra fields invented
 * on either side (no `status`, no date/guest-count/type filters from the
 * landing page's static mockup -- those don't exist in the backend).
 */
export interface CampsiteSearchFilters {
	province?: string;
	city?: string;
	/** Comma-separated or repeated on the wire; kept as string[] in UI state. */
	amenities?: string[];
	minPrice?: number;
	maxPrice?: number;
}

export interface CampsiteSearchParams extends CampsiteSearchFilters {
	page: number;
	limit: number;
}

export interface CampsiteLocation {
	province: string;
	city: string;
	latitude: number;
	longitude: number;
}

/** Matches CampsiteSearchItemDto -- no price field: BR-048/AC3 only require name/location/coverImage/activeRoutes, price is a filter input, not a display field. */
export interface CampsiteSearchItem {
	id: string;
	name: string;
	location: CampsiteLocation;
	coverImage: string | null;
	/** Always [] today -- Trekking Routes is a separate, unbuilt domain (see CampsiteSearchItemDto's DG-6 doc comment). */
	activeRoutes: string[];
}

export interface CampsiteSearchPagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

export interface PaginatedCampsiteSearchResponse {
	items: CampsiteSearchItem[];
	pagination: CampsiteSearchPagination;
}
