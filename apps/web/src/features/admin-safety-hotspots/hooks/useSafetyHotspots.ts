import { useCallback, useEffect, useRef, useState } from "react";
import { safetyHotspotsService } from "../services/safety-hotspots.service";
import type { HotspotStatus, SafetyHotspot } from "../types";
import { hotspotErrorMessage } from "../utils/hotspot-errors";

export function useSafetyHotspots(status: HotspotStatus) {
	const [items, setItems] = useState<SafetyHotspot[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const sequence = useRef(0);

	const reload = useCallback(async () => {
		const request = ++sequence.current;
		setLoading(true);
		setError(null);
		try {
			const next = await safetyHotspotsService.list(status);
			if (request === sequence.current) setItems(next);
		} catch (failure) {
			if (request === sequence.current) {
				setItems([]);
				setError(hotspotErrorMessage(failure));
			}
		} finally {
			if (request === sequence.current) setLoading(false);
		}
	}, [status]);

	useEffect(() => {
		void reload();
		return () => {
			sequence.current += 1;
		};
	}, [reload]);

	return { items, loading, error, reload };
}
