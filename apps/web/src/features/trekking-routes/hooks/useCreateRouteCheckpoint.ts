import { useCallback, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import type { CreateCheckpointInput } from "../types";

function backendDetail(error: HttpError): string | null {
	if (
		typeof error.errorData !== "object" ||
		error.errorData === null ||
		!("message" in error.errorData)
	)
		return null;
	const message = (error.errorData as { message?: unknown }).message;
	if (typeof message === "string") return message;
	if (!Array.isArray(message)) return null;
	const issues = message.flatMap((item) => {
		if (typeof item !== "object" || item === null) return [];
		const issue = item as { field?: unknown; errors?: unknown };
		return Array.isArray(issue.errors)
			? issue.errors.filter((value): value is string => typeof value === "string")
			: [];
	});
	return issues.length ? issues.join(". ") : null;
}

export function checkpointCreateError(error: unknown): string {
	if (!(error instanceof HttpError))
		return "Không thể tạo checkpoint. Vui lòng kiểm tra kết nối và thử lại.";
	const detail = backendDetail(error);
	if (detail) return detail;
	const messages: Record<number, string> = {
		401: "Phiên đăng nhập đã hết hạn.",
		403: "Bạn không có quyền tạo checkpoint cho tuyến này.",
		404: "Không tìm thấy tuyến trekking đã chọn.",
		409: "Chỉ có thể tạo checkpoint khi tuyến đang ở trạng thái nháp.",
		422: "Dữ liệu checkpoint chưa hợp lệ hoặc vị trí cách tuyến quá 50 mét.",
	};
	return messages[error.status] ?? "Không thể tạo checkpoint. Vui lòng thử lại.";
}

export function useCreateRouteCheckpoint(routeId: string, onCreated: () => Promise<unknown>) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");
	const inFlight = useRef(false);

	const submit = useCallback(
		async (payload: CreateCheckpointInput) => {
			if (inFlight.current) return null;
			inFlight.current = true;
			setIsSubmitting(true);
			setError("");
			try {
				const checkpoint = await trekkingRoutesService.createCheckpoint(routeId, payload);
				await onCreated();
				return checkpoint;
			} catch (requestError) {
				setError(checkpointCreateError(requestError));
				return null;
			} finally {
				inFlight.current = false;
				setIsSubmitting(false);
			}
		},
		[onCreated, routeId]
	);

	return { submit, isSubmitting, error };
}
