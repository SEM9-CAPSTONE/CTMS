import { InAppNotificationBell } from "../../in-app-notifications/components/InAppNotificationBell";
import { useBookingCancellationNotices } from "../hooks/useBookingCancellationNotices";

export function BookingCancellationNotices() {
	const { query, markRead } = useBookingCancellationNotices();
	return (
		<InAppNotificationBell
			legacyItems={(query.isError ? [] : (query.data ?? [])).map((notice) => ({
				id: notice.id,
				tripId: notice.tripId,
				kind: "booking",
				title: `${notice.camperName ?? "Khách tham gia"} đã hủy đặt chỗ`,
				description: `${notice.tripTitle}${notice.reason ? ` · ${notice.reason}` : ""}`,
				createdAt: notice.createdAt,
				unread: !notice.readAt,
			}))}
			legacyLoading={query.isLoading}
			legacyError={query.isError ? "Chưa tải được thông báo." : undefined}
			onLegacyRefresh={() => void query.refetch()}
			onLegacyRead={(item) => markRead.mutateAsync(item.id)}
		/>
	);
}
