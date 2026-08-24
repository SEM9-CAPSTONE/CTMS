import { useCallback, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import type { CreateTrekkingRouteInput, CreatedTrekkingRoute } from "../types";

export interface CreateRouteError {
	status?: number;
	message: string;
	canRetry: boolean;
}

function backendMessage(error: HttpError): string | null {
	if (
		typeof error.errorData !== "object" ||
		error.errorData === null ||
		!("message" in error.errorData)
	)
		return null;
	const message = (error.errorData as { message?: unknown }).message;
	if (typeof message === "string") return message;
	if (!Array.isArray(message)) return null;
	const values = message.flatMap((item) => {
		if (typeof item === "string") return [item];
		if (typeof item !== "object" || item === null) return [];
		const issue = item as { field?: unknown; errors?: unknown };
		const field = typeof issue.field === "string" ? issue.field : "payload";
		return Array.isArray(issue.errors)
			? issue.errors
					.filter((value): value is string => typeof value === "string")
					.map((value) => `${field}: ${value}`)
			: [];
	});
	return values.length ? values.join(". ") : null;
}

export function mapCreateRouteError(error: unknown): CreateRouteError {
	if (!(error instanceof HttpError))
		return {
			message: "Không thể tạo tuyến đường. Vui lòng kiểm tra kết nối và thử lại.",
			canRetry: true,
		};
	const detail = backendMessage(error);
	const byStatus: Record<number, string> = {
		401: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
		403: "Bạn không có quyền tạo tuyến cho khu cắm trại này.",
		404: "Không tìm thấy khu cắm trại đã chọn.",
		409: "Yêu cầu bị xung đột. Dữ liệu đã nhập vẫn được giữ nguyên.",
		422: "Thông tin hoặc hình học tuyến đường chưa hợp lệ.",
	};
	return {
		status: error.status,
		message: detail || byStatus[error.status] || "Không thể tạo tuyến đường. Vui lòng thử lại.",
		canRetry: error.status === 409 || error.status >= 500,
	};
}

export function useCreateTrekkingRoute() {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<CreateRouteError | null>(null);
	const [createdRoute, setCreatedRoute] = useState<CreatedTrekkingRoute | null>(null);
	const inFlight = useRef(false);
	const lastPayload = useRef<CreateTrekkingRouteInput | null>(null);

	const execute = useCallback(async (payload: CreateTrekkingRouteInput) => {
		if (inFlight.current) return null;
		inFlight.current = true;
		setIsSubmitting(true);
		setError(null);
		try {
			const created = await trekkingRoutesService.create(payload);
			setCreatedRoute(created);
			return created;
		} catch (requestError) {
			setError(mapCreateRouteError(requestError));
			return null;
		} finally {
			inFlight.current = false;
			setIsSubmitting(false);
		}
	}, []);

	const submit = useCallback(
		(payload: CreateTrekkingRouteInput) => {
			lastPayload.current = payload;
			return execute(payload);
		},
		[execute]
	);
	const retry = useCallback(
		() => (lastPayload.current ? execute(lastPayload.current) : Promise.resolve(null)),
		[execute]
	);
	const reset = useCallback(() => {
		setCreatedRoute(null);
		setError(null);
		lastPayload.current = null;
	}, []);

	return { isSubmitting, error, createdRoute, submit, retry, reset };
}
