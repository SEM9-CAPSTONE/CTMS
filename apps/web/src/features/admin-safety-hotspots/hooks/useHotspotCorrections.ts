import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "../../../shared/components";
import { safetyHotspotsService } from "../services/safety-hotspots.service";
import type {
	CorrectiveAction,
	CorrectiveTargets,
	CreateCorrectiveActionPayload,
	HotspotEvidenceEvent,
	SafetyHotspot,
} from "../types";
import { hotspotErrorMessage } from "../utils/hotspot-errors";

/** Deviation evidence, history and selectable targets of one hotspot, plus submitting a corrective action. */
export function useHotspotCorrections(hotspot: SafetyHotspot | null, onChanged: () => void) {
	const [evidence, setEvidence] = useState<HotspotEvidenceEvent[]>([]);
	const [history, setHistory] = useState<CorrectiveAction[]>([]);
	const [targets, setTargets] = useState<CorrectiveTargets | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const sequence = useRef(0);
	const hotspotId = hotspot?.id ?? null;
	const confirmed = hotspot?.status === "CONFIRMED";

	const load = useCallback(async () => {
		if (!hotspotId) return;
		const request = ++sequence.current;
		setLoading(true);
		setError(null);
		try {
			const [nextEvidence, nextHistory, nextTargets] = await Promise.all([
				safetyHotspotsService.evidence(hotspotId),
				safetyHotspotsService.actions(hotspotId),
				confirmed ? safetyHotspotsService.targets(hotspotId) : Promise.resolve(null),
			]);
			if (request !== sequence.current) return;
			setEvidence(nextEvidence);
			setHistory(nextHistory);
			setTargets(nextTargets);
		} catch (failure) {
			if (request === sequence.current) setError(hotspotErrorMessage(failure));
		} finally {
			if (request === sequence.current) setLoading(false);
		}
	}, [hotspotId, confirmed]);

	useEffect(() => {
		setEvidence([]);
		setHistory([]);
		setTargets(null);
		void load();
		return () => {
			sequence.current += 1;
		};
	}, [load]);

	const submit = async (payload: CreateCorrectiveActionPayload): Promise<boolean> => {
		if (!hotspotId || submitting) return false;
		setSubmitting(true);
		try {
			const saved = await safetyHotspotsService.createAction(hotspotId, payload);
			const packageNote =
				saved.packageImpact === "AFFECTED" && saved.impactTripCount > 0
					? ` Gói an toàn ngoại tuyến của ${saved.impactTripCount} chuyến sắp khởi hành sẽ được tạo phiên bản mới.`
					: "";
			toast.success(`Đã cập nhật dữ liệu an toàn.${packageNote}`, "Điểm nóng an toàn");
			await load();
			onChanged();
			return true;
		} catch (failure) {
			toast.error(hotspotErrorMessage(failure), "Điểm nóng an toàn");
			return false;
		} finally {
			setSubmitting(false);
		}
	};

	return { evidence, history, targets, loading, error, submitting, reload: load, submit };
}
