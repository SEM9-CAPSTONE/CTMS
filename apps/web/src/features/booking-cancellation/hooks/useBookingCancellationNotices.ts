import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { CANCELLATION_NOTICE_POLL_MS } from "../constants";
import { bookingCancellationNoticesService } from "../services/booking-cancellation-notices.service";

export function useBookingCancellationNotices() {
	const userId = getStoredAuthUser()?.id ?? "";
	const client = useQueryClient();
	const key = queryKeys.bookings.cancellationNotices(userId);
	const query = useQuery({
		queryKey: key,
		queryFn: bookingCancellationNoticesService.list,
		enabled: Boolean(userId && localStorage.getItem("accessToken")),
		refetchInterval: CANCELLATION_NOTICE_POLL_MS,
	});
	const markRead = useMutation({
		mutationFn: bookingCancellationNoticesService.markRead,
		onSuccess: () => client.invalidateQueries({ queryKey: key }),
	});
	const unread = query.data?.filter((notice) => !notice.readAt).length ?? 0;
	return { query, markRead, unread };
}
