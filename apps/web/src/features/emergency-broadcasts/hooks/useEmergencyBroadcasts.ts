import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { HttpError } from "../../../core/api/httpClient";
import { queryKeys } from "../../../core/api/queryKeys";
import type { RealtimeConnection } from "../../../core/realtime/realtimeConnection";
import { useRealtimeConnection, useRealtimeEvent } from "../../../core/realtime/useRealtime";
import {
	type EmergencyBroadcastsService,
	emergencyBroadcastsService,
} from "../services/emergency-broadcasts.service";
import type {
	CreateEmergencyBroadcastInput,
	EmergencyBroadcast,
	EmergencyBroadcastEvent,
} from "../types";

/** Fallback refresh for clients whose socket is down; the socket event refreshes immediately. */
export const EMERGENCY_BROADCASTS_REFRESH_MS = 60_000;

const newDraftId = () => crypto.randomUUID();

/**
 * Broadcasts of one Trip: everything for the managing Host, only the ones that addressed the
 * caller for a Camper/Porter (CTMS-081-T01). A matching `emergency.broadcast` event refetches.
 */
export function useEmergencyBroadcasts(
	tripId: string,
	options: {
		enabled?: boolean;
		service?: EmergencyBroadcastsService;
		connection?: RealtimeConnection;
	} = {}
) {
	const { enabled = true, service = emergencyBroadcastsService, connection } = options;
	const queryClient = useQueryClient();
	const queryKey = queryKeys.trips.emergencyBroadcasts(tripId);
	useRealtimeConnection(enabled, connection);
	useRealtimeEvent<EmergencyBroadcastEvent>(
		"emergency.broadcast",
		(event) => {
			if (event.tripId === tripId) void queryClient.invalidateQueries({ queryKey });
		},
		enabled,
		connection
	);
	return useQuery({
		queryKey,
		queryFn: () => service.list(tripId),
		enabled,
		refetchInterval: EMERGENCY_BROADCASTS_REFRESH_MS,
		retry: false,
	});
}

/**
 * Host send flow. One client UUID per draft: a retry after a timeout or a double click resends the
 * same ID, so the API returns the stored broadcast instead of creating a second one (Story AC5).
 * A new ID is only taken after a confirmed success or when the draft is reset.
 */
export function useSendEmergencyBroadcast(
	tripId: string,
	service: EmergencyBroadcastsService = emergencyBroadcastsService
) {
	const queryClient = useQueryClient();
	const [draftId, setDraftId] = useState(newDraftId);
	const mutation = useMutation({
		mutationFn: (input: Omit<CreateEmergencyBroadcastInput, "id">) =>
			service.create(tripId, { ...input, id: draftId }),
		onSuccess: (created: EmergencyBroadcast) => {
			queryClient.setQueryData<EmergencyBroadcast[]>(
				queryKeys.trips.emergencyBroadcasts(tripId),
				(current = []) => [created, ...current.filter((item) => item.id !== created.id)]
			);
			void queryClient.invalidateQueries({
				queryKey: queryKeys.trips.emergencyBroadcasts(tripId),
			});
			setDraftId(newDraftId());
		},
	});
	const { reset } = mutation;
	const startNewDraft = useCallback(() => {
		setDraftId(newDraftId());
		reset();
	}, [reset]);
	return { ...mutation, draftId, startNewDraft };
}

export function sendErrorMessage(error: unknown): string {
	if (!(error instanceof HttpError)) {
		return "Không gửi được do mất kết nối. Bấm Gửi lại: hệ thống sẽ không tạo cảnh báo trùng.";
	}
	const code =
		error.errorData && typeof error.errorData === "object" && "code" in error.errorData
			? String((error.errorData as { code: unknown }).code)
			: null;
	if (error.status === 404 || error.status === 403) {
		return "Bạn không quản lý chuyến đi này nên không thể phát cảnh báo.";
	}
	if (code === "TRIP_NOT_BROADCASTABLE") {
		return "Chỉ phát cảnh báo được cho chuyến đang mở bán hoặc đang diễn ra.";
	}
	if (code === "BROADCAST_ID_CONFLICT") {
		return "Bản nháp này đã được dùng cho một cảnh báo khác. Hãy tạo bản nháp mới rồi gửi lại.";
	}
	if (error.status === 409) return "Không thể phát cảnh báo cho chuyến đi này lúc này.";
	if (error.status === 422 || error.status === 400) {
		return "Nội dung cảnh báo không hợp lệ. Vui lòng kiểm tra loại cảnh báo và nội dung.";
	}
	return "Không gửi được cảnh báo. Bấm Gửi lại: hệ thống sẽ không tạo cảnh báo trùng.";
}

export function listErrorMessage(error: unknown): string {
	const status = error instanceof HttpError ? error.status : null;
	if (status === 403 || status === 404) return "Bạn không có quyền xem cảnh báo của chuyến này.";
	return "Không tải được danh sách cảnh báo khẩn.";
}
