import { useQuery } from "@tanstack/react-query";
import { HttpError, queryKeys } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { AvailablePortersResponse, IntendedPorterRole } from "../types";

export const AVAILABLE_PORTERS_DEFAULT_PAGE = 1;
export const AVAILABLE_PORTERS_DEFAULT_LIMIT = 20;

export interface AvailablePortersQueryInput {
	tripId: string;
	role: IntendedPorterRole | null;
	minExperienceYears?: number;
	page?: number;
	limit?: number;
	enabled?: boolean;
}

export type AvailablePortersErrorKind =
	| "authentication"
	| "forbidden"
	| "notFound"
	| "validation"
	| "retryable";

export interface AvailablePortersErrorState {
	kind: AvailablePortersErrorKind;
	message: string;
	canRetry: boolean;
}

export function mapAvailablePortersError(error: unknown): AvailablePortersErrorState {
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
					message: "Bạn không có quyền xem Porter của chuyến đi này.",
					canRetry: false,
				};
			case 404:
				return {
					kind: "notFound",
					message: "Không tìm thấy chuyến đi để kiểm tra Porter.",
					canRetry: false,
				};
			case 400:
			case 422:
				return {
					kind: "validation",
					message: "Bộ lọc Porter không hợp lệ. Vui lòng kiểm tra lại.",
					canRetry: false,
				};
		}
	}

	return {
		kind: "retryable",
		message: "Không thể tải danh sách Porter. Vui lòng thử lại.",
		canRetry: true,
	};
}

export function useAvailablePorters({
	tripId,
	role,
	minExperienceYears,
	page = AVAILABLE_PORTERS_DEFAULT_PAGE,
	limit = AVAILABLE_PORTERS_DEFAULT_LIMIT,
	enabled = true,
}: AvailablePortersQueryInput) {
	return useQuery<AvailablePortersResponse, unknown>({
		queryKey: queryKeys.trips.availablePorters(tripId, role, minExperienceYears, page, limit),
		queryFn: () => {
			if (!role) throw new Error("Porter role is required");
			return tripsService.getAvailablePorters(tripId, {
				role,
				minExperienceYears,
				page,
				limit,
			});
		},
		enabled: enabled && tripId.length > 0 && role !== null,
		retry: (failureCount, error) =>
			failureCount < 1 && (!(error instanceof HttpError) || error.status >= 500),
		staleTime: 15_000,
	});
}
