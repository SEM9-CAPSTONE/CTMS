import { useCallback, useEffect, useRef, useState } from "react";
import { safetyHotspotsService } from "../services/safety-hotspots.service";
import type { CorrectiveAction, HotspotEvidenceEvent } from "../types";
import { hotspotErrorMessage } from "../utils/hotspot-errors";

/** Deviation evidence of one hotspot and the corrective actions taken from it earlier. */
export function useHotspotEvidence(hotspotId: string) {
	const [evidence, setEvidence] = useState<HotspotEvidenceEvent[]>([]);
	const [history, setHistory] = useState<CorrectiveAction[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const sequence = useRef(0);

	const load = useCallback(async () => {
		const request = ++sequence.current;
		setLoading(true);
		setError(null);
		try {
			const [nextEvidence, nextHistory] = await Promise.all([
				safetyHotspotsService.evidence(hotspotId),
				safetyHotspotsService.actions(hotspotId),
			]);
			if (request !== sequence.current) return;
			setEvidence(nextEvidence);
			setHistory(nextHistory);
		} catch (failure) {
			if (request === sequence.current) setError(hotspotErrorMessage(failure));
		} finally {
			if (request === sequence.current) setLoading(false);
		}
	}, [hotspotId]);

	useEffect(() => {
		setEvidence([]);
		setHistory([]);
		void load();
		return () => {
			sequence.current += 1;
		};
	}, [load]);

	return { evidence, history, loading, error, reload: load };
}
