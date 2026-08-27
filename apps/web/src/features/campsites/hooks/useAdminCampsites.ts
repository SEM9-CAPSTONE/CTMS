import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { campsitesService } from "../services/campsites.service";
import type { CreatedCampsite, ReviewCampsiteInput } from "../types";

export interface ReviewCampsiteError {
	status?: number;
	message: string;
	canRetry: boolean;
}

export function mapReviewCampsiteError(error: unknown): ReviewCampsiteError {
	if (!(error instanceof HttpError)) {
		return {
			message: "Đã xảy ra lỗi kết nối. Vui lòng thử lại sau.",
			canRetry: true,
		};
	}

	const responseData = error.errorData as Record<string, unknown> | null;
	const backendMessage = typeof responseData?.message === "string" ? responseData.message : null;

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
				message: "Bạn không có quyền thực hiện thao tác này. Yêu cầu quyền Admin.",
				canRetry: false,
			};
		case 404:
			return {
				status: 404,
				message: "Không tìm thấy khu cắm trại yêu cầu.",
				canRetry: false,
			};
		case 409:
			return {
				status: 409,
				message:
					backendMessage ||
					"Khu cắm trại đã thay đổi trạng thái (có thể đã được duyệt hoặc từ chối bởi admin khác). Vui lòng tải lại trang.",
				canRetry: true,
			};
		case 422:
			return {
				status: 422,
				message:
					backendMessage || "Dữ liệu không hợp lệ. Vui lòng điền đầy đủ các thông tin bắt buộc.",
				canRetry: false,
			};
		default:
			return {
				status: error.status,
				message: backendMessage || "Lỗi hệ thống. Vui lòng thử lại sau.",
				canRetry: error.status >= 500,
			};
	}
}

export function useAdminCampsites() {
	const [campsites, setCampsites] = useState<CreatedCampsite[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const data = await campsitesService.getPendingReview();
			setCampsites(data);
		} catch (err) {
			if (err instanceof HttpError) {
				setError(mapReviewCampsiteError(err).message);
			} else {
				setError("Không thể tải danh sách khu cắm trại.");
			}
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	return {
		campsites,
		isLoading,
		error,
		reload: load,
	};
}

export function useReviewCampsite() {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<ReviewCampsiteError | null>(null);
	const [success, setSuccess] = useState(false);

	const submissionInFlightRef = useRef(false);
	const lastPayloadRef = useRef<{ id: string; input: ReviewCampsiteInput } | null>(null);

	const execute = useCallback(
		async (id: string, input: ReviewCampsiteInput): Promise<CreatedCampsite | null> => {
			if (submissionInFlightRef.current) {
				return null;
			}

			submissionInFlightRef.current = true;
			setIsSubmitting(true);
			setError(null);
			setSuccess(false);

			try {
				const result = await campsitesService.review(id, input);
				setSuccess(true);
				return result;
			} catch (requestError) {
				setError(mapReviewCampsiteError(requestError));
				return null;
			} finally {
				submissionInFlightRef.current = false;
				setIsSubmitting(false);
			}
		},
		[]
	);

	const submit = useCallback(
		async (id: string, input: ReviewCampsiteInput) => {
			lastPayloadRef.current = { id, input };
			return execute(id, input);
		},
		[execute]
	);

	const retry = useCallback(async () => {
		if (!lastPayloadRef.current) {
			return null;
		}
		return execute(lastPayloadRef.current.id, lastPayloadRef.current.input);
	}, [execute]);

	const reset = useCallback(() => {
		setSuccess(false);
		setError(null);
		lastPayloadRef.current = null;
	}, []);

	return {
		isSubmitting,
		error,
		success,
		submit,
		retry,
		reset,
	};
}
