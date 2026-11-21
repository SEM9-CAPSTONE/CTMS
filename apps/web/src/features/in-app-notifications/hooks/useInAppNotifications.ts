import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { queryKeys } from "../../../core/api/queryKeys";
import { useRealtimeConnection, useRealtimeEvent } from "../../../core/realtime/useRealtime";
import { toast } from "../../../shared/components/Toast";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { NOTIFICATION_EVENTS } from "../constants";
import { inAppNotificationsService } from "../services/in-app-notifications.service";

export function useInAppNotifications(unread: boolean, open: boolean) {
	const actor = getStoredAuthUser()?.id ?? "";
	const enabled = Boolean(actor && localStorage.getItem("accessToken"));
	const client = useQueryClient();
	const list = useInfiniteQuery({
		queryKey: queryKeys.inAppNotifications.list(actor, unread),
		initialPageParam: undefined as string | undefined,
		queryFn: ({ pageParam }) => inAppNotificationsService.list(unread, pageParam),
		getNextPageParam: (last) => last.nextCursor ?? undefined,
		enabled: enabled && open,
		retry: false,
		gcTime: 0,
		refetchInterval: open ? 3_000 : false,
		refetchOnWindowFocus: "always" as const,
	});
	const count = useQuery({
		queryKey: queryKeys.inAppNotifications.count(actor),
		queryFn: inAppNotificationsService.count,
		enabled,
		retry: false,
		gcTime: 0,
		refetchInterval: 3_000,
		refetchOnWindowFocus: "always" as const,
	});
	const refresh = useCallback(() => {
		void client.invalidateQueries({ queryKey: queryKeys.inAppNotifications.actor(actor) });
		void client.invalidateQueries({ queryKey: ["review-moderation"] });
		void client.invalidateQueries({ queryKey: ["review-analytics"] });
	}, [actor, client]);

	const prevUnreadRef = useRef<number | null>(null);
	useEffect(() => {
		const nextUnread = count.data?.unreadCount;
		if (typeof nextUnread !== "number") return;
		if (prevUnreadRef.current !== null && nextUnread > prevUnreadRef.current) {
			void inAppNotificationsService
				.list(true)
				.then((page) => {
					const latest = page.items[0];
					if (!latest) return;
					if (latest.eventType === NOTIFICATION_EVENTS.REVIEW_AUTO_HIDDEN) {
						toast.warning(
							`AI vừa tự động ẩn một đánh giá vi phạm trên chuyến "${latest.target?.title ?? "của bạn"}".`
						);
					} else if (latest.eventType === NOTIFICATION_EVENTS.REVIEW_MODERATION_FLAGGED) {
						toast.info(
							`AI phát hiện một đánh giá cần kiểm tra trên chuyến "${latest.target?.title ?? "của bạn"}".`
						);
					}
					void client.invalidateQueries({ queryKey: ["review-moderation"] });
					void client.invalidateQueries({ queryKey: ["review-analytics"] });
				})
				.catch(() => undefined);
		}
		prevUnreadRef.current = nextUnread;
	}, [count.data?.unreadCount, client]);
	const connection = useRealtimeConnection(enabled);
	const lastEpoch = useRef(-1);
	useEffect(() => {
		if (enabled && connection.state === "connected" && lastEpoch.current !== connection.epoch) {
			lastEpoch.current = connection.epoch;
			refresh();
		}
	}, [enabled, connection.state, connection.epoch, refresh]);
	// Existing Trip-domain listeners own their toasts. This event only refreshes the inbox.
	useRealtimeEvent(NOTIFICATION_EVENTS.CREATED, refresh, enabled);
	useEffect(() => {
		const onFocus = () => {
			if (enabled) refresh();
		};
		window.addEventListener("focus", onFocus);
		return () => window.removeEventListener("focus", onFocus);
	}, [enabled, refresh]);
	const inFlight = useRef(new Map<string, Promise<unknown>>());
	const read = useMutation({
		mutationFn: inAppNotificationsService.markRead,
		onSuccess: refresh,
	});
	const markRead = (id: string): Promise<unknown> => {
		const pending = inFlight.current.get(id);
		if (pending) return pending;
		const promise = read.mutateAsync(id).finally(() => inFlight.current.delete(id));
		inFlight.current.set(id, promise);
		return promise;
	};
	const unique = new Map(
		list.data?.pages.flatMap((page) => page.items).map((item) => [item.id, item]) ?? []
	);
	return { actor, list, count, items: [...unique.values()], refresh, markRead, connection };
}
