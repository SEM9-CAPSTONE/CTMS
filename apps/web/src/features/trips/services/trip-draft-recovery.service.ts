import {
	draftOwner,
	listDraftCaches,
	markDraftSynced,
	restoreCachedDraft,
} from "../utils/trip-draft-cache";
import { type TripFormDraftSummary, tripFormDraftsService } from "./trip-form-drafts.service";
const pending = new Map<string, Promise<TripFormDraftSummary[]>>();
export function listRecoverableTripDrafts(): Promise<TripFormDraftSummary[]> {
	const owner = draftOwner();
	const running = pending.get(owner);
	if (running) return running;
	const task = (async () => {
		for (const meta of listDraftCaches(owner).filter((draft) => draft.dirty)) {
			try {
				const value = await restoreCachedDraft(meta);
				await tripFormDraftsService.save(meta.id, value.values, value.images, value.tripId);
				markDraftSynced(meta);
			} catch {
				/* Keep the local draft visible until synchronization succeeds. */
			}
		}
		const local = listDraftCaches(owner);
		let remote: TripFormDraftSummary[];
		try {
			remote = await tripFormDraftsService.list();
		} catch (error) {
			if (!local.length) throw error;
			remote = [];
		}
		const merged = new Map(remote.map((draft) => [draft.id, draft]));
		for (const meta of local) {
			if (meta.dirty || !merged.has(meta.id))
				merged.set(meta.id, {
					id: meta.id,
					title: meta.values.title,
					startsAt: meta.values.startsAt,
					endsAt: meta.values.endsAt,
					capacityMax: meta.values.capacityMax,
					pricePerPerson: meta.values.pricePerPerson,
					updatedAt: meta.updatedAt,
					imageCount: meta.imageCount,
					tripId: meta.tripId,
					syncPending: meta.dirty || !meta.serverSaved,
				});
		}
		return [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	})().finally(() => pending.delete(owner));
	pending.set(owner, task);
	return task;
}
