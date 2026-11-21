import { useState } from "react";
import { toast } from "../../../shared/components";
import { safetyHotspotsService } from "../services/safety-hotspots.service";
import type { SafetyHotspot, UpdateHotspotPayload } from "../types";
import { hotspotErrorMessage } from "../utils/hotspot-errors";

const TOAST_TITLE = "Điểm nóng an toàn";

/** Saves an Admin's edits to a hotspot, or deletes it permanently. */
export function useHotspotDetails(
	hotspotId: string,
	onSaved: (next: SafetyHotspot) => void,
	onDeleted: () => void
) {
	const [submitting, setSubmitting] = useState(false);

	const run = async (work: () => Promise<void>): Promise<boolean> => {
		if (submitting) return false;
		setSubmitting(true);
		try {
			await work();
			return true;
		} catch (failure) {
			toast.error(hotspotErrorMessage(failure), TOAST_TITLE);
			return false;
		} finally {
			setSubmitting(false);
		}
	};

	return {
		submitting,
		save: (payload: UpdateHotspotPayload) =>
			run(async () => {
				const next = await safetyHotspotsService.update(hotspotId, payload);
				toast.success("Đã lưu thông tin điểm nóng.", TOAST_TITLE);
				onSaved(next);
			}),
		remove: () =>
			run(async () => {
				await safetyHotspotsService.remove(hotspotId);
				toast.success("Đã xóa điểm nóng.", TOAST_TITLE);
				onDeleted();
			}),
	};
}
