import { useCallback, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { bookingEquipmentService } from "../services/booking-equipment.service";
import type { AddBookingItemInput, AddBookingItemResult } from "../types";

export interface AddBookingItemError {
	status?: number;
	message: string;
	isConflict: boolean;
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
	return null;
}

export function mapAddBookingItemError(error: unknown): AddBookingItemError {
	if (!(error instanceof HttpError)) {
		return {
			message: "Không thể thêm thiết bị. Vui lòng kiểm tra kết nối và thử lại.",
			isConflict: false,
			fieldErrors: {},
		};
	}

	const detail = backendMessage(error);
	const isConflict = error.status === 409;
	const byStatus: Record<number, string> = {
		401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
		403: "Bạn không có quyền thêm thiết bị vào booking này.",
		404: "Không tìm thấy booking hoặc thiết bị này.",
		409: "Thiết bị không còn đủ số lượng cho khoảng thời gian này, hoặc booking không còn nhận thêm thiết bị.",
		422: "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại thiết bị và số lượng.",
	};

	return {
		status: error.status,
		message: detail || byStatus[error.status] || "Không thể thêm thiết bị. Vui lòng thử lại.",
		isConflict,
		fieldErrors: extractFieldErrors(error.errorData),
	};
}

export function useAddBookingItem() {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<AddBookingItemError | null>(null);
	const inFlight = useRef(false);

	const submit = useCallback(
		async (bookingId: string, input: AddBookingItemInput): Promise<AddBookingItemResult | null> => {
			if (inFlight.current) return null;
			inFlight.current = true;
			setIsSubmitting(true);
			setError(null);
			try {
				const idempotencyKey = crypto.randomUUID();
				const result = await bookingEquipmentService.addItem(bookingId, input, idempotencyKey);
				return result;
			} catch (requestError) {
				setError(mapAddBookingItemError(requestError));
				return null;
			} finally {
				inFlight.current = false;
				setIsSubmitting(false);
			}
		},
		[]
	);

	const reset = useCallback(() => setError(null), []);

	return { isSubmitting, error, submit, reset };
}
