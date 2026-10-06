import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { porterProfileService } from "../services/porter-profile.service";
import type { RoutePorterQualification } from "../types";

function mapVerifyError(error: unknown): string {
	if (!(error instanceof HttpError)) {
		return "Không thể xác minh chứng chỉ tuyến. Vui lòng thử lại sau.";
	}

	if (error.status === 401) {
		return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
	}
	if (error.status === 403) {
		return "Bạn không có quyền xác minh chứng chỉ cho tuyến này (hoặc không được tự xác minh cho chính mình).";
	}
	if (error.status === 404) {
		return "Không tìm thấy chứng chỉ hoặc tuyến trekking.";
	}
	if (error.status === 409) {
		return "Chứng chỉ đã được xác minh hoặc trạng thái đã thay đổi. Dữ liệu mới nhất đã được tải lại.";
	}
	if (error.status === 422) {
		return "Yêu cầu xác minh không hợp lệ.";
	}
	return error.message || "Không thể xác minh chứng chỉ tuyến.";
}

export function useRoutePorterQualifications(routeId: string) {
	const [qualifications, setQualifications] = useState<RoutePorterQualification[]>([]);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [verifyingId, setVerifyingId] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [conflictMessage, setConflictMessage] = useState<string | null>(null);
	const requestSequence = useRef(0);

	const loadQualifications = useCallback(async () => {
		if (!routeId) return;

		const sequence = ++requestSequence.current;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const data = await porterProfileService.getRoutePorterQualifications(routeId);
			if (sequence === requestSequence.current) {
				setQualifications(data);
			}
		} catch (err) {
			if (sequence === requestSequence.current) {
				setErrorMessage(
					err instanceof Error ? mapVerifyError(err) : "Không thể tải danh sách Porter của tuyến."
				);
			}
		} finally {
			if (sequence === requestSequence.current) {
				setIsLoading(false);
			}
		}
	}, [routeId]);

	useEffect(() => {
		void loadQualifications();
		return () => {
			requestSequence.current += 1;
		};
	}, [loadQualifications]);

	const verifyQualification = async (
		qualificationId: string,
		expectedVersion: number
	): Promise<boolean> => {
		if (verifyingId) return false;

		setVerifyingId(qualificationId);
		setErrorMessage(null);
		setSuccessMessage(null);
		setConflictMessage(null);

		try {
			await porterProfileService.verifyRouteQualification(qualificationId, {
				expectedVersion,
			});
			await loadQualifications();
			setSuccessMessage("Đã xác minh chứng chỉ Porter thành công!");
			setTimeout(() => setSuccessMessage(null), 4000);
			return true;
		} catch (err) {
			if (err instanceof HttpError && err.status === 409) {
				setConflictMessage(
					"Chứng chỉ đã được xác minh hoặc cập nhật trước đó. Danh sách đã được làm mới."
				);
				await loadQualifications();
				return false;
			}
			setErrorMessage(mapVerifyError(err));
			if (err instanceof HttpError && err.status === 404) {
				await loadQualifications();
			}
			return false;
		} finally {
			setVerifyingId(null);
		}
	};

	return {
		qualifications,
		isLoading,
		verifyingId,
		errorMessage,
		successMessage,
		conflictMessage,
		reload: loadQualifications,
		verifyQualification,
		clearMessages: () => {
			setErrorMessage(null);
			setSuccessMessage(null);
			setConflictMessage(null);
		},
	};
}
