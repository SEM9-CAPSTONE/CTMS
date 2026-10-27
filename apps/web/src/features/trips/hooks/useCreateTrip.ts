import { useCallback, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import { tripImageText } from "../trip-image-text";
import { MAX_TRIP_IMAGES, isValidTripImage } from "../trip-images.constants";
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

interface Submission {
	payload: CreateTripInput;
	existingTrip?: Trip;
	images: File[];
}
interface PendingCreation {
	trip: Trip;
	nextImage: number;
}
export function useCreateTrip() {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<CreateTripError | null>(null);
	const [createdTrip, setCreatedTrip] = useState<Trip | null>(null);
	const [pendingTrip, setPendingTrip] = useState<Trip | null>(null);
	const inFlight = useRef(false);
	const lastSubmission = useRef<Submission | null>(null);
	const pending = useRef<PendingCreation | null>(null);
	const execute = useCallback(async (submission: Submission) => {
		if (inFlight.current) return null;
		inFlight.current = true;
		setIsSubmitting(true);
		setError(null);
		try {
			if (
				submission.images.length > MAX_TRIP_IMAGES ||
				submission.images.some((file) => !isValidTripImage(file))
			) {
				setError({
					message:
						submission.images.length > MAX_TRIP_IMAGES
							? tripImageText().limit
							: tripImageText().invalid,
					canRetry: false,
					fieldErrors: {},
				});
				return null;
			}
			if (!pending.current) {
				const trip = submission.existingTrip
					? await tripsService.updateDraft(submission.existingTrip.id, submission.payload)
					: await tripsService.create(submission.payload);
				pending.current = { trip, nextImage: 0 };
				setPendingTrip(trip);
			}
			const progress = pending.current;
			while (progress.nextImage < submission.images.length) {
				// Sequential uploads preserve selection order and the first-image thumbnail rule.
				const images = await tripsService.addImage(
					progress.trip.id,
					submission.images[progress.nextImage]
				);
				progress.trip = { ...progress.trip, coverImageUrl: images[0]?.url ?? null };
				progress.nextImage += 1;
			}
			const completed = progress.trip;
			pending.current = null;
			setPendingTrip(null);
			setCreatedTrip(completed);
			return completed;
		} catch (requestError) {
			setError(
				pending.current
					? { message: tripImageText().createUploadFailed, canRetry: true, fieldErrors: {} }
					: mapCreateTripError(requestError)
			);
			return null;
		} finally {
			inFlight.current = false;
			setIsSubmitting(false);
		}
	}, []);
	const submit = useCallback(
		(payload: CreateTripInput, images: File[] = [], existingTrip?: Trip) => {
			if (inFlight.current) return Promise.resolve(null);
			// A saved draft awaiting images must finish its original submission before moving on.
			if (pending.current && lastSubmission.current) return execute(lastSubmission.current);
			const submission = { payload, images: [...images], existingTrip };
			lastSubmission.current = submission;
			return execute(submission);
		},
		[execute]
	);
	const retry = useCallback(
		() => (lastSubmission.current ? execute(lastSubmission.current) : Promise.resolve(null)),
		[execute]
	);
	const reset = useCallback(() => {
		if (inFlight.current) return;
		setCreatedTrip(null);
		setPendingTrip(null);
		setError(null);
		lastSubmission.current = null;
		pending.current = null;
	}, []);
	return { isSubmitting, error, createdTrip, pendingTrip, submit, retry, reset };
}
