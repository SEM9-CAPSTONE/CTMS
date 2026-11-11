import type { ConfigService } from "@nestjs/config";
import { RealtimeEventPruneWorker } from "./realtime-event-prune.worker";
import type { RealtimeEventsRepository, StoredRealtimeEvent } from "./realtime-events.repository";
import { RealtimeEventsService, reconnectDelayMs } from "./realtime-events.service";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TRIP_A = "44444444-4444-4444-8444-444444444444";
const TRIP_B = "55555555-5555-4555-8555-555555555555";
const NOW = new Date("2026-11-10T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

function config(values: Record<string, string> = {}): ConfigService {
	return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function stored(sequence: number, name = "trip.review.requested"): StoredRealtimeEvent {
	return {
		id: `event-${sequence}`,
		sequence,
		name,
		payload: { n: sequence },
		createdAt: new Date(NOW.getTime() - HOUR),
	};
}

function repository(overrides: Partial<Record<keyof RealtimeEventsRepository, jest.Mock>> = {}) {
	return {
		append: jest.fn().mockResolvedValue(12),
		latestSequence: jest.fn().mockResolvedValue(10),
		oldestSequence: jest.fn().mockResolvedValue(1),
		hasExpiredAfter: jest.fn().mockResolvedValue(false),
		tripIdsAfter: jest.fn().mockResolvedValue([]),
		findForRecipient: jest.fn().mockResolvedValue([]),
		deleteOlderThan: jest.fn().mockResolvedValue(3),
		...overrides,
	};
}

function service(repo = repository(), values: Record<string, string> = {}) {
	return new RealtimeEventsService(repo as unknown as RealtimeEventsRepository, config(values));
}

describe("RealtimeEventsService (CTMS-082, BR-263)", () => {
	describe("bounded reconnect backoff", () => {
		it("uses 1 s doubling up to 30 s with 20% jitter by default", () => {
			expect(service().reconnectPolicy()).toEqual({
				initialDelayMs: 1000,
				maxDelayMs: 30000,
				multiplier: 2,
				jitterRatio: 0.2,
			});
		});

		it("never lets the cap fall below the first delay and ignores invalid values", () => {
			expect(
				service(repository(), {
					REALTIME_RECONNECT_INITIAL_DELAY_MS: "5000",
					REALTIME_RECONNECT_MAX_DELAY_MS: "2000",
					REALTIME_RECONNECT_MULTIPLIER: "0.5",
					REALTIME_RECONNECT_JITTER_RATIO: "3",
				}).reconnectPolicy()
			).toEqual({ initialDelayMs: 5000, maxDelayMs: 5000, multiplier: 1, jitterRatio: 0.2 });
		});

		it("keeps every attempt at or below the maximum delay", () => {
			const policy = service().reconnectPolicy();
			const delays = [1, 2, 3, 4, 5, 6, 10, 50, 1000].map((attempt) =>
				reconnectDelayMs(policy, attempt, () => 1)
			);
			expect(delays.slice(0, 5)).toEqual([1200, 2400, 4800, 9600, 19200]);
			for (const delay of delays) expect(delay).toBeLessThanOrEqual(30000);
			expect(reconnectDelayMs(policy, 1, () => 0)).toBe(800);
			expect(reconnectDelayMs(policy, 1000, () => 0)).toBe(24000);
		});
	});

	describe("record", () => {
		it("stores the event with its audience and returns the cursor", async () => {
			const repo = repository();
			const meta = await service(repo).record(
				"sos.created",
				{ sosId: "s" },
				{ userIds: [USER_ID], roles: [], tripId: null },
				"sos-event-1",
				NOW
			);

			expect(repo.append).toHaveBeenCalledWith({
				id: "sos-event-1",
				name: "sos.created",
				payload: { sosId: "s" },
				userIds: [USER_ID],
				roles: [],
				tripId: null,
				createdAt: NOW,
			});
			expect(meta).toEqual({ eventId: "sos-event-1", sequence: 12, emittedAt: NOW.toISOString() });
		});

		it("generates an id and still returns meta when storing fails", async () => {
			const repo = repository({ append: jest.fn().mockRejectedValue(new Error("db down")) });
			const meta = await service(repo).record("x", {}, { userIds: [], roles: [], tripId: null });

			expect(meta.eventId).toMatch(/^[0-9a-f-]{36}$/);
			expect(meta.sequence).toBeNull();
		});
	});

	describe("recover", () => {
		const request = (afterSequence: number, isTripMember = jest.fn().mockResolvedValue(false)) => ({
			afterSequence,
			userId: USER_ID,
			roles: ["camper"],
			isTripMember,
		});

		it("returns nothing when the client is already up to date", async () => {
			const repo = repository();
			await expect(service(repo).recover(request(10), NOW)).resolves.toEqual({
				events: [],
				latestSequence: 10,
				truncated: false,
			});
			expect(repo.findForRecipient).not.toHaveBeenCalled();
		});

		it("asks for a reload when the cursor was never issued by this server", async () => {
			await expect(service().recover(request(99), NOW)).resolves.toEqual({
				events: [],
				latestSequence: 10,
				truncated: true,
			});
		});

		it("returns the missed events in order with their identity and cursor", async () => {
			const repo = repository({
				findForRecipient: jest.fn().mockResolvedValue([stored(4), stored(7, "sos.created")]),
			});
			const result = await service(repo).recover(request(3), NOW);

			expect(result).toEqual({
				latestSequence: 10,
				truncated: false,
				events: [
					{
						event: "trip.review.requested",
						payload: { n: 4 },
						meta: { eventId: "event-4", sequence: 4, emittedAt: "2026-11-10T11:00:00.000Z" },
					},
					{
						event: "sos.created",
						payload: { n: 7 },
						meta: { eventId: "event-7", sequence: 7, emittedAt: "2026-11-10T11:00:00.000Z" },
					},
				],
			});
			expect(repo.findForRecipient).toHaveBeenCalledWith({
				afterSequence: 3,
				since: new Date(NOW.getTime() - 24 * HOUR),
				userId: USER_ID,
				roles: ["camper"],
				tripIds: [],
				limit: 201,
			});
		});

		it("includes Trip events only for Trips the user belongs to now", async () => {
			const repo = repository({ tripIdsAfter: jest.fn().mockResolvedValue([TRIP_A, TRIP_B]) });
			const isTripMember = jest.fn(async (tripId: string) => tripId === TRIP_A);
			await service(repo).recover(request(3, isTripMember), NOW);

			expect(isTripMember).toHaveBeenCalledTimes(2);
			expect(repo.findForRecipient).toHaveBeenCalledWith(
				expect.objectContaining({ tripIds: [TRIP_A] })
			);
		});

		it("flags truncation when events after the cursor already expired", async () => {
			const repo = repository({
				hasExpiredAfter: jest.fn().mockResolvedValue(true),
				findForRecipient: jest.fn().mockResolvedValue([stored(6)]),
			});
			const result = await service(repo).recover(request(2), NOW);

			expect(result.truncated).toBe(true);
			expect(result.events).toHaveLength(1);
		});

		it("flags truncation when the events right after the cursor were already pruned", async () => {
			const repo = repository({ oldestSequence: jest.fn().mockResolvedValue(6) });
			await expect(service(repo).recover(request(2), NOW)).resolves.toEqual(
				expect.objectContaining({ events: [], truncated: true })
			);
		});

		it("returns at most the configured limit and flags the rest as truncated", async () => {
			const repo = repository({
				findForRecipient: jest.fn().mockResolvedValue([stored(4), stored(5), stored(6)]),
			});
			const result = await service(repo, { REALTIME_RESUME_LIMIT: "2" }).recover(request(3), NOW);

			expect(repo.findForRecipient).toHaveBeenCalledWith(expect.objectContaining({ limit: 3 }));
			expect(result.events.map((event) => event.meta.sequence)).toEqual([4, 5]);
			expect(result.truncated).toBe(true);
		});
	});

	it("prunes events older than the retention window", async () => {
		const repo = repository();
		await expect(service(repo, { REALTIME_EVENT_RETENTION_HOURS: "6" }).prune(NOW)).resolves.toBe(
			3
		);
		expect(repo.deleteOlderThan).toHaveBeenCalledWith(new Date(NOW.getTime() - 6 * HOUR));
	});
});

describe("RealtimeEventPruneWorker (CTMS-082)", () => {
	it("does nothing unless enabled", async () => {
		const events = { prune: jest.fn().mockResolvedValue(0) };
		const worker = new RealtimeEventPruneWorker(
			config(),
			events as unknown as RealtimeEventsService
		);
		worker.onApplicationBootstrap();
		await worker.onApplicationShutdown();
		expect(events.prune).not.toHaveBeenCalled();
	});

	it("prunes on start when enabled and survives a failing pass", async () => {
		const events = { prune: jest.fn().mockRejectedValue(new Error("db down")) };
		const worker = new RealtimeEventPruneWorker(
			config({ REALTIME_EVENT_PRUNE_WORKER_ENABLED: "true" }),
			events as unknown as RealtimeEventsService
		);
		worker.onApplicationBootstrap();
		await worker.onApplicationShutdown();
		expect(events.prune).toHaveBeenCalledTimes(1);
	});
});
