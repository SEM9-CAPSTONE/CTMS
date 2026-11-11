import { useCallback, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import type { CreateRouteDangerZoneInput } from "../types";

function backendDetail(error: HttpError): string | null {
	if (
		typeof error.errorData !== "object" ||
		error.errorData === null ||
		!("message" in error.errorData)
	) {
		return null;
	}
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
	return details.length ? details.join(". ") : null;
}

export function dangerZoneCreateError(error: unknown): string {
	if (!(error instanceof HttpError)) {
		return "Không thể tạo khu vực nguy hiểm. Vui lòng kiểm tra kết nối và thử lại.";
	}
	const detail = backendDetail(error);
	if (detail) return detail;
	const messages: Record<number, string> = {
		401: "Phiên đăng nhập đã hết hạn.",
		403: "Bạn không có quyền tạo khu vực nguy hiểm cho tuyến này.",
		404: "Không tìm thấy tuyến trekking đã chọn.",
		409: "Tuyến đã thay đổi trạng thái. Chỉ có thể tạo khu vực nguy hiểm khi tuyến đang ở trạng thái nháp.",
		422: "Dữ liệu hoặc hình học khu vực nguy hiểm chưa hợp lệ.",
	};
	return messages[error.status] ?? "Không thể tạo khu vực nguy hiểm. Vui lòng thử lại.";
}

export function useCreateRouteDangerZone(
	routeId: string,
	onCreated: () => Promise<unknown>,
	onConflict: () => Promise<unknown>
) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");
	const inFlight = useRef(false);

	const submit = useCallback(
		async (payload: CreateRouteDangerZoneInput) => {
			if (inFlight.current) return null;
			inFlight.current = true;
			setIsSubmitting(true);
			setError("");
			try {
				const zone = await trekkingRoutesService.createRouteDangerZone(routeId, payload);
				await onCreated();
				return zone;
			} catch (requestError) {
				setError(dangerZoneCreateError(requestError));
				if (requestError instanceof HttpError && requestError.status === 409) {
					try {
						await onConflict();
					} catch {
						// The mutation error remains authoritative even if the background Route refresh fails.
					}
				}
				return null;
			} finally {
				inFlight.current = false;
				setIsSubmitting(false);
			}
		},
		[onConflict, onCreated, routeId]
	);

	return { submit, isSubmitting, error };
}
