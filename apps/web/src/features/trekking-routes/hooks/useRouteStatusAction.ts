import { useCallback, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import type { CreatedTrekkingRoute, RouteLifecycleAction, RouteStatusReasonInput } from "../types";

export interface RouteStatusActionError {
	status?: number;
	message: string;
}

function backendMessage(error: HttpError): string | null {
	if (typeof error.errorData !== "object" || error.errorData === null) return null;
	const message = (error.errorData as { message?: unknown }).message;
	if (typeof message === "string") return message;
	if (!Array.isArray(message)) return null;
	const details = message.flatMap((item) => {
		if (typeof item === "string") return [item];
		if (typeof item !== "object" || item === null) return [];
		const errors = (item as { errors?: unknown }).errors;
		return Array.isArray(errors)
			? errors.filter((value): value is string => typeof value === "string")
			: [];
	});
	return details.length > 0 ? details.join(" ") : null;
}

export function mapRouteStatusActionError(error: unknown): RouteStatusActionError {
	if (!(error instanceof HttpError)) {
		return { message: "Không thể cập nhật trạng thái tuyến đường. Vui lòng thử lại." };
	}
	const messages: Record<number, string> = {
		401: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
		403: "Bạn không có quyền thay đổi trạng thái tuyến đường này.",
		404: "Không tìm thấy tuyến đường.",
		409: "Trạng thái hoặc dữ liệu tuyến đường đã thay đổi. Hãy tải lại và thử lại.",
		422: "Lý do thay đổi trạng thái chưa hợp lệ.",
	};
	return {
		status: error.status,
		message:
			backendMessage(error) ??
			messages[error.status] ??
			"Không thể cập nhật trạng thái tuyến đường. Vui lòng thử lại.",
	};
}

export function useRouteStatusAction(onConflict?: () => Promise<unknown>) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<RouteStatusActionError | null>(null);
	const inFlight = useRef(false);

	const submit = useCallback(
		async (
			action: RouteLifecycleAction,
			routeId: string,
			input: RouteStatusReasonInput
		): Promise<CreatedTrekkingRoute | null> => {
			if (inFlight.current) return null;
			inFlight.current = true;
			setIsSubmitting(true);
			setError(null);
			try {
				return action === "close"
					? await trekkingRoutesService.close(routeId, input)
					: await trekkingRoutesService.reopen(routeId, input);
			} catch (requestError) {
				const mapped = mapRouteStatusActionError(requestError);
				setError(mapped);
				if (mapped.status === 409 && onConflict) {
					await onConflict().catch(() => undefined);
				}
				return null;
			} finally {
				inFlight.current = false;
				setIsSubmitting(false);
			}
		},
		[onConflict]
	);

	const resetError = useCallback(() => setError(null), []);
	return { isSubmitting, error, submit, resetError };
}
