import { useCallback, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { CreateTripInput, Trip } from "../types";

export interface CreateTripError {
	status?: number;
	message: string;
	canRetry: boolean;
	fieldErrors: Record<string, string>;
}

interface BackendFieldError {
	field?: unknown;
	errors?: unknown;
}

function extractFieldErrors(errorData: unknown): Record<string, string> {
	if (typeof errorData !== "object" || errorData === null || !("message" in errorData)) return {};
	const message = (errorData as { message?: unknown }).message;
	if (!Array.isArray(message)) return {};
	return message.reduce<Record<string, string>>((accumulator, item) => {
		if (typeof item !== "object" || item === null) return accumulator;
		const issue = item as BackendFieldError;
		if (typeof issue.field !== "string" || !Array.isArray(issue.errors)) return accumulator;
		const firstError = issue.errors.find((value): value is string => typeof value === "string");
		if (firstError) accumulator[issue.field] = firstError;
		return accumulator;
	}, {});
}

function backendMessage(error: HttpError): string | null {
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
	const values = message.flatMap((item) => {
		if (typeof item === "string") return [item];
		if (typeof item !== "object" || item === null) return [];
		const issue = item as BackendFieldError;
		const field = typeof issue.field === "string" ? issue.field : "payload";
		return Array.isArray(issue.errors)
			? issue.errors
					.filter((value): value is string => typeof value === "string")
					.map((value) => `${field}: ${value}`)
			: [];
	});
	return values.length ? values.join(". ") : null;
}

export function mapCreateTripError(error: unknown): CreateTripError {
	if (!(error instanceof HttpError)) {
		return {
			message: "Không thể tạo trip. Vui lòng kiểm tra kết nối và thử lại.",
			canRetry: true,
			fieldErrors: {},
		};
	}

	const detail = backendMessage(error);
	const byStatus: Record<number, string> = {
		401: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
		403: "Bạn không có quyền tạo trip cho tuyến đã chọn.",
		404: "Không tìm thấy tuyến trekking đã chọn hoặc tuyến không còn khả dụng.",
		409: "Tuyến chưa ở trạng thái đã duyệt, nên chưa thể tạo trip.",
		422: "Thông tin trip chưa hợp lệ. Vui lòng kiểm tra các trường được đánh dấu.",
	};

	return {
		status: error.status,
		message: detail || byStatus[error.status] || "Không thể tạo trip. Vui lòng thử lại.",
		canRetry: error.status === 409 || error.status >= 500,
		fieldErrors: extractFieldErrors(error.errorData),
	};
}

export function useCreateTrip() {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<CreateTripError | null>(null);
	const [createdTrip, setCreatedTrip] = useState<Trip | null>(null);
	const inFlight = useRef(false);
	const lastPayload = useRef<CreateTripInput | null>(null);

	const execute = useCallback(async (payload: CreateTripInput) => {
		if (inFlight.current) return null;
		inFlight.current = true;
		setIsSubmitting(true);
		setError(null);
		try {
			const created = await tripsService.create(payload);
			setCreatedTrip(created);
			return created;
		} catch (requestError) {
			setError(mapCreateTripError(requestError));
			return null;
		} finally {
			inFlight.current = false;
			setIsSubmitting(false);
		}
	}, []);

	const submit = useCallback(
		(payload: CreateTripInput) => {
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
		setCreatedTrip(null);
		setError(null);
		lastPayload.current = null;
	}, []);

	return { isSubmitting, error, createdTrip, submit, retry, reset };
}
