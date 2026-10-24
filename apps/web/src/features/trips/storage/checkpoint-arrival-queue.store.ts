import type { LocalCheckpointArrivalRecord } from "../types";

export interface CheckpointArrivalQueueStore {
	list: (tripId: string, porterId: string) => Promise<LocalCheckpointArrivalRecord[]>;
	put: (record: LocalCheckpointArrivalRecord) => Promise<void>;
	remove: (id: string) => Promise<void>;
	clearForTrip: (tripId: string) => Promise<void>;
}

const DB_NAME = "ctms-offline";
const DB_VERSION = 4;
const STORE_NAME = "checkpoint-arrivals";
const TRIP_PORTER_INDEX = "tripPorter";

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
			reject(transaction.error ?? new Error("Không thể lưu điểm danh ngoại tuyến."));
		transaction.onerror = () => reject(transaction.error);
	});
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = factory.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			const transaction = request.transaction;
			if (!transaction) {
				reject(new Error("Không thể nâng cấp bộ nhớ ngoại tuyến."));
				return;
			}
			const store = db.objectStoreNames.contains(STORE_NAME)
				? transaction.objectStore(STORE_NAME)
				: db.createObjectStore(STORE_NAME, { keyPath: "id" });
			if (!store.indexNames.contains(TRIP_PORTER_INDEX)) {
				store.createIndex(TRIP_PORTER_INDEX, ["tripId", "porterId"]);
			}
		};
		request.onsuccess = () => {
			request.result.onversionchange = () => request.result.close();
			resolve(request.result);
		};
		request.onerror = () => reject(request.error);
	});
}

export function createIndexedDbCheckpointArrivalQueueStore(
	factory: IDBFactory
): CheckpointArrivalQueueStore {
	let database: Promise<IDBDatabase> | null = null;
	const getStore = async (mode: IDBTransactionMode): Promise<IDBObjectStore> => {
		database ??= openDatabase(factory);
		const db = await database;
		const transaction = db.transaction(STORE_NAME, mode);
		return transaction.objectStore(STORE_NAME);
	};

	return {
		list: async (tripId: string, porterId: string) => {
			const store = await getStore("readonly");
			const index = store.index(TRIP_PORTER_INDEX);
			const raw = (await requestToPromise(
				index.getAll([tripId, porterId])
			)) as LocalCheckpointArrivalRecord[];
			return raw.sort((a, b) => Date.parse(a.arrivedAt) - Date.parse(b.arrivedAt));
		},
		put: async (record: LocalCheckpointArrivalRecord) => {
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
			const cursorReq = store.openCursor();
			await new Promise<void>((resolve, reject) => {
				cursorReq.onsuccess = () => {
					const cursor = cursorReq.result;
					if (!cursor) {
						resolve();
						return;
					}
					const rec = cursor.value as LocalCheckpointArrivalRecord;
					if (rec.tripId === tripId) {
						cursor.delete();
					}
					cursor.continue();
				};
				cursorReq.onerror = () => reject(cursorReq.error);
			});
			await transactionDone(store.transaction);
		},
	};
}

export function createMemoryCheckpointArrivalQueueStore(
	initial: LocalCheckpointArrivalRecord[] = []
): CheckpointArrivalQueueStore {
	const records = new Map<string, LocalCheckpointArrivalRecord>();
	for (const item of initial) {
		records.set(item.id, item);
	}

	return {
		list: async (tripId: string, porterId: string) =>
			[...records.values()]
				.filter((r) => r.tripId === tripId && r.porterId === porterId)
				.sort((a, b) => Date.parse(a.arrivedAt) - Date.parse(b.arrivedAt)),
		put: async (record: LocalCheckpointArrivalRecord) => {
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
