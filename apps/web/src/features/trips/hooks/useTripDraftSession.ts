import { useCallback, useEffect, useRef, useState } from "react";
import {
	type CachedTripDraft,
	type DraftSnapshot,
	activateDraft,
	activeDraftId,
	cacheDraftImages,
	draftOwner,
	endDraftSession,
	hasDraftContent,
	markDraftSynced,
	readDraftCache,
	removeDraftCache,
	restoreCachedDraft,
	writeDraftCache,
} from "../utils/trip-draft-cache";
export function useTripDraftSession(explicitId?: string, enabled = true) {
	const [initial] = useState(() => {
		const owner = draftOwner();
		const active = enabled ? activeDraftId(owner) : undefined;
		const id = explicitId ?? active ?? crypto.randomUUID();
		const cached = enabled ? readDraftCache(owner, id) : null;
		return {
			owner,
			id,
			hadActive: Boolean(active),
			cached: explicitId && !cached?.dirty ? null : cached,
		};
	});
	const [ready, setReady] = useState(!initial.cached);
	const [restored, setRestored] = useState<DraftSnapshot | null>(null);
	const [restoreError, setRestoreError] = useState(false);
	const last = useRef<{ json: string; images: File[]; meta: CachedTripDraft } | null>(null);
	const imageWrite = useRef<Promise<void>>(Promise.resolve());
	const imageFailure = useRef(false);
	useEffect(() => {
		if (!initial.cached) return;
		let cancelled = false;
		void restoreCachedDraft(initial.cached)
			.then((snapshot) => {
				if (cancelled) return;
				activateDraft(initial.owner, initial.id);
				last.current = {
					json: JSON.stringify(snapshot.values),
					images: snapshot.images,
					meta: initial.cached as CachedTripDraft,
				};
				setRestored(snapshot);
				setReady(true);
			})
			.catch(() => {
				if (!cancelled) {
					setRestoreError(true);
					setReady(true);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [initial]);
	const remember = useCallback(
		(snapshot: DraftSnapshot): CachedTripDraft | null => {
			if (!enabled || (!last.current && !explicitId && !hasDraftContent(snapshot))) return null;
			const json = JSON.stringify(snapshot.values);
			activateDraft(initial.owner, initial.id);
			if (
				last.current?.json === json &&
				last.current.images === snapshot.images &&
				last.current.meta.tripId === snapshot.tripId
			)
				return last.current.meta;
			const imagesChanged = !last.current || last.current.images !== snapshot.images;
			const meta: CachedTripDraft = {
				id: initial.id,
				owner: initial.owner,
				values: structuredClone(snapshot.values),
				tripId: snapshot.tripId,
				revision: crypto.randomUUID(),
				imageVersion: imagesChanged ? crypto.randomUUID() : (last.current?.meta.imageVersion ?? ""),
				imageCount: snapshot.images.length,
				updatedAt: new Date().toISOString(),
				dirty: true,
				serverSaved: last.current?.meta.serverSaved ?? initial.cached?.serverSaved ?? false,
			};
			writeDraftCache(meta);
			last.current = { json, images: snapshot.images, meta };
			if (imagesChanged && snapshot.images.length) {
				imageFailure.current = false;
				imageWrite.current = imageWrite.current
					.catch(() => undefined)
					.then(() =>
						cacheDraftImages(initial.owner, initial.id, meta.imageVersion, snapshot.images)
					);
				void imageWrite.current.catch(() => {
					imageFailure.current = true;
				});
			} else if (imagesChanged) imageFailure.current = false;
			return meta;
		},
		[enabled, explicitId, initial]
	);
	const durable = useCallback(
		async (meta?: CachedTripDraft) => {
			try {
				if ((meta?.imageCount ?? last.current?.meta.imageCount ?? 0) > 0) await imageWrite.current;
				const stored = readDraftCache(initial.owner, initial.id);
				return (
					((meta?.imageCount ?? last.current?.meta.imageCount ?? 0) === 0 ||
						!imageFailure.current) &&
					Boolean(stored) &&
					(!meta || stored?.revision === meta.revision)
				);
			} catch {
				return false;
			}
		},
		[initial]
	);
	const synced = useCallback((meta: CachedTripDraft) => {
		markDraftSynced(meta);
		if (last.current)
			last.current.meta = {
				...last.current.meta,
				dirty: last.current.meta.revision !== meta.revision,
				serverSaved: true,
			};
	}, []);
	const end = useCallback(async () => {
		endDraftSession(initial.owner, initial.id);
		await imageWrite.current.catch(() => undefined);
		const meta = readDraftCache(initial.owner, initial.id);
		if (meta && !meta.dirty) await removeDraftCache(initial.owner, initial.id);
	}, [initial]);
	const discard = useCallback(async () => {
		endDraftSession(initial.owner, initial.id);
		await imageWrite.current.catch(() => undefined);
		await removeDraftCache(initial.owner, initial.id);
	}, [initial]);
	return {
		id: initial.id,
		owner: initial.owner,
		ready,
		restored,
		restoreError,
		hasLocalRecovery: Boolean(initial.cached) && !restoreError,
		remoteId:
			(explicitId ?? (initial.hadActive ? initial.id : undefined)) &&
			(!initial.cached || restoreError)
				? (explicitId ?? initial.id)
				: restoreError && initial.cached?.serverSaved
					? initial.id
					: undefined,
		initialServerSaved: Boolean(initial.cached?.serverSaved || explicitId),
		remember,
		durable,
		synced,
		end,
		discard,
	};
}
export type TripDraftSession = ReturnType<typeof useTripDraftSession>;
