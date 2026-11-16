import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "../../../shared/components";
import { HOTSPOT_REVIEW_TOASTS } from "../constants";
import { safetyHotspotsService } from "../services/safety-hotspots.service";
import type { HotspotReview, HotspotReviewTarget, SafetyHotspot } from "../types";
import { hotspotErrorMessage } from "../utils/hotspot-errors";

/** Review decisions of one hotspot and moving it to the next review status. */
export function useHotspotReview(hotspotId: string, onReviewed: (next: SafetyHotspot) => void) {
	const [reviews, setReviews] = useState<HotspotReview[]>([]);
	const [submitting, setSubmitting] = useState(false);
	const sequence = useRef(0);

	const load = useCallback(async () => {
		const request = ++sequence.current;
		try {
			const next = await safetyHotspotsService.reviews(hotspotId);
			if (request === sequence.current) setReviews(next);
		} catch {
			// The corrective-action panel already shows load errors with a retry for this hotspot.
		}
	}, [hotspotId]);

	useEffect(() => {
		setReviews([]);
		void load();
		return () => {
			sequence.current += 1;
		};
	}, [load]);

	const review = async (status: HotspotReviewTarget, reason: string): Promise<boolean> => {
		if (submitting) return false;
		setSubmitting(true);
		try {
			const next = await safetyHotspotsService.review(hotspotId, status, reason);
			toast.success(HOTSPOT_REVIEW_TOASTS[status], "Điểm nóng an toàn");
			onReviewed(next);
			await load();
			return true;
		} catch (failure) {
			toast.error(hotspotErrorMessage(failure), "Điểm nóng an toàn");
			return false;
		} finally {
			setSubmitting(false);
		}
	};

	return { reviews, submitting, review };
}
