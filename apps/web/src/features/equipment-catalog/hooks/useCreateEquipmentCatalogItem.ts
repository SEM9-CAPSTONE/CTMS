import { useCallback, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { equipmentCatalogService } from "../services/equipment-catalog.service";
import type { CreateEquipmentCatalogItemInput, EquipmentCatalogItem } from "../types";

export interface CreateEquipmentCatalogItemError {
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

export function mapCreateEquipmentCatalogItemError(
	error: unknown
): CreateEquipmentCatalogItemError {
	if (!(error instanceof HttpError)) {
		return {
			message: "Không thể tạo thiết bị. Vui lòng kiểm tra kết nối và thử lại.",
			canRetry: true,
			fieldErrors: {},
		};
	}

	const byStatus: Record<number, string> = {
		401: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
		403: "Bạn không có quyền tạo thiết bị trong kho.",
		422: "Thông tin thiết bị chưa hợp lệ. Vui lòng kiểm tra các trường được đánh dấu.",
	};

	return {
		status: error.status,
		message: byStatus[error.status] || "Không thể tạo thiết bị. Vui lòng thử lại.",
		canRetry: error.status >= 500,
		fieldErrors: extractFieldErrors(error.errorData),
	};
}

export function useCreateEquipmentCatalogItem() {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<CreateEquipmentCatalogItemError | null>(null);
	const [createdItem, setCreatedItem] = useState<EquipmentCatalogItem | null>(null);
	const inFlight = useRef(false);
	const lastPayload = useRef<CreateEquipmentCatalogItemInput | null>(null);

	const execute = useCallback(async (payload: CreateEquipmentCatalogItemInput) => {
		if (inFlight.current) return null;
		inFlight.current = true;
		setIsSubmitting(true);
		setError(null);
		try {
			const created = await equipmentCatalogService.create(payload);
			setCreatedItem(created);
			return created;
		} catch (requestError) {
			setError(mapCreateEquipmentCatalogItemError(requestError));
			return null;
		} finally {
			inFlight.current = false;
			setIsSubmitting(false);
		}
	}, []);

	const submit = useCallback(
		(payload: CreateEquipmentCatalogItemInput) => {
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
		setCreatedItem(null);
		setError(null);
		lastPayload.current = null;
	}, []);

	return { isSubmitting, error, createdItem, submit, retry, reset };
}
