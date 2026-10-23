import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { queryKeys } from "../../../core/api/queryKeys";
import { tripsService } from "../../trips/services/trips.service";
import type { TripDetails, TripSummary } from "../../trips/types";
import { CAMPER_DISCOVERY_PAGE_SIZE, CAMPER_DISCOVERY_REFRESH_MS } from "../constants";
import { useCamperMapTrip } from "./useCamperMapTrip";

function candidates(
	current: TripDetails | null | undefined,
	pages: Array<{ items: TripSummary[] }> = []
) {
	const trips: Array<TripDetails | TripSummary> = current ? [current] : [];
	for (const page of pages)
		for (const trip of page.items ?? []) {
			if (
				trip.status === "published" &&
				Date.parse(trip.endsAt) > Date.now() &&
				!trips.some((item) => item.id === trip.id)
			)
				trips.push(trip);
		}
	return trips;
}
export function useCamperTripCarousel(userId: string, enabled: boolean) {
	const current = useCamperMapTrip(userId, enabled);
	const [chosenId, setChosenId] = useState<string | null>(null);
	const listing = useInfiniteQuery({
		queryKey: queryKeys.trips.camperCarousel(userId),
		enabled: enabled && Boolean(userId) && Boolean(localStorage.getItem("accessToken")),
		initialPageParam: 1,
		queryFn: ({ pageParam }) =>
			tripsService.search({ page: pageParam, limit: CAMPER_DISCOVERY_PAGE_SIZE }),
		getNextPageParam: (last) =>
			last.pagination?.page < last.pagination?.totalPages ? last.pagination.page + 1 : undefined,
		staleTime: CAMPER_DISCOVERY_REFRESH_MS,
		refetchInterval: CAMPER_DISCOVERY_REFRESH_MS,
	});
	const trips = candidates(current.data, listing.data?.pages);
	const selected = trips.find((trip) => trip.id === chosenId) ?? trips[0];
	const index = selected ? trips.findIndex((trip) => trip.id === selected.id) : -1;
	const isBooked = Boolean(selected && selected.id === current.data?.id);
	const detail = useQuery({
		queryKey: queryKeys.trips.detail(selected?.id ?? ""),
		enabled: enabled && Boolean(selected) && !isBooked,
		queryFn: () => tripsService.getById(selected?.id ?? ""),
		staleTime: CAMPER_DISCOVERY_REFRESH_MS,
	});
	async function next() {
		if (trips[index + 1]) {
			setChosenId(trips[index + 1].id);
			return;
		}
		if (!listing.hasNextPage || listing.isFetchingNextPage) return;
		const result = await listing.fetchNextPage();
		const updated = candidates(current.data, result.data?.pages);
		const position = updated.findIndex((trip) => trip.id === selected?.id);
		if (updated[position + 1]) setChosenId(updated[position + 1].id);
	}
	return {
		trip: isBooked ? current.data : detail.data,
		selectedId: selected?.id,
		isBooked,
		index,
		isLoading:
			current.isLoading || listing.isLoading || Boolean(selected && !isBooked && detail.isLoading),
		isError: Boolean(selected && !isBooked && detail.isError),
		listError: listing.isError,
		isPaging: listing.isFetchingNextPage,
		canPrevious: index > 0,
		canNext: index < trips.length - 1 || Boolean(listing.hasNextPage),
		previous: () => {
			if (trips[index - 1]) setChosenId(trips[index - 1].id);
		},
		next,
		retry: () => {
			void listing.refetch();
			void current.refetch();
			if (selected && !isBooked) void detail.refetch();
		},
	};
}
