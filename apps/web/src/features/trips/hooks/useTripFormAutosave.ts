import { useCallback, useEffect, useRef, useState } from "react";
import { tripFormDraftsService } from "../services/trip-form-drafts.service";
import { type DraftSnapshot, hasDraftContent } from "../utils/trip-draft-cache";
import type { TripDraftSession } from "./useTripDraftSession";
interface Options {
	session: TripDraftSession;
	enabled: boolean;
	busy: boolean;
	linkedTripId?: string;
	read: () => DraftSnapshot | null;
	invalidate: () => unknown;
}
export function useTripFormAutosave(options: Options) {
	const current = useRef(options);
	current.current = options;
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState("");
	const [hasServerDraft, setHasServerDraft] = useState(options.session.initialServerSaved);
	const knownServer = useRef(options.session.initialServerSaved);
	const pending = useRef<Promise<boolean> | null>(null);
	const last = useRef<{ json: string; images: File[]; tripId?: string } | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const paused = useRef(false);
	const completed = useRef(false);
	const leaving = useRef(false);
	const flush = useCallback(async function persist(requireServer = false): Promise<boolean> {
		if (completed.current || leaving.current) return true;
		while (pending.current) await pending.current;
		const o = current.current;
		if (!o.enabled || o.busy || paused.current) return false;
		const snapshot = o.read();
		if (!snapshot) return true;
		const value = { ...snapshot, tripId: o.linkedTripId ?? snapshot.tripId };
		if (!knownServer.current && !hasDraftContent(value)) return true;
		const json = JSON.stringify(value.values);
		if (
			last.current?.json === json &&
			last.current.images === value.images &&
			last.current.tripId === value.tripId
		)
			return true;
		let localMeta: ReturnType<TripDraftSession["remember"]> = null;
		try {
			localMeta = o.session.remember(value);
		} catch {
			/* Still attempt authoritative persistence if local storage is unavailable. */
		}
		setSaving(true);
		setError("");
		const preserveImages = knownServer.current && last.current?.images === value.images;
		const task: Promise<boolean> = (async () => {
			try {
				if (localMeta) await o.session.durable(localMeta);
				await tripFormDraftsService.save(
					o.session.id,
					value.values,
					preserveImages ? [] : value.images,
					value.tripId,
					preserveImages
				);
				last.current = { json, images: value.images, tripId: value.tripId };
				knownServer.current = true;
				setHasServerDraft(true);
				if (localMeta) {
					try {
						o.session.synced(localMeta);
					} catch {
						/* The server has already committed this revision. */
					}
				}
				setSaved(true);
				void o.invalidate();
				return true;
			} catch {
				const durable = Boolean(localMeta) && (await o.session.durable(localMeta ?? undefined));
				setSaved(false);
				setError(
					durable
						? "Đã lưu trên thiết bị. Bản nháp sẽ tự đồng bộ khi có kết nối."
						: "Chưa lưu được bản nháp. Vui lòng giữ trang này và kiểm tra kết nối."
				);
				return !requireServer && durable;
			} finally {
				setSaving(false);
			}
		})().finally(() => {
			if (pending.current === task) pending.current = null;
		});
		pending.current = task;
		const result = await task;
		const latest = current.current.read();
		if (
			latest &&
			(JSON.stringify(latest.values) !== json ||
				latest.images !== value.images ||
				(current.current.linkedTripId ?? latest.tripId) !== value.tripId)
		)
			return persist(requireServer);
		return result;
	}, []);
	const schedule = useCallback(
		(snapshot: DraftSnapshot) => {
			const o = current.current;
			if (!o.enabled || paused.current || completed.current || leaving.current) return;
			try {
				o.session.remember({ ...snapshot, tripId: o.linkedTripId ?? snapshot.tripId });
			} catch {
				setError("Chưa lưu được bản sao trên thiết bị. Đang thử đồng bộ bản nháp.");
			}
			setSaved(false);
			if (timer.current) clearTimeout(timer.current);
			if (!knownServer.current && !pending.current && hasDraftContent(snapshot)) {
				void flush();
				return;
			}
			timer.current = setTimeout(() => {
				if (!pending.current) void flush();
			}, 600);
		},
		[flush]
	);
	useEffect(() => {
		const persist = () => {
			const o = current.current;
			const snapshot = o.read();
			if (snapshot && o.enabled && !completed.current) {
				try {
					o.session.remember({ ...snapshot, tripId: o.linkedTripId ?? snapshot.tripId });
				} catch {}
				void flush();
			}
		};
		const hidden = () => {
			if (document.visibilityState === "hidden") persist();
		};
		window.addEventListener("pagehide", persist);
		window.addEventListener("beforeunload", persist);
		window.addEventListener("online", persist);
		document.addEventListener("visibilitychange", hidden);
		return () => {
			if (timer.current) clearTimeout(timer.current);
			window.removeEventListener("pagehide", persist);
			window.removeEventListener("beforeunload", persist);
			window.removeEventListener("online", persist);
			document.removeEventListener("visibilitychange", hidden);
		};
	}, [flush]);
	const pause = useCallback(() => {
		paused.current = true;
		if (timer.current) clearTimeout(timer.current);
	}, []);
	const resume = useCallback(() => {
		paused.current = false;
		const snapshot = current.current.read();
		if (snapshot) schedule(snapshot);
	}, [schedule]);
	const finish = useCallback(async () => {
		completed.current = true;
		if (timer.current) clearTimeout(timer.current);
		await current.current.session.discard();
	}, []);
	const leave = useCallback(async () => {
		if (leaving.current) return true;
		if (!(await flush())) return false;
		leaving.current = true;
		if (timer.current) clearTimeout(timer.current);
		await current.current.session.end();
		return true;
	}, [flush]);
	return { saving, saved, error, hasServerDraft, schedule, flush, pause, resume, finish, leave };
}
