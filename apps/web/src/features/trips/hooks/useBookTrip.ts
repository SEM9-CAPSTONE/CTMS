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
	const isConflict = error.status === 409;

	const defaultMessages: Record<number, string> = {
		401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
		403: "Bạn không có quyền thực hiện đặt chỗ cho chuyến đi này.",
		404: "Chuyến đi không tồn tại hoặc đã bị hủy.",
		409: "Chuyến đi không còn đủ chỗ trống do vừa có người đặt trước. Vui lòng tải lại để cập nhật số chỗ còn lại.",
		422: "Thông tin đặt chỗ không hợp lệ. Vui lòng kiểm tra lại số lượng khách.",
	};

	return {
		status: error.status,
		message:
			detail || defaultMessages[error.status] || "Không thể hoàn tất đặt chỗ. Vui lòng thử lại.",
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

	const execute = useCallback(async (input: BookTripInput): Promise<BookTripResponse | null> => {
		if (inFlight.current) return null;
		inFlight.current = true;
		setIsBooking(true);
		setError(null);
		setIsSuccess(false);

		try {
			const result = await tripsService.book(input);
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
			lastInputRef.current = input;
			setLastInput(input);
			return execute(input);
		},
		[execute]
	);

	const retry = useCallback((): Promise<BookTripResponse | null> => {
		if (lastInputRef.current) {
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
		setLastInput(null);
	}, []);

	const clearConflict = useCallback((): void => {
		setError((prev) => (prev?.isConflict ? null : prev));
	}, []);

	return {
		book,
		retry,
		reset,
		clearConflict,
		isBooking,
		isSuccess,
		booking,
		error: error?.message ?? null,
		fieldErrors: error?.fieldErrors ?? {},
		isConflict: error?.isConflict ?? false,
		lastInput,
	};
}
