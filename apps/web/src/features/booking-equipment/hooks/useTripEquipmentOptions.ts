import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { bookingEquipmentService } from "../services/booking-equipment.service";
import type { TripEquipmentOption } from "../types";

function listErrorMessage(error: unknown): string {
	if (error instanceof HttpError) {
		if (error.status === 403) return "Bạn không có quyền xem thiết bị cho chuyến đi này.";
		if (error.status === 404) return "Không tìm thấy chuyến đi này.";
	}
	return "Không thể tải danh sách thiết bị. Vui lòng thử lại.";
}

export function useTripEquipmentOptions(tripId: string | undefined, enabled = true) {
	const [items, setItems] = useState<TripEquipmentOption[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const requestSequence = useRef(0);

	const load = useCallback(async () => {
		if (!tripId || !enabled) return;
		const sequence = ++requestSequence.current;

		setError("");
		setIsLoading(true);
		try {
			const options = await bookingEquipmentService.listForTrip(tripId);
			if (sequence === requestSequence.current) setItems(options);
		} catch (requestError) {
			if (sequence === requestSequence.current) setError(listErrorMessage(requestError));
		} finally {
			if (sequence === requestSequence.current) setIsLoading(false);
		}
	}, [tripId, enabled]);

	useEffect(() => {
		if (!enabled) {
			setItems([]);
			setIsLoading(false);
			setError("");
			return;
		}
		void load();
		return () => {
			requestSequence.current += 1;
		};
	}, [load, enabled]);

	return { items, isLoading, error, retry: load };
}
