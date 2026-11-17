import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { queryKeys } from "../../../core/api/queryKeys";
import { useRealtimeConnection, useRealtimeEvent } from "../../../core/realtime/useRealtime";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { NOTIFICATION_EVENTS, NOTIFICATION_POLL_MS } from "../constants";
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
		refetchInterval: open ? NOTIFICATION_POLL_MS : false,
		refetchOnWindowFocus: "always" as const,
	});
	const count = useQuery({
		queryKey: queryKeys.inAppNotifications.count(actor),
		queryFn: inAppNotificationsService.count,
		enabled,
		retry: false,
		gcTime: 0,
		refetchInterval: NOTIFICATION_POLL_MS,
		refetchOnWindowFocus: "always" as const,
	});
	const refresh = useCallback(() => {
		void client.invalidateQueries({ queryKey: queryKeys.inAppNotifications.actor(actor) });
	}, [actor, client]);
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
