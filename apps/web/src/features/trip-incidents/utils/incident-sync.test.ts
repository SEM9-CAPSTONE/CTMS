import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import type { TripIncidentsApi } from "../services/trip-incidents.service";
import {
	IncidentMediaState,
	IncidentSyncState,
	type LocalIncidentRecord,
	type TripIncident,
} from "../types";
import { createIncidentRecord, generateIncidentId } from "./incident-record";
import {
	classifySyncError,
	mergeIncidentLists,
	needsSync,
	nextRetryDelayMs,
	syncIncidentRecord,
} from "./incident-sync";

const NOW = Date.parse("2026-10-12T05:00:00.000Z");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function record(overrides: Partial<LocalIncidentRecord> = {}): LocalIncidentRecord {
	const base = createIncidentRecord(
		{
			category: "injury",
			severity: "high",
			description: "  Camper twisted an ankle  ",
			occurredAt: "2026-10-12T04:30:00.000Z",
			location: null,
			photo: null,
		},
		"trip-1",
		"porter-1",
		false,
		new Date(NOW)
	);
	return { ...base, ...overrides };
}

function serverIncident(id: string, overrides: Partial<TripIncident> = {}): TripIncident {
	return {
		id,
		tripId: "trip-1",
		reporterId: "porter-1",
		reporterName: "Porter",
		category: "injury",
		severity: "high",
		status: "open",
		description: "Camper twisted an ankle",
		occurredAt: "2026-10-12T04:30:00.000Z",
		location: null,
		locationStatus: "unavailable",
		capturedOffline: true,
		media: null,
		receivedAt: "2026-10-12T05:00:00.000Z",
		...overrides,
	};
}

function api(overrides: Partial<TripIncidentsApi> = {}): TripIncidentsApi {
	return {
		report: vi.fn(async (_tripId, payload) => ({
			outcome: "created" as const,
			incident: serverIncident(payload.id),
		})),
		list: vi.fn(async () => ({ items: [] })),
		uploadMedia: vi.fn(async (_tripId, incidentId) =>
			serverIncident(incidentId, {
				media: {
					url: `/uploads/incidents/${incidentId}.jpg`,
					contentType: "image/jpeg",
					sizeBytes: 3,
					uploadedAt: "2026-10-12T05:00:01.000Z",
				},
			})
		),
		...overrides,
	};
}

describe("createIncidentRecord (BR-162)", () => {
	it("fixes a stable v4 id shared by record and payload, marked as captured offline", () => {
		const created = record();
		expect(created.id).toMatch(UUID_PATTERN);
		expect(created.payload.id).toBe(created.id);
		expect(created.payload.capturedOffline).toBe(true);
		expect(created.payload.description).toBe("Camper twisted an ankle");
		expect(created.syncState).toBe(IncidentSyncState.PENDING);
	});

	it("falls back to getRandomValues when randomUUID is unavailable", () => {
		const original = crypto.randomUUID;
		Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
		try {
			expect(generateIncidentId()).toMatch(UUID_PATTERN);
		} finally {
			Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true });
		}
	});
});

describe("classifySyncError", () => {
	it.each([
		["a network failure", new TypeError("Failed to fetch"), true],
		["an expired session", new HttpError("x", 401, {}), true],
		["a server error", new HttpError("x", 503, {}), true],
		["rate limiting", new HttpError("x", 429, {}), true],
		["a lost assignment", new HttpError("x", 403, {}), false],
		["a validation error", new HttpError("bad", 422, {}), false],
		[
			"a Trip window conflict",
			new HttpError("x", 409, { code: "INCIDENT_OUTSIDE_TRIP_WINDOW" }),
			false,
		],
	])("treats %s as retryable=%s", (_label, error, retryable) => {
		expect(classifySyncError(error).retryable).toBe(retryable);
	});

	it("maps known API codes to readable reasons", () => {
		const failure = classifySyncError(
			new HttpError("x", 409, { code: "INCIDENT_TRIP_NOT_IN_PROGRESS" })
		);
		expect(failure.reason).toBe("Chuyến đi không ở trạng thái cho phép báo cáo sự cố.");
	});
});

describe("syncIncidentRecord (AC3 / AC4)", () => {
	it("marks the record synced only after the server confirms it", async () => {
		const synced = await syncIncidentRecord(record(), api(), NOW);
		expect(synced.syncState).toBe(IncidentSyncState.SYNCED);
		expect(synced.serverIncident?.id).toBe(synced.id);
	});

	it("resends the same id so a duplicate response still counts as synced", async () => {
		const original = record();
		const client = api({
			report: vi.fn(async () => ({
				outcome: "duplicate" as const,
				incident: serverIncident(original.id),
			})),
		});
		const synced = await syncIncidentRecord(original, client, NOW);

		expect(client.report).toHaveBeenCalledWith("trip-1", original.payload);
		expect(synced.syncState).toBe(IncidentSyncState.SYNCED);
	});

	it("keeps a record pending with backoff when the network fails", async () => {
		const client = api({ report: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) });
		const next = await syncIncidentRecord(record(), client, NOW);

		expect(next.syncState).toBe(IncidentSyncState.PENDING);
		expect(next.attempts).toBe(1);
		expect(next.nextAttemptAt).toBe(NOW + nextRetryDelayMs(0));
		expect(needsSync(next, NOW)).toBe(false);
		expect(needsSync(next, NOW + nextRetryDelayMs(0))).toBe(true);
	});

	it("marks a record failed when the server rejects it", async () => {
		const client = api({ report: vi.fn().mockRejectedValue(new HttpError("x", 403, {})) });
		const next = await syncIncidentRecord(record(), client, NOW);

		expect(next.syncState).toBe(IncidentSyncState.FAILED);
		expect(next.lastError).toBe("Bạn không còn được phân công cho chuyến đi này.");
		expect(needsSync(next, NOW + 10 * 60_000)).toBe(false);
	});

	it("uploads a pending photo after the incident and frees the device copy", async () => {
		const photo = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" });
		const synced = await syncIncidentRecord(
			record({ photo, mediaState: IncidentMediaState.PENDING }),
			api(),
			NOW
		);

		expect(synced.syncState).toBe(IncidentSyncState.SYNCED);
		expect(synced.mediaState).toBe(IncidentMediaState.UPLOADED);
		expect(synced.photo).toBeNull();
	});

	it("keeps the incident synced when only the photo is rejected (BR-224)", async () => {
		const photo = new Blob(["not an image"], { type: "image/jpeg" });
		const client = api({
			uploadMedia: vi
				.fn()
				.mockRejectedValue(new HttpError("x", 422, { code: "INCIDENT_MEDIA_INVALID" })),
		});
		const next = await syncIncidentRecord(
			record({ photo, mediaState: IncidentMediaState.PENDING }),
			client,
			NOW
		);

		expect(next.syncState).toBe(IncidentSyncState.SYNCED);
		expect(next.mediaState).toBe(IncidentMediaState.FAILED);
	});
});

describe("mergeIncidentLists (AC5)", () => {
	it("shows device-only records as pending next to server-confirmed incidents", () => {
		const pending = record();
		const items = mergeIncidentLists([serverIncident("server-1")], [pending]);

		expect(items.map((item) => [item.id, item.syncState])).toEqual(
			expect.arrayContaining([
				["server-1", IncidentSyncState.SYNCED],
				[pending.id, IncidentSyncState.PENDING],
			])
		);
	});

	it("keeps the device state while a synced incident still has a photo to send", () => {
		const synced = record({
			syncState: IncidentSyncState.SYNCED,
			mediaState: IncidentMediaState.PENDING,
		});
		const [item] = mergeIncidentLists([serverIncident(synced.id)], [synced]);

		expect(item.syncState).toBe(IncidentSyncState.SYNCED);
		expect(item.mediaState).toBe(IncidentMediaState.PENDING);
	});

	it("does not duplicate an incident present both on the server and the device", () => {
		const synced = record({ syncState: IncidentSyncState.SYNCED });
		expect(mergeIncidentLists([serverIncident(synced.id)], [synced])).toHaveLength(1);
	});
});
