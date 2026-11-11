import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { bookingEquipmentService } from "../services/booking-equipment.service";
import type { BookingItem } from "../types";

function listErrorMessage(error: unknown): string {
	if (error instanceof HttpError) {
		if (error.status === 403) return "Bạn không có quyền xem các thiết bị đã thêm.";
		if (error.status === 404) return "Không tìm thấy booking này.";
	}
	return "Không thể tải danh sách thiết bị đã thêm. Vui lòng thử lại.";
}

export function useBookingItems(bookingId: string | undefined) {
	const [items, setItems] = useState<BookingItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const requestSequence = useRef(0);

	const load = useCallback(async () => {
		if (!bookingId) return;
		const sequence = ++requestSequence.current;

		setError("");
		setIsLoading(true);
		try {
			const fetched = await bookingEquipmentService.listItems(bookingId);
			if (sequence === requestSequence.current) setItems(fetched);
		} catch (requestError) {
			if (sequence === requestSequence.current) setError(listErrorMessage(requestError));
		} finally {
			if (sequence === requestSequence.current) setIsLoading(false);
		}
	}, [bookingId]);

	useEffect(() => {
		void load();
		return () => {
			requestSequence.current += 1;
		};
	}, [load]);

	return { items, isLoading, error, retry: load };
}
