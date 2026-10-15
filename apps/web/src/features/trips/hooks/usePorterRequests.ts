import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HttpError, queryKeys } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { PorterRequest } from "../types";

function responseErrorMessage(error: unknown): string {
	if (error instanceof HttpError) {
		if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
		if (error.status === 403) return "Bạn không có quyền phản hồi yêu cầu Porter này.";
		if (error.status === 404) return "Không tìm thấy yêu cầu Porter.";
		if (error.status === 409)
			return "Yêu cầu không còn hợp lệ. Porter, lịch hoặc Trip đã thay đổi.";
	}
	return "Không thể xử lý yêu cầu Porter. Vui lòng thử lại.";
}

export function useMyPorterRequests() {
	return useQuery<PorterRequest[], unknown>({
		queryKey: queryKeys.trips.myPorterRequests,
		queryFn: () => tripsService.getMyPorterRequests(),
		retry: false,
		staleTime: 15_000,
	});
}

export function useHostPorterRequests(tripId: string) {
	return useQuery<PorterRequest[], unknown>({
		queryKey: queryKeys.trips.porterRequests(tripId),
		queryFn: () => tripsService.listPorterRequests(tripId),
		enabled: tripId.length > 0,
		retry: false,
		staleTime: 15_000,
	});
}

export function useAllHostPorterRequests() {
	return useQuery<PorterRequest[], unknown>({
		queryKey: queryKeys.trips.hostPorterRequests,
		queryFn: () => tripsService.getHostPorterRequests(),
		retry: false,
		staleTime: 15_000,
	});
}

export function useRespondToPorterRequest() {
	const queryClient = useQueryClient();

	return useMutation<PorterRequest, unknown, { requestId: string; action: "accept" | "decline" }>({
		mutationFn: ({ requestId, action }) =>
			action === "accept"
				? tripsService.acceptPorterRequest(requestId)
				: tripsService.declinePorterRequest(requestId),
		onSuccess: (request) => {
			queryClient.setQueryData<PorterRequest[] | undefined>(
				queryKeys.trips.myPorterRequests,
				(current) =>
					current?.map((item) => (item.id === request.id ? { ...item, ...request } : item))
			);
			void queryClient.invalidateQueries({ queryKey: queryKeys.trips.myPorterRequests });
			void queryClient.invalidateQueries({
				queryKey: queryKeys.trips.porterRequests(request.tripId),
			});
			void queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(request.tripId) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.trips.assigned });
		},
	});
}

export function useCancelPorterRequest() {
	const queryClient = useQueryClient();

	return useMutation<PorterRequest, unknown, { tripId: string; requestId: string }>({
		mutationFn: ({ tripId, requestId }) => tripsService.cancelPorterRequest(tripId, requestId),
		onSuccess: (request) => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.trips.hostPorterRequests });
			void queryClient.invalidateQueries({
				queryKey: queryKeys.trips.porterRequests(request.tripId),
			});
			void queryClient.invalidateQueries({ queryKey: queryKeys.trips.myPorterRequests });
		},
	});
}

export { responseErrorMessage };
