import { useCallback, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { CancelTripInput, RescheduleTripInput, TripDetails } from "../types";

export interface TripOperationError {
	status?: number;
	message: string;
	fieldErrors: Record<string, string>;
	kind: "validation" | "conflict" | "blocked" | "network";
	canRetry: boolean;
}

type TripOperationPayload =
	| { type: "reschedule"; tripId: string; input: RescheduleTripInput }
	| { type: "cancel"; tripId: string; input: CancelTripInput };

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
	const messages = message.flatMap((item) => {
		if (typeof item === "string") return [item];
		if (typeof item !== "object" || item === null) return [];
		const issue = item as BackendFieldError;
		const field = typeof issue.field === "string" ? issue.field : "payload";
		if (!Array.isArray(issue.errors)) return [];
		return issue.errors
			.filter((value): value is string => typeof value === "string")
			.map((value) => `${field}: ${value}`);
	});
	return messages.length > 0 ? messages.join(". ") : null;
}

export function mapTripOperationError(error: unknown): TripOperationError {
	if (!(error instanceof HttpError)) {
		return {
			message: "Không thể kết nối tới hệ thống. Vui lòng thử lại.",
			fieldErrors: {},
			kind: "network",
			canRetry: true,
		};
	}

	const fieldErrors = extractFieldErrors(error.errorData);
	const detail = backendMessage(error);
	if (error.status === 422) {
		return {
			status: error.status,
			message: detail ?? "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra các trường được đánh dấu.",
			fieldErrors,
			kind: "validation",
			canRetry: false,
		};
	}
	if (error.status === 409) {
		return {
			status: error.status,
			message: detail ?? "Trạng thái chuyến đi đã thay đổi. Vui lòng tải lại và thử lại.",
			fieldErrors,
			kind: "conflict",
			canRetry: true,
		};
	}
	if (error.status === 403) {
		return {
			status: error.status,
			message: detail ?? "Bạn không có quyền thực hiện thao tác này.",
			fieldErrors,
			kind: "blocked",
			canRetry: false,
		};
	}
	return {
		status: error.status,
		message: detail ?? "Thao tác chưa hoàn tất. Vui lòng thử lại.",
		fieldErrors,
		kind: "network",
		canRetry: error.status >= 500,
	};
}

export function useTripOperations() {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<TripOperationError | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [updatedTrip, setUpdatedTrip] = useState<TripDetails | null>(null);
	const inFlight = useRef(false);
	const lastPayload = useRef<TripOperationPayload | null>(null);

	const execute = useCallback(async (payload: TripOperationPayload) => {
		if (inFlight.current) return null;
		inFlight.current = true;
		setIsSubmitting(true);
		setError(null);
		setSuccessMessage(null);
		try {
			const trip =
				payload.type === "reschedule"
					? await tripsService.reschedule(payload.tripId, payload.input)
					: await tripsService.cancel(payload.tripId, payload.input);
			setUpdatedTrip(trip);
			setSuccessMessage(
				payload.type === "reschedule"
					? "Đã đổi lịch chuyến đi. Hệ thống đã chuyển các cam kết liên quan sang trạng thái chờ xác nhận."
					: "Đã huỷ chuyến đi. Hệ thống đã xử lý các cam kết liên quan theo trạng thái mới."
			);
			return trip;
		} catch (requestError) {
			setError(mapTripOperationError(requestError));
			return null;
		} finally {
			inFlight.current = false;
			setIsSubmitting(false);
		}
	}, []);

	const reschedule = useCallback(
		(tripId: string, input: RescheduleTripInput) => {
			const payload: TripOperationPayload = { type: "reschedule", tripId, input };
			lastPayload.current = payload;
			return execute(payload);
		},
		[execute]
	);

	const cancel = useCallback(
		(tripId: string, input: CancelTripInput) => {
			const payload: TripOperationPayload = { type: "cancel", tripId, input };
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
		setError(null);
		setSuccessMessage(null);
		setUpdatedTrip(null);
		lastPayload.current = null;
	}, []);

	return { isSubmitting, error, successMessage, updatedTrip, reschedule, cancel, retry, reset };
}
