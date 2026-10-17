import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HttpError, queryKeys } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { CreatePorterRequestInput, PorterRequest } from "../types";

export type PorterRequestErrorKind =
	| "authentication"
	| "forbidden"
	| "notFound"
	| "validation"
	| "conflict"
	| "retryable";

export interface PorterRequestErrorState {
	kind: PorterRequestErrorKind;
	message: string;
	canRetry: boolean;
}

export interface CreatePorterRequestVariables extends CreatePorterRequestInput {
	tripId: string;
}

export function mapCreatePorterRequestError(error: unknown): PorterRequestErrorState {
	if (error instanceof HttpError) {
		switch (error.status) {
			case 401:
				return {
					kind: "authentication",
					message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
					canRetry: false,
				};
			case 403:
				return {
					kind: "forbidden",
					message: "Bạn không có quyền gửi yêu cầu Porter cho chuyến đi này.",
					canRetry: false,
				};
			case 404:
				return {
					kind: "notFound",
					message: "Không tìm thấy chuyến đi để gửi yêu cầu Porter.",
					canRetry: false,
				};
			case 409:
				return {
					kind: "conflict",
					message: "Porter hiện không còn đủ điều kiện cho chuyến đi này.",
					canRetry: true,
				};
			case 400:
			case 422:
				return {
					kind: "validation",
					message: "Thông tin yêu cầu Porter chưa hợp lệ. Vui lòng kiểm tra lại.",
					canRetry: false,
				};
		}
	}

	return {
		kind: "retryable",
		message: "Không thể gửi yêu cầu Porter. Vui lòng thử lại.",
		canRetry: true,
	};
}

export function useCreatePorterRequest() {
	const queryClient = useQueryClient();

	return useMutation<PorterRequest, unknown, CreatePorterRequestVariables>({
		mutationFn: ({ tripId, porterId, requestedRole, note }) =>
			tripsService.createPorterRequest(tripId, {
				porterId,
				requestedRole,
				...(note ? { note } : {}),
			}),
		onSuccess: (request) => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.trips.myPorterRequests });
			queryClient.setQueryData(
				queryKeys.trips.pendingPorterRequest(request.tripId, request.porterId),
				request
			);
			void queryClient.invalidateQueries({
				queryKey: queryKeys.trips.porterRequests(request.tripId),
			});
			void queryClient.invalidateQueries({
				queryKey: queryKeys.trips.detail(request.tripId),
			});
			void queryClient.invalidateQueries({
				predicate: (query) =>
					Array.isArray(query.queryKey) &&
					query.queryKey[0] === "trips" &&
					query.queryKey[1] === request.tripId &&
					query.queryKey[2] === "available-porters",
			});
		},
	});
}
