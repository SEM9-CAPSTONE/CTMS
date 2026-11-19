import type { NotificationItem } from "../../../shared/components/NotificationPanel";
import { InAppNotificationBell } from "../../in-app-notifications/components/InAppNotificationBell";
import { REQUEST_ACTION_LABELS, levelName } from "../../porter-levels/constants";
import { useLevelNotifications } from "../../porter-levels/hooks/useLevelRequests";
import { useMyPorterRequests } from "../../trips/hooks/usePorterRequests";

export function PorterNotifications({ actor }: { actor: string }) {
	const { query: levelQuery, read: levelRead } = useLevelNotifications();
	const tripRequests = useMyPorterRequests(Boolean(actor));

	const levelItems: NotificationItem[] = (levelQuery.isError ? [] : (levelQuery.data ?? [])).map(
		(item) => ({
			id: `level:${item.id}`,
			tripId: (item.payload.requestId as string) || "",
			createdAt: item.createdAt,
			unread: !item.readAt,
			kind: "level",
			title: `Xét cấp: ${REQUEST_ACTION_LABELS[item.payload.kind as keyof typeof REQUEST_ACTION_LABELS] ?? item.payload.kind}`,
			description: `${item.payload.routeName ? `${item.payload.routeName} · ` : ""}${levelName(item.payload.level)}${item.payload.reason ? ` · ${item.payload.reason}` : ""}`,
		})
	);

	const tripItems: NotificationItem[] = (tripRequests.isError ? [] : (tripRequests.data ?? []))
		.filter((req) => req.status === "pending")
		.map((item) => ({
			id: `trip-req:${item.id}`,
			tripId: item.tripId,
			createdAt: item.createdAt,
			unread: true,
			kind: "trip",
			title: `Yêu cầu phân công mới: ${item.trip?.title ?? "Chuyến đi"}`,
			description: `Chủ chuyến mời bạn tham gia vai trò ${item.requestedRole === "lead" ? "Trưởng đoàn" : "Hỗ trợ"}.`,
		}));

	return (
		<InAppNotificationBell
			legacyItems={[...levelItems, ...tripItems]}
			legacyLoading={levelQuery.isPending || tripRequests.isLoading}
			legacyError={
				levelQuery.isError || tripRequests.isError ? "Chưa tải được một số thông báo." : undefined
			}
			onLegacyRefresh={() => {
				void levelQuery.refetch();
				void tripRequests.refetch();
			}}
			onLegacyRead={async (item) => {
				if (item.id.startsWith("level:")) {
					await levelRead.mutateAsync(item.id.slice("level:".length));
				}
			}}
		/>
	);
}
