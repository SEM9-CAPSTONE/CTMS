import type { LocalIncidentRecord } from "../types";

/** Device-side storage for incidents not yet confirmed by the server (BR-162). */
export interface IncidentQueueStore {
	list: (tripId: string, porterId: string) => Promise<LocalIncidentRecord[]>;
	listForPorter?: (porterId: string) => Promise<LocalIncidentRecord[]>;
	put: (record: LocalIncidentRecord) => Promise<void>;
	remove: (id: string) => Promise<void>;
}

const DB_NAME = "ctms-offline";
const DB_VERSION = 2;
const STORE_NAME = "trip-incidents";
const TRIP_PORTER_INDEX = "tripPorter";
const PORTER_INDEX = "porter";

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onabort = () =>
			reject(transaction.error ?? new Error("Không thể lưu sự cố trên thiết bị."));
		transaction.onerror = () => reject(transaction.error);
	});
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = factory.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const transaction = request.transaction;
			if (!transaction) {
				reject(new Error("Không thể nâng cấp bộ nhớ sự cố."));
				return;
			}
			const store = request.result.objectStoreNames.contains(STORE_NAME)
				? transaction.objectStore(STORE_NAME)
				: request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
			if (!store.indexNames.contains(TRIP_PORTER_INDEX))
				store.createIndex(TRIP_PORTER_INDEX, ["tripId", "porterId"]);
			if (!store.indexNames.contains(PORTER_INDEX)) store.createIndex(PORTER_INDEX, "porterId");
		};
		request.onsuccess = () => {
			request.result.onversionchange = () => request.result.close();
			resolve(request.result);
		};
		request.onerror = () => reject(request.error);
	});
}

/** IndexedDB keeps records (and photo blobs) across reloads and while the browser is offline. */
export function createIndexedDbIncidentQueueStore(factory: IDBFactory): IncidentQueueStore {
	let database: Promise<IDBDatabase> | null = null;
	const getStore = async (mode: IDBTransactionMode): Promise<IDBObjectStore> => {
		database ??= openDatabase(factory);
		return (await database).transaction(STORE_NAME, mode).objectStore(STORE_NAME);
	};

	return {
		listForPorter: async (porterId) => {
			const store = await getStore("readonly");
			return requestToPromise(
				store.index(PORTER_INDEX).getAll(porterId) as IDBRequest<LocalIncidentRecord[]>
			);
		},
		list: async (tripId, porterId) => {
			const store = await getStore("readonly");
			return requestToPromise(
				store.index(TRIP_PORTER_INDEX).getAll([tripId, porterId]) as IDBRequest<
					LocalIncidentRecord[]
				>
			);
		},
		put: async (record) => {
			const store = await getStore("readwrite");
			const done = transactionDone(store.transaction);
			store.put(record);
			await done;
		},
		remove: async (id) => {
			const store = await getStore("readwrite");
			const done = transactionDone(store.transaction);
			store.delete(id);
			await done;
		},
	};
}

/** Explicit non-persistent adapter for tests. Production saves require IndexedDB. */
export function createMemoryIncidentQueueStore(
	initial: LocalIncidentRecord[] = []
): IncidentQueueStore {
	const records = new Map(initial.map((record) => [record.id, record]));
	return {
		listForPorter: async (porterId) =>
			[...records.values()].filter((record) => record.porterId === porterId),
		list: async (tripId, porterId) =>
			[...records.values()].filter(
				(record) => record.tripId === tripId && record.porterId === porterId
			),
		put: async (record) => {
			records.set(record.id, record);
		},
		remove: async (id) => {
			records.delete(id);
		},
	};
}

let defaultStore: IncidentQueueStore | null = null;

export function getDefaultIncidentQueueStore(): IncidentQueueStore {
	if (!defaultStore) {
		if (typeof indexedDB === "undefined") {
			defaultStore = {
				list: async () => [],
				put: async () => {
					throw new Error(
						"Trình duyệt không hỗ trợ lưu sự cố bền vững. Vui lòng dùng trình duyệt hỗ trợ IndexedDB."
					);
				},
				remove: async () => {},
			};
		} else {
			defaultStore = createIndexedDbIncidentQueueStore(indexedDB);
		}
	}
	return defaultStore;
}
