import { useCallback, useEffect, useState } from "react";
import { campsitesService } from "../../campsites/services/campsites.service";
import type { CreatedCampsite } from "../../campsites/types";

export function useOwnedCampsites() {
	const [items, setItems] = useState<CreatedCampsite[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState("");

	const load = useCallback(async () => {
		setIsLoading(true);
		setError("");
		try {
			setItems(await campsitesService.getMine());
		} catch {
			setItems([]);
			setError("Không thể tải danh sách khu cắm trại của bạn.");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	return { items, isLoading, error, retry: load };
}
