import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { PackingListResponse } from "../types";

export const packingListService = {
	getPackingList: (bookingId: string): Promise<PackingListResponse> =>
		httpClient.get<PackingListResponse>(API_ENDPOINTS.BOOKINGS.PACKING_LIST(bookingId)),
};
