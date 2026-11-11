import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { porterProfileService } from "../services/porter-profile.service";
import type { PorterRouteQualification, UpsertPorterRouteQualificationInput } from "../types";

function mapQualificationError(error: unknown): string {
	if (!(error instanceof HttpError)) {
		return "Không thể lưu chứng chỉ tuyến. Vui lòng thử lại sau.";
	}

	if (error.status === 401) {
		return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
	}
	if (error.status === 403) {
		return "Bạn không có quyền thực hiện thao tác này.";
	}
	if (error.status === 404) {
		return "Tuyến trekking không tồn tại hoặc đã bị đóng.";
	}
	if (error.status === 409) {
		return "Chứng chỉ tuyến đã bị thay đổi ở phiên khác. Dữ liệu mới nhất đã được tải lại.";
	}
	if (error.status === 422) {
		return "Thông tin chứng chỉ tuyến không hợp lệ. Vui lòng kiểm tra lại.";
	}
	return error.message || "Không thể lưu chứng chỉ tuyến.";
}

export function usePorterRouteQualifications() {
	const [qualifications, setQualifications] = useState<PorterRouteQualification[]>([]);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [pendingRouteId, setPendingRouteId] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [conflictMessage, setConflictMessage] = useState<string | null>(null);
	const requestSequence = useRef(0);

	const loadQualifications = useCallback(async () => {
		const sequence = ++requestSequence.current;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const data = await porterProfileService.getMyRouteQualifications();
			if (sequence === requestSequence.current) {
				setQualifications(data);
			}
		} catch (err) {
			if (sequence === requestSequence.current) {
				setErrorMessage(
					err instanceof Error
						? mapQualificationError(err)
						: "Không thể tải danh sách chứng chỉ tuyến."
				);
			}
		} finally {
			if (sequence === requestSequence.current) {
				setIsLoading(false);
			}
		}
	}, []);

	useEffect(() => {
		void loadQualifications();
		return () => {
			requestSequence.current += 1;
		};
	}, [loadQualifications]);

	const upsertQualification = async (
		routeId: string,
		input: UpsertPorterRouteQualificationInput
	): Promise<PorterRouteQualification | null> => {
		if (pendingRouteId) return null;

		setPendingRouteId(routeId);
		setErrorMessage(null);
		setSuccessMessage(null);
		setConflictMessage(null);

		try {
			const result = await porterProfileService.upsertRouteQualification(routeId, input);
			await loadQualifications();
			setSuccessMessage(
				input.expectedVersion
					? "Cập nhật chứng chỉ tuyến thành công!"
					: "Thêm chứng chỉ tuyến thành công!"
			);
			setTimeout(() => setSuccessMessage(null), 4000);
			return result;
		} catch (err) {
			if (err instanceof HttpError && err.status === 409) {
				setConflictMessage(
					"Chứng chỉ tuyến đã được chỉnh sửa ở phiên khác. Dữ liệu mới nhất đã được đồng bộ."
				);
				await loadQualifications();
				return null;
			}
			setErrorMessage(mapQualificationError(err));
			return null;
		} finally {
			setPendingRouteId(null);
		}
	};

	return {
		qualifications,
		isLoading,
		isSubmitting: pendingRouteId !== null,
		pendingRouteId,
		errorMessage,
		successMessage,
		conflictMessage,
		reload: loadQualifications,
		upsertQualification,
		clearMessages: () => {
			setErrorMessage(null);
			setSuccessMessage(null);
			setConflictMessage(null);
		},
	};
}
