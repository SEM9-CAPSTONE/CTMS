import {
	type NotificationItem,
	NotificationPanel,
} from "../../../shared/components/NotificationPanel";
import { useBookingCancellationNotices } from "../../booking-cancellation/hooks/useBookingCancellationNotices";
import { departureReasonLabel, departureTime } from "../copy";
import { useDepartureInbox } from "../hooks/useDepartureInbox";

export function HostNotifications({ actor }: { actor: string }) {
	const { inbox, read, forbidden } = useDepartureInbox(actor);
	const { query, markRead } = useBookingCancellationNotices();
	const departures: NotificationItem[] = (inbox.isError ? [] : (inbox.data ?? [])).map((item) => ({
		id: `departure:${item.id}`,
		tripId: item.tripId,
		createdAt: item.createdAt,
		unread: !item.readAt && !item.resolved,
		kind: "departure",
		title: item.tripTitle ?? "Chuyến đi",
		description: `${item.resolved ? "Chuyến đã kết thúc." : `${item.active ? "" : "Trước đây: "}${departureReasonLabel(item.reasonCode)}`}${item.startsAt ? ` Khởi hành ${departureTime(item.startsAt)}.` : ""}`,
	}));
	const bookings: NotificationItem[] = (query.isError ? [] : (query.data ?? [])).map((item) => ({
		id: `booking:${item.id}`,
		tripId: item.tripId,
		createdAt: item.createdAt,
		unread: !item.readAt,
		kind: "booking",
		title: `${item.camperName ?? "Khách tham gia"} đã hủy đặt chỗ`,
		description: `${item.tripTitle}${item.reason ? ` · ${item.reason}` : ""}`,
	}));
	return (
		<NotificationPanel
			items={[...departures, ...bookings]}
			loading={inbox.isPending || query.isLoading}
			error={
				inbox.isError || query.isError
					? forbidden
						? "Bạn không có quyền xem thông báo khởi hành."
						: "Chưa tải được một số thông báo."
					: undefined
			}
			onRefresh={() => {
				void inbox.refetch();
				void query.refetch();
			}}
			onRead={(item) =>
				item.kind === "departure"
					? read.mutateAsync(item.id.slice("departure:".length))
					: markRead.mutateAsync(item.id.slice("booking:".length))
			}
		/>
	);
}
