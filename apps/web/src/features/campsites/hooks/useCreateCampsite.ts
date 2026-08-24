import { useCallback, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { campsitesService } from "../services/campsites.service";
import type { CreateCampsiteInput, CreatedCampsite } from "../types";

export interface CreateCampsiteError {
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
		return message.filter((item): item is string => typeof item === "string").join(". ");
	}

	return null;
}

export function mapCreateCampsiteError(error: unknown): CreateCampsiteError {
	if (!(error instanceof HttpError)) {
		return {
			message: "Không thể tạo campsite. Vui lòng kiểm tra kết nối và thử lại.",
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
				message: "Bạn không có quyền tạo campsite. Chức năng này chỉ dành cho Host.",
				canRetry: false,
			};

		case 409:
			return {
				status: 409,
				message:
					backendMessage ||
					"Yêu cầu bị xung đột. Dữ liệu bạn đã nhập vẫn được giữ nguyên. Vui lòng thử lại.",
				canRetry: true,
			};

		case 422:
			return {
				status: 422,
				message:
					backendMessage || "Dữ liệu campsite chưa hợp lệ. Vui lòng kiểm tra lại các trường.",
				canRetry: false,
			};

		default:
			return {
				status: error.status,
				message: backendMessage || "Không thể tạo campsite. Vui lòng thử lại.",
				canRetry: error.status >= 500,
			};
	}
}

export function useCreateCampsite() {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<CreateCampsiteError | null>(null);
	const [createdCampsite, setCreatedCampsite] = useState<CreatedCampsite | null>(null);

	const submissionInFlightRef = useRef(false);
	const lastPayloadRef = useRef<CreateCampsiteInput | null>(null);

	const execute = useCallback(
		async (payload: CreateCampsiteInput): Promise<CreatedCampsite | null> => {
			if (submissionInFlightRef.current) {
				return null;
			}

			submissionInFlightRef.current = true;
			setIsSubmitting(true);
			setError(null);

			try {
				const created = await campsitesService.create(payload);
				setCreatedCampsite(created);
				return created;
			} catch (requestError) {
				setError(mapCreateCampsiteError(requestError));
				return null;
			} finally {
				submissionInFlightRef.current = false;
				setIsSubmitting(false);
			}
		},
		[]
	);

	const submit = useCallback(
		async (payload: CreateCampsiteInput) => {
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
		setCreatedCampsite(null);
		setError(null);
		lastPayloadRef.current = null;
	}, []);

	return {
		isSubmitting,
		error,
		createdCampsite,
		submit,
		retry,
		reset,
	};
}
