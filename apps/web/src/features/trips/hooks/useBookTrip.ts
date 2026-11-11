import { useCallback, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { BookTripInput, BookTripResponse } from "../types";

export interface BookTripError {
	status?: number;
	message: string;
	isConflict: boolean;
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

function extractBackendMessage(error: HttpError): string | null {
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
	return values.length > 0 ? values.join(". ") : null;
}

export function localizeBookTripMessage(
	detail: string | null,
	status?: number
): { message: string; isConflict: boolean } {
	if (!detail) {
		const defaultMessages: Record<number, string> = {
			401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
			403: "Bạn không có quyền thực hiện đặt chỗ cho chuyến đi này.",
			404: "Chuyến đi không tồn tại hoặc đã bị hủy.",
			409: "Chuyến đi không còn đủ chỗ trống do vừa có người đặt trước. Vui lòng tải lại để cập nhật số chỗ còn lại.",
			422: "Thông tin đặt chỗ không hợp lệ. Vui lòng kiểm tra lại số lượng khách.",
		};
		return {
			message:
				(status && defaultMessages[status]) || "Không thể hoàn tất đặt chỗ. Vui lòng thử lại.",
			isConflict: status === 409,
		};
	}

	const lower = detail.toLowerCase();

	// 1. Weather risk RED block
	if (
		lower.includes("weather risk is red") ||
		lower.includes("weather risk") ||
		lower.includes("báo động đỏ") ||
		lower.includes("rủi ro thời tiết")
	) {
		return {
			message:
				"Không thể đặt chỗ mới do điều kiện thời tiết trên tuyến trekking đang ở mức cảnh báo Báo động Đỏ (nguy hiểm).",
			isConflict: false,
		};
	}

	if (lower.includes("no weather risk assessment") || lower.includes("đánh giá rủi ro thời tiết")) {
		return {
			message: "Chưa có dữ liệu đánh giá rủi ro thời tiết cho tuyến này. Vui lòng thử lại sau.",
			isConflict: false,
		};
	}

	// 2. Deadline passed
	if (lower.includes("booking deadline has passed") || lower.includes("hết hạn đặt chỗ")) {
		return {
			message: "Đã hết thời hạn đặt chỗ cho chuyến đi này.",
			isConflict: false,
		};
	}

	// 3. Trip already started
	if (lower.includes("trip has already started") || lower.includes("đã bắt đầu")) {
		return {
			message: "Chuyến đi này đã khởi hành, không thể tiếp tục đặt chỗ.",
			isConflict: false,
		};
	}

	// 4. Route not active
	if (lower.includes("route is not active") || lower.includes("không hoạt động")) {
		return {
			message: "Tuyến trekking của chuyến đi hiện không còn hoạt động.",
			isConflict: false,
		};
	}

	// 5. Trip not available
	if (lower.includes("trip is not available")) {
		return {
			message: "Chuyến đi hiện chưa sẵn sàng để đặt chỗ.",
			isConflict: false,
		};
	}

	// 6. Idempotency replay with different payload
	if (lower.includes("idempotency-key")) {
		return {
			message: "Yêu cầu đặt chỗ bị trùng lặp với thông tin khác nhau. Vui lòng thử lại.",
			isConflict: false,
		};
	}

	// 7. Amount limit
	if (lower.includes("amount exceeds")) {
		return {
			message: "Tổng số tiền vượt quá hạn mức thanh toán cho phép.",
			isConflict: false,
		};
	}

	// 8. Capacity / Seats conflict (Overbooking guard)
	if (
		lower.includes("seat") ||
		lower.includes("remain") ||
		lower.includes("capacity") ||
		lower.includes("chỗ trống") ||
		lower.includes("sức chứa") ||
		status === 409
	) {
		const seatMatch = detail.match(/only (\d+) seats? remain/i);
		const remainingText = seatMatch ? ` (chỉ còn ${seatMatch[1]} chỗ trống)` : "";
		return {
			message: `Chuyến đi không còn đủ chỗ trống do vừa có người đặt trước${remainingText}. Vui lòng tải lại để cập nhật số chỗ còn lại.`,
			isConflict: true,
		};
	}

	return {
		message: detail,
		isConflict: false,
	};
}

export function mapBookTripError(error: unknown): BookTripError {
	if (!(error instanceof HttpError)) {
		return {
			message: "Lỗi kết nối mạng. Vui lòng kiểm tra đường truyền và thử lại.",
			isConflict: false,
			canRetry: true,
			fieldErrors: {},
		};
	}

	const detail = extractBackendMessage(error);
	const { message, isConflict } = localizeBookTripMessage(detail, error.status);

	return {
		status: error.status,
		message,
		isConflict,
		canRetry: isConflict || error.status >= 500,
		fieldErrors: extractFieldErrors(error.errorData),
	};
}

export function useBookTrip() {
	const [isBooking, setIsBooking] = useState<boolean>(false);
	const [isSuccess, setIsSuccess] = useState<boolean>(false);
	const [booking, setBooking] = useState<BookTripResponse | null>(null);
	const [error, setError] = useState<BookTripError | null>(null);
	const [lastInput, setLastInput] = useState<BookTripInput | null>(null);
	const inFlight = useRef<boolean>(false);
	const lastInputRef = useRef<BookTripInput | null>(null);
	const idempotencyKeyRef = useRef<string | null>(null);

	const execute = useCallback(async (input: BookTripInput): Promise<BookTripResponse | null> => {
		const idempotencyKey = idempotencyKeyRef.current;
		if (inFlight.current || !idempotencyKey) return null;
		inFlight.current = true;
		setIsBooking(true);
		setError(null);
		setIsSuccess(false);

		try {
			const result = await tripsService.book(input, idempotencyKey);
			idempotencyKeyRef.current = null;
			setBooking(result);
			setIsSuccess(true);
			return result;
		} catch (err) {
			const mapped = mapBookTripError(err);
			setError(mapped);
			return null;
		} finally {
			inFlight.current = false;
			setIsBooking(false);
		}
	}, []);

	const book = useCallback(
		(input: BookTripInput): Promise<BookTripResponse | null> => {
			if (inFlight.current) return Promise.resolve(null);
			const idempotencyKey = crypto.randomUUID();
			lastInputRef.current = input;
			idempotencyKeyRef.current = idempotencyKey;
			setLastInput(input);
			return execute(input);
		},
		[execute]
	);

	const retry = useCallback((): Promise<BookTripResponse | null> => {
		if (lastInputRef.current && idempotencyKeyRef.current) {
			return execute(lastInputRef.current);
		}
		return Promise.resolve(null);
	}, [execute]);

	const reset = useCallback((): void => {
		setIsBooking(false);
		setIsSuccess(false);
		setBooking(null);
		setError(null);
		lastInputRef.current = null;
		idempotencyKeyRef.current = null;
		setLastInput(null);
	}, []);

	const clearConflict = useCallback((): void => {
		setError((prev) => (prev?.isConflict ? null : prev));
	}, []);

	const updateBookingTotal = useCallback((totalAmount: string): void => {
		setBooking((prev) => (prev ? { ...prev, totalAmount } : null));
	}, []);

	return {
		book,
		retry,
		reset,
		clearConflict,
		updateBookingTotal,
		isBooking,
		isSuccess,
		booking,
		error: error?.message ?? null,
		fieldErrors: error?.fieldErrors ?? {},
		isConflict: error?.isConflict ?? false,
		canRetry: error?.canRetry ?? false,
		lastInput,
	};
}
