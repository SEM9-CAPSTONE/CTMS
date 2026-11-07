import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { TripMemberLocations } from "../types";

export interface MemberLocationsService {
	get(tripId: string): Promise<TripMemberLocations>;
}

export const memberLocationsService: MemberLocationsService = {
	get: (tripId) =>
		httpClient.get<TripMemberLocations>(API_ENDPOINTS.TRIPS.MEMBER_LOCATIONS(tripId)),
};
