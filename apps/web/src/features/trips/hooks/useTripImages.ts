import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api";
import { type TripImage, tripsService } from "../services/trips.service";

export function useTripImages(tripId: string) {
	const client = useQueryClient();
	const query = useQuery({
		queryKey: queryKeys.trips.images(tripId),
		queryFn: () => tripsService.getImages(tripId),
		staleTime: 30_000,
	});
	const refresh = (images: TripImage[]) => {
		client.setQueryData(queryKeys.trips.images(tripId), images);
		void client.invalidateQueries({
			queryKey: queryKeys.trips.all,
			predicate: (q) => q.queryKey[1] !== "images",
		});
	};
	const add = useMutation({
		mutationFn: (file: File) => tripsService.addImage(tripId, file),
		onSuccess: refresh,
	});
	const remove = useMutation({
		mutationFn: (id: string) => tripsService.removeImage(tripId, id),
		onSuccess: (result) => refresh(result.images),
	});
	return { query, add, remove };
}
