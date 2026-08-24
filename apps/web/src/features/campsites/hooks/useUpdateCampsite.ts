import { useCallback, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { campsitesService } from "../services/campsites.service";
import type { CreatedCampsite, UpdateCampsiteInput } from "../types";

export interface UpdateCampsiteError {
	status?: number;
	message: string;
	canRetry: boolean;
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

	if (typeof message === "string") {
		return message;
	}

	if (Array.isArray(message)) {
		const messages = message.flatMap((item) => {
			if (typeof item === "string") {
				return [item];
			}

			if (typeof item !== "object" || item === null) {
				return [];
			}

			const fieldError = item as { field?: unknown; errors?: unknown };
			const field = typeof fieldError.field === "string" ? fieldError.field : "payload";
			const errors = Array.isArray(fieldError.errors)
				? fieldError.errors.filter(
						(errorItem): errorItem is string => typeof errorItem === "string"
					)
				: [];

			return errors.map((errorItem) => `${field}: ${errorItem}`);
		});

		return messages.length > 0 ? messages.join(". ") : null;
	}

	return null;
}

export function mapUpdateCampsiteError(error: unknown): UpdateCampsiteError {
	if (!(error instanceof HttpError)) {
		return {
			message: "Không thể cập nhật khu cắm trại. Vui lòng kiểm tra kết nối và thử lại.",
			canRetry: true,
		};
	}

	const backendMessage = extractBackendMessage(error);

	switch (error.status) {
		case 401:
			return {
				status: 401,
				message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
				canRetry: false,
			};

		case 403:
			return {
				status: 403,
				message: "Bạn không có quyền cập nhật khu cắm trại này.",
				canRetry: false,
			};

		case 404:
			return {
				status: 404,
				message: "Không tìm thấy khu cắm trại cần cập nhật.",
				canRetry: false,
			};

		case 409:
			return {
				status: 409,
				message:
					backendMessage ||
					"Khu cắm trại đã được thay đổi bởi phiên khác. Dữ liệu bạn nhập vẫn được giữ nguyên. Vui lòng tải lại hoặc thử gửi lại.",
				canRetry: true,
			};

		case 422:
			return {
				status: 422,
				message:
					backendMessage || "Dữ liệu khu cắm trại chưa hợp lệ. Vui lòng kiểm tra lại các trường.",
				canRetry: false,
			};

		default:
			return {
				status: error.status,
				message: backendMessage || "Không thể cập nhật khu cắm trại. Vui lòng thử lại.",
				canRetry: error.status >= 500,
			};
	}
}

export function useUpdateCampsite(campsiteId: string) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<UpdateCampsiteError | null>(null);
	const [updatedCampsite, setUpdatedCampsite] = useState<CreatedCampsite | null>(null);

	const submissionInFlightRef = useRef(false);
	const lastPayloadRef = useRef<UpdateCampsiteInput | null>(null);

	const execute = useCallback(
		async (payload: UpdateCampsiteInput): Promise<CreatedCampsite | null> => {
			if (submissionInFlightRef.current) {
				return null;
			}

			submissionInFlightRef.current = true;
			setIsSubmitting(true);
			setError(null);

			try {
				const updated = await campsitesService.update(campsiteId, payload);
				setUpdatedCampsite(updated);
				return updated;
			} catch (requestError) {
				setError(mapUpdateCampsiteError(requestError));
				return null;
			} finally {
				submissionInFlightRef.current = false;
				setIsSubmitting(false);
			}
		},
		[campsiteId]
	);

	const submit = useCallback(
		async (payload: UpdateCampsiteInput) => {
			lastPayloadRef.current = payload;
			return execute(payload);
		},
		[execute]
	);

	const retry = useCallback(async () => {
		if (!lastPayloadRef.current) {
			return null;
		}

		return execute(lastPayloadRef.current);
	}, [execute]);

	const reset = useCallback(() => {
		setUpdatedCampsite(null);
		setError(null);
		lastPayloadRef.current = null;
	}, []);

	return {
		isSubmitting,
		error,
		updatedCampsite,
		submit,
		retry,
		reset,
	};
}
