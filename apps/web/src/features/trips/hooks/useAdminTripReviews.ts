import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { ReviewTripInput, Trip } from "../types";

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

export function mapTripReviewError(error: unknown): string {
	if (!(error instanceof HttpError)) return "Không thể kết nối đến máy chủ. Vui lòng thử lại.";
	const message = backendMessage(error);
	if (error.status === 401) return "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.";
	if (error.status === 403) return "Bạn cần quyền Admin để xét duyệt trip.";
	if (error.status === 404) return "Không tìm thấy trip cần xét duyệt.";
	if (error.status === 409)
		return (
			message || "Trip đã được Admin khác xử lý hoặc không còn chờ duyệt. Hãy tải lại danh sách."
		);
	if (error.status === 422) return message || "Dữ liệu trip chưa đạt điều kiện phê duyệt.";
	return message || "Không thể xử lý xét duyệt trip.";
}

export function useAdminTripReviews() {
	const [items, setItems] = useState<Trip[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState("");

	const reload = useCallback(async () => {
		setIsLoading(true);
		setError("");
		try {
			setItems(await tripsService.listPendingReview());
		} catch (requestError) {
			setError(mapTripReviewError(requestError));
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void reload();
	}, [reload]);

	return { items, isLoading, error, reload };
}

export function useReviewTrip() {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");
	const inFlight = useRef(false);

	const submit = useCallback(async (tripId: string, input: ReviewTripInput) => {
		if (inFlight.current) return null;
		inFlight.current = true;
		setIsSubmitting(true);
		setError("");
		try {
			return await tripsService.review(tripId, input);
		} catch (requestError) {
			setError(mapTripReviewError(requestError));
			return null;
		} finally {
			inFlight.current = false;
			setIsSubmitting(false);
		}
	}, []);

	return { isSubmitting, error, submit, clearError: () => setError("") };
}
