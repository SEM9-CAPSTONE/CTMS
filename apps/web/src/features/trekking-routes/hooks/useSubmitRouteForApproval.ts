import { useCallback, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import type { CreatedTrekkingRoute } from "../types";

export interface RouteSubmissionError {
	status?: number;
	message: string;
}

const SUBMISSION_ERROR_TRANSLATIONS: Record<string, string> = {
	"stored route checkpoints are invalid": "Dữ liệu các vị trí trên tuyến không hợp lệ.",
	"route must have exactly one start checkpoint": "Tuyến phải có đúng một điểm bắt đầu.",
	"route must have exactly one finish checkpoint": "Tuyến phải có đúng một điểm kết thúc.",
	"start checkpoint must occur before finish checkpoint":
		"Điểm bắt đầu phải nằm trước điểm kết thúc.",
	"stored route data is invalid": "Dữ liệu tuyến đường không hợp lệ.",
	"stored route geometry is invalid": "Dữ liệu đường tuyến không hợp lệ.",
	"stored route difficulty is invalid": "Độ khó của tuyến không hợp lệ.",
	"exactly one start checkpoint is required": "Tuyến phải có đúng một điểm bắt đầu.",
	"exactly one finish checkpoint is required": "Tuyến phải có đúng một điểm kết thúc.",
};

function translateBackendMessage(raw: string): string {
	let message = raw;
	for (const [en, vi] of Object.entries(SUBMISSION_ERROR_TRANSLATIONS)) {
		message = message.replaceAll(en, vi);
	}
	return message;
}

function backendMessage(error: HttpError): string | null {
	if (typeof error.errorData !== "object" || error.errorData === null) return null;
	const data = error.errorData as { message?: unknown };
	if (typeof data.message === "string") return translateBackendMessage(data.message);
	if (!Array.isArray(data.message)) return null;
	const details = data.message.flatMap((item) => {
		if (typeof item === "string") return [translateBackendMessage(item)];
		if (typeof item !== "object" || item === null) return [];
		const issue = item as { errors?: unknown };
		return Array.isArray(issue.errors)
			? issue.errors
					.filter((value): value is string => typeof value === "string")
					.map(translateBackendMessage)
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
