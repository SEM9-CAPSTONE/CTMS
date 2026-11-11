import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import type {
	AdminTrekkingRouteReview,
	ReviewTrekkingRouteInput,
	RouteReviewOutcomeFilter,
	TrekkingRoutesPagination,
} from "../types";

const EMPTY_PAGINATION: TrekkingRoutesPagination = {
	page: 1,
	limit: 20,
	total: 0,
	totalPages: 0,
};

function backendMessage(error: HttpError): string | null {
	const data = error.errorData as { message?: unknown } | null;
	if (typeof data?.message === "string") return data.message;
	if (Array.isArray(data?.message)) {
		return data.message
			.flatMap((item) => {
				if (typeof item === "string") return [item];
				if (!item || typeof item !== "object") return [];
				const errors = (item as { errors?: unknown }).errors;
				return Array.isArray(errors)
					? errors.filter((value): value is string => typeof value === "string")
					: [];
			})
			.join(" ");
	}
	return null;
}

export function mapRouteReviewError(error: unknown): string {
	if (!(error instanceof HttpError)) return "Không thể kết nối đến máy chủ. Vui lòng thử lại.";
	const message = backendMessage(error);
	if (error.status === 401) return "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.";
	if (error.status === 403) return "Bạn cần quyền Admin để xét duyệt tuyến đường.";
	if (error.status === 404) return "Không tìm thấy tuyến đường cần xét duyệt.";
	if (error.status === 409)
		return message || "Tuyến đường đã được Admin khác xử lý. Hãy tải lại danh sách.";
	if (error.status === 422) return message || "Dữ liệu tuyến đường chưa đạt điều kiện phê duyệt.";
	return message || "Không thể xử lý xét duyệt tuyến đường.";
}

export function useAdminRouteReviews(
	reviewOutcome: RouteReviewOutcomeFilter = "pending",
	page = 1,
	limit = 20
) {
	const [items, setItems] = useState<AdminTrekkingRouteReview[]>([]);
	const [pagination, setPagination] = useState<TrekkingRoutesPagination>(EMPTY_PAGINATION);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState("");
	const requestSequence = useRef(0);

	const reload = useCallback(async () => {
		const requestId = ++requestSequence.current;
		setIsLoading(true);
		setError("");
		try {
			const response = await trekkingRoutesService.listAdminReviews({ reviewOutcome, page, limit });
			if (requestId !== requestSequence.current) return;
			setItems(response.items);
			setPagination(response.pagination);
		} catch (requestError) {
			if (requestId !== requestSequence.current) return;
			setError(mapRouteReviewError(requestError));
		} finally {
			if (requestId === requestSequence.current) setIsLoading(false);
		}
	}, [limit, page, reviewOutcome]);

	useEffect(() => {
		void reload();
	}, [reload]);

	return { items, pagination, isLoading, error, reload };
}

export function useReviewTrekkingRoute() {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");
	const inFlight = useRef(false);

	const submit = useCallback(async (routeId: string, input: ReviewTrekkingRouteInput) => {
		if (inFlight.current) return null;
		inFlight.current = true;
		setIsSubmitting(true);
		setError("");
		try {
			return await trekkingRoutesService.review(routeId, input);
		} catch (requestError) {
			setError(mapRouteReviewError(requestError));
			return null;
		} finally {
			inFlight.current = false;
			setIsSubmitting(false);
		}
	}, []);

	return { isSubmitting, error, submit, clearError: () => setError("") };
}
