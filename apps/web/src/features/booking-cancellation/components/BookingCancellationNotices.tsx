import { NotificationPanel } from "../../../shared/components/NotificationPanel";
import { useBookingCancellationNotices } from "../hooks/useBookingCancellationNotices";

export function BookingCancellationNotices() {
	const { query, markRead } = useBookingCancellationNotices();
	return (
		<NotificationPanel
			label="Thông báo hủy đặt chỗ"
			items={(query.isError ? [] : (query.data ?? [])).map((notice) => ({
				id: notice.id,
				tripId: notice.tripId,
				kind: "booking",
				title: `${notice.camperName ?? "Khách tham gia"} đã hủy đặt chỗ`,
				description: `${notice.tripTitle}${notice.reason ? ` · ${notice.reason}` : ""}`,
				createdAt: notice.createdAt,
				unread: !notice.readAt,
			}))}
			loading={query.isLoading}
			error={query.isError ? "Chưa tải được thông báo." : undefined}
			onRefresh={() => void query.refetch()}
			onRead={(item) => markRead.mutateAsync(item.id)}
		/>
	);
}
