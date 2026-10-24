import type { LocalGpsLogRecord } from "../types";

export interface GpsQueueStore {
	list: (tripId: string, userId: string) => Promise<LocalGpsLogRecord[]>;
	put: (record: LocalGpsLogRecord) => Promise<void>;
	remove: (id: string) => Promise<void>;
	clearForTrip: (tripId: string) => Promise<void>;
}

const DB_NAME = "ctms-offline";
const DB_VERSION = 3;
const STORE_NAME = "gps-logs";
const TRIP_USER_INDEX = "tripUser";

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
			reject(transaction.error ?? new Error("Không thể lưu bản ghi GPS trên thiết bị."));
		transaction.onerror = () => reject(transaction.error);
	});
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = factory.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const transaction = request.transaction;
			if (!transaction) {
				reject(new Error("Không thể nâng cấp bộ nhớ GPS."));
				return;
			}
			const store = request.result.objectStoreNames.contains(STORE_NAME)
				? transaction.objectStore(STORE_NAME)
				: request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
			if (!store.indexNames.contains(TRIP_USER_INDEX)) {
				store.createIndex(TRIP_USER_INDEX, ["tripId", "userId"]);
			}
		};
		request.onsuccess = () => {
			request.result.onversionchange = () => request.result.close();
			resolve(request.result);
		};
		request.onerror = () => reject(request.error);
	});
}

export function createIndexedDbGpsQueueStore(factory: IDBFactory): GpsQueueStore {
	let database: Promise<IDBDatabase> | null = null;
	const getStore = async (mode: IDBTransactionMode): Promise<IDBObjectStore> => {
		database ??= openDatabase(factory);
		const db = await database;
		const transaction = db.transaction(STORE_NAME, mode);
		return transaction.objectStore(STORE_NAME);
	};

	return {
		list: async (tripId: string, userId: string) => {
			const store = await getStore("readonly");
			const index = store.index(TRIP_USER_INDEX);
			const raw = (await requestToPromise(index.getAll([tripId, userId]))) as LocalGpsLogRecord[];
			return raw.sort((a, b) => Date.parse(a.eventTime) - Date.parse(b.eventTime));
		},
		put: async (record: LocalGpsLogRecord) => {
			const store = await getStore("readwrite");
			store.put(record);
			await transactionDone(store.transaction);
		},
		remove: async (id: string) => {
			const store = await getStore("readwrite");
			store.delete(id);
			await transactionDone(store.transaction);
		},
		clearForTrip: async (tripId: string) => {
			const store = await getStore("readwrite");
			const index = store.index(TRIP_USER_INDEX);
			const keys = (await requestToPromise(
				index.getAllKeys(IDBKeyRange.bound([tripId, ""], [tripId, "\uffff"]))
			)) as IDBValidKey[];
			for (const key of keys) {
				store.delete(key);
			}
			await transactionDone(store.transaction);
		},
	};
}

export function createMemoryGpsQueueStore(initial: LocalGpsLogRecord[] = []): GpsQueueStore {
	const records = new Map<string, LocalGpsLogRecord>();
	for (const item of initial) {
		records.set(item.id, item);
	}

	return {
		list: async (tripId: string, userId: string) =>
			[...records.values()]
				.filter((r) => r.tripId === tripId && r.userId === userId)
				.sort((a, b) => Date.parse(a.eventTime) - Date.parse(b.eventTime)),
		put: async (record: LocalGpsLogRecord) => {
			records.set(record.id, record);
		},
		remove: async (id: string) => {
			records.delete(id);
		},
		clearForTrip: async (tripId: string) => {
			for (const [id, r] of records.entries()) {
				if (r.tripId === tripId) {
					records.delete(id);
				}
			}
		},
	};
}
