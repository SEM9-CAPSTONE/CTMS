import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { equipmentCatalogService } from "../services/equipment-catalog.service";
import type { EquipmentCatalogItem } from "../types";

function listErrorMessage(error: unknown): string {
	if (error instanceof HttpError) {
		if (error.status === 403) return "Bạn không có quyền xem kho thiết bị.";
	}
	return "Không thể tải kho thiết bị. Vui lòng thử lại.";
}

export function useEquipmentCatalog() {
	const [items, setItems] = useState<EquipmentCatalogItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const requestSequence = useRef(0);

	const load = useCallback(async () => {
		const sequence = ++requestSequence.current;

		setError("");
		setIsLoading(true);
		try {
			const mine = await equipmentCatalogService.listMine();
			if (sequence === requestSequence.current) setItems(mine);
		} catch (requestError) {
			if (sequence === requestSequence.current) setError(listErrorMessage(requestError));
		} finally {
			if (sequence === requestSequence.current) setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
		return () => {
			requestSequence.current += 1;
		};
	}, [load]);

	return { items, isLoading, error, retry: load };
}
