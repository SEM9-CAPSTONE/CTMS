import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import {
	CREATE_TRIP_DEFAULT_VALUES,
	type CreateTripFormValues,
} from "../schema/create-trip.schema";
export interface DraftSnapshot {
	values: CreateTripFormValues;
	images: File[];
	tripId?: string;
}
export interface CachedTripDraft {
	id: string;
	owner: string;
	values: CreateTripFormValues;
	tripId?: string;
	revision: string;
	imageVersion: string;
	imageCount: number;
	updatedAt: string;
	dirty: boolean;
	serverSaved: boolean;
}
interface StoredImages {
	version: string;
	files: { name: string; type: string; lastModified: number; blob: Blob }[];
}
const PREFIX = "ctms:trip-draft:v2:";
const sessionKey = (owner: string) => `${PREFIX}active:${owner}`;
const key = (owner: string, id: string) => `${PREFIX}${owner}:${id}`;
export function draftOwner(): string {
	try {
		return getStoredAuthUser()?.id ?? "anonymous";
	} catch {
		return "anonymous";
	}
}
export function activeDraftId(owner: string): string | undefined {
	try {
		const id = sessionStorage.getItem(sessionKey(owner));
		const entry = window.history.state?.ctmsTripDraft as
			| { id?: string; owner?: string; path?: string }
			| undefined;
		return id &&
			entry?.id === id &&
			entry.owner === owner &&
			entry.path === window.location.pathname
			? id
			: undefined;
	} catch {
		return undefined;
	}
}
export function activateDraft(owner: string, id: string): void {
	try {
		sessionStorage.setItem(sessionKey(owner), id);
		const entry = window.history.state?.ctmsTripDraft as
			| { id?: string; owner?: string; path?: string }
			| undefined;
		if (entry?.id === id && entry.owner === owner && entry.path === window.location.pathname)
			return;
		window.history.replaceState(
			{ ...window.history.state, ctmsTripDraft: { id, owner, path: window.location.pathname } },
			"",
			window.location.href
		);
	} catch {}
}
export function endDraftSession(owner: string, id: string): void {
	try {
		if (sessionStorage.getItem(sessionKey(owner)) === id)
			sessionStorage.removeItem(sessionKey(owner));
	} catch {}
}
export function readDraftCache(owner: string, id: string): CachedTripDraft | null {
	try {
		const raw = localStorage.getItem(key(owner, id));
		if (!raw) return null;
		const value = JSON.parse(raw) as CachedTripDraft;
		return value.owner === owner &&
			value.id === id &&
			typeof value.revision === "string" &&
			typeof value.values === "object" &&
			value.values !== null
			? value
			: null;
	} catch {
		return null;
	}
}
export function writeDraftCache(value: CachedTripDraft): void {
	localStorage.setItem(key(value.owner, value.id), JSON.stringify(value));
}
export function listDraftCaches(owner: string): CachedTripDraft[] {
	const result: CachedTripDraft[] = [];
	try {
		for (let i = 0; i < localStorage.length; i++) {
			const name = localStorage.key(i);
			const prefix = `${PREFIX}${owner}:`;
			if (name?.startsWith(prefix)) {
				const value = readDraftCache(owner, name.slice(prefix.length));
				if (value) result.push(value);
			}
		}
	} catch {}
	return result;
}
function openImages(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (typeof indexedDB === "undefined") {
			reject(new Error("Draft image storage unavailable"));
			return;
		}
		const request = indexedDB.open("ctms-trip-draft-images", 1);
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains("images"))
				request.result.createObjectStore("images");
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error("Could not open draft image storage"));
	});
}
export async function cacheDraftImages(
	owner: string,
	id: string,
	version: string,
	images: File[]
): Promise<void> {
	const db = await openImages();
	try {
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction("images", "readwrite");
			tx.objectStore("images").put(
				{
					version,
					files: images.map((file) => ({
						name: file.name,
						type: file.type,
						lastModified: file.lastModified,
						blob: file,
					})),
				} satisfies StoredImages,
				key(owner, id)
			);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
			tx.onabort = () => reject(tx.error ?? new Error("Draft image save aborted"));
		});
	} finally {
		db.close();
	}
}
export async function restoreCachedDraft(meta: CachedTripDraft): Promise<DraftSnapshot> {
	if (!meta.imageCount) return { values: meta.values, images: [], tripId: meta.tripId };
	const db = await openImages();
	try {
		const stored = await new Promise<StoredImages | undefined>((resolve, reject) => {
			const request = db
				.transaction("images", "readonly")
				.objectStore("images")
				.get(key(meta.owner, meta.id));
			request.onsuccess = () => resolve(request.result as StoredImages | undefined);
			request.onerror = () => reject(request.error);
		});
		if (!stored || stored.version !== meta.imageVersion || stored.files.length !== meta.imageCount)
			throw new Error("Draft images have not finished saving");
		return {
			values: meta.values,
			tripId: meta.tripId,
			images: stored.files.map(
				(file) =>
					new File([file.blob], file.name, { type: file.type, lastModified: file.lastModified })
			),
		};
	} finally {
		db.close();
	}
}
export function markDraftSynced(meta: CachedTripDraft): void {
	const current = readDraftCache(meta.owner, meta.id);
	if (!current) return;
	writeDraftCache({ ...current, serverSaved: true, dirty: current.revision !== meta.revision });
}
export async function removeDraftCache(owner: string, id: string): Promise<void> {
	try {
		localStorage.removeItem(key(owner, id));
	} catch {
		/* Cleanup must not undo a saved Trip. */
	}
	try {
		const db = await openImages();
		try {
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction("images", "readwrite");
				tx.objectStore("images").delete(key(owner, id));
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
		} finally {
			db.close();
		}
	} catch {
		/* No metadata remains to advertise an obsolete cache. */
	}
}
export function hasDraftContent(snapshot: DraftSnapshot): boolean {
	if (snapshot.images.length) return true;
	const fields = [
		"routeId",
		"title",
		"description",
		"startsAt",
		"endsAt",
		"meetingLongitude",
		"meetingLatitude",
		"meetingAt",
		"bookingDeadline",
		"capacityMin",
		"capacityMax",
		"pricePerPerson",
	] as const;
	return fields.some(
		(field) =>
			typeof snapshot.values[field] === "string" &&
			snapshot.values[field] !== CREATE_TRIP_DEFAULT_VALUES[field]
	);
}
