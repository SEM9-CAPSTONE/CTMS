import { useCallback, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import type { CreatedTrekkingRoute } from "../types";

export interface RouteSubmissionError {
	status?: number;
	message: string;
}

function backendMessage(error: HttpError): string | null {
	if (typeof error.errorData !== "object" || error.errorData === null) return null;
	const data = error.errorData as { message?: unknown };
	if (typeof data.message === "string") return data.message;
	if (!Array.isArray(data.message)) return null;
	const details = data.message.flatMap((item) => {
		if (typeof item === "string") return [item];
		if (typeof item !== "object" || item === null) return [];
		const issue = item as { errors?: unknown };
		return Array.isArray(issue.errors)
			? issue.errors.filter((value): value is string => typeof value === "string")
			: [];
	});
	return details.length > 0 ? details.join(" ") : null;
}

export function mapRouteSubmissionError(error: unknown): RouteSubmissionError {
	if (!(error instanceof HttpError)) {
		return { message: "Không thể gửi tuyến đường để duyệt. Vui lòng thử lại." };
	}
	const detail = backendMessage(error);
	const messages: Record<number, string> = {
		401: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
		403: "Bạn không có quyền gửi duyệt tuyến đường này.",
		404: "Không tìm thấy tuyến đường. Danh sách sẽ được tải lại.",
		409: "Trạng thái tuyến đường đã thay đổi. Hãy kiểm tra dữ liệu mới nhất và thử lại.",
		422: "Tuyến chưa đủ điều kiện gửi duyệt.",
	};
	return {
		status: error.status,
		message:
			detail ?? messages[error.status] ?? "Không thể gửi tuyến đường để duyệt. Vui lòng thử lại.",
	};
}

export function useSubmitRouteForApproval(onReload: () => Promise<unknown>) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<RouteSubmissionError | null>(null);
	const inFlight = useRef(false);

	const submit = useCallback(
		async (routeId: string): Promise<CreatedTrekkingRoute | null> => {
			if (inFlight.current) return null;
			inFlight.current = true;
			setIsSubmitting(true);
			setError(null);
			try {
				const updated = await trekkingRoutesService.submitForApproval(routeId);
				await onReload();
				return updated;
			} catch (requestError) {
				const mapped = mapRouteSubmissionError(requestError);
				setError(mapped);
				if (mapped.status === 404) await onReload();
				return null;
			} finally {
				inFlight.current = false;
				setIsSubmitting(false);
			}
		},
		[onReload]
	);

	const clearError = useCallback(() => setError(null), []);
	return { isSubmitting, error, submit, clearError };
}
