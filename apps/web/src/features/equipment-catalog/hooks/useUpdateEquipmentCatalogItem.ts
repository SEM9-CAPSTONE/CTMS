import { useCallback, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { equipmentCatalogService } from "../services/equipment-catalog.service";
import type { EquipmentCatalogItem, UpdateEquipmentCatalogItemInput } from "../types";

export interface UpdateEquipmentCatalogItemError {
	status?: number;
	message: string;
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

export function mapUpdateEquipmentCatalogItemError(
	error: unknown
): UpdateEquipmentCatalogItemError {
	if (!(error instanceof HttpError)) {
		return {
			message: "Không thể cập nhật thiết bị. Vui lòng kiểm tra kết nối và thử lại.",
			fieldErrors: {},
		};
	}

	const byStatus: Record<number, string> = {
		401: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
		403: "Bạn không có quyền sửa thiết bị này.",
		404: "Không tìm thấy thiết bị này.",
		422: "Thông tin thiết bị chưa hợp lệ. Vui lòng kiểm tra các trường được đánh dấu.",
	};

	return {
		status: error.status,
		message: byStatus[error.status] || "Không thể cập nhật thiết bị. Vui lòng thử lại.",
		fieldErrors: extractFieldErrors(error.errorData),
	};
}

export function useUpdateEquipmentCatalogItem() {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<UpdateEquipmentCatalogItemError | null>(null);
	const inFlight = useRef(false);

	const submit = useCallback(async (itemId: string, payload: UpdateEquipmentCatalogItemInput) => {
		if (inFlight.current) return null;
		inFlight.current = true;
		setIsSubmitting(true);
		setError(null);
		try {
			const updated: EquipmentCatalogItem = await equipmentCatalogService.update(itemId, payload);
			return updated;
		} catch (requestError) {
			setError(mapUpdateEquipmentCatalogItemError(requestError));
			return null;
		} finally {
			inFlight.current = false;
			setIsSubmitting(false);
		}
	}, []);

	const reset = useCallback(() => setError(null), []);

	return { isSubmitting, error, submit, reset };
}
