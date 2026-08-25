export interface CampsiteSearchFilters {
	province?: string;
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
	latitude: number;
	longitude: number;
}

export interface CampsiteLocationState {
	placeLabel: string;
	latitude: number | null;
	longitude: number | null;
}

export interface PlaceSuggestion {
	id: string;
	label: string;
	latitude: number;
	longitude: number;
	province?: string;
}

export interface ReverseGeocodeResult {
	placeLabel: string;
	province?: string;
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

export interface CreateCampsiteImageInput {
	url: string;
	type?: "photo";
	sortOrder?: number;
}

export interface CreateCampsiteInput {
	name: string;
	description: string;
	latitude: number;
	longitude: number;
	province: string;
	policies: { rules: string };
	operatingHours: { opensAt: string; closesAt: string };
	media: CreateCampsiteImageInput[];
}

export interface UpdateCampsiteInput extends Partial<CreateCampsiteInput> {
	expectedUpdatedAt?: string;
	changeReason?: string;
}

export interface CampsiteImageResponse {
	id: string;
	url: string;
	type: "photo";
	sortOrder: number;
}

export const CampsiteStatus = {
	DRAFT: "draft",
	PENDING_APPROVAL: "pending_approval",
	ACTIVE: "active",
	TEMPORARILY_CLOSED: "temporarily_closed",
	SUSPENDED: "suspended",
	CLOSED: "closed",
	ARCHIVED: "archived",
} as const;

export type CampsiteStatusType = (typeof CampsiteStatus)[keyof typeof CampsiteStatus];

export interface CreatedCampsite {
	id: string;
	hostId: string;
	name: string;
	description: string;
	latitude: number;
	longitude: number;
	province: string;
	policies: { rules: string } | null;
	operatingHours: { opensAt?: string; closesAt?: string } | null;
	status: CampsiteStatusType;
	media: CampsiteImageResponse[];
	createdAt: string;
	updatedAt: string;
}
