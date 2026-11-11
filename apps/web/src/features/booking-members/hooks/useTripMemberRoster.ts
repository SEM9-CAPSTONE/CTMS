import { useCallback, useEffect, useRef, useState } from "react";
import { bookingMembersService } from "../services/booking-members.service";
import type { MemberStatusError, TripMemberRosterResponse } from "../types";
import { mapMemberStatusError } from "./member-status-error";

const loadRosterFromService = (tripId: string) => bookingMembersService.getTripRoster(tripId);

export function useTripMemberRoster(
	tripId: string,
	loadRoster: (tripId: string) => Promise<TripMemberRosterResponse> = loadRosterFromService
) {
	const [data, setData] = useState<TripMemberRosterResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<MemberStatusError | null>(null);
	const generation = useRef(0);

	const refetch = useCallback(async () => {
		const attempt = generation.current;
		setIsLoading(true);
		setError(null);
		try {
			const response = await loadRoster(tripId);
			if (attempt !== generation.current) return null;
			setData(response);
			return response;
		} catch (requestError) {
			if (attempt === generation.current) setError(mapMemberStatusError(requestError));
			return null;
		} finally {
			if (attempt === generation.current) setIsLoading(false);
		}
	}, [loadRoster, tripId]);

	useEffect(() => {
		generation.current += 1;
		setData(null);
		void refetch();
		return () => {
			generation.current += 1;
		};
	}, [refetch]);

	return { data, isLoading, error, refetch };
}
