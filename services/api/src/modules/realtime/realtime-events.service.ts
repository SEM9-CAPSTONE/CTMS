import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { type RealtimeAudience, RealtimeEventsRepository } from "./realtime-events.repository";

const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_RETENTION_HOURS = 24;
const DEFAULT_RESUME_LIMIT = 200;
const MAX_RESUME_LIMIT = 1000;

/** Sent as the second argument of every protected live event and with each recovered one. */
export interface RealtimeEventMeta {
	eventId: string;
	/** Recovery cursor; null when the event could not be stored (it cannot be recovered then). */
	sequence: number | null;
	emittedAt: string;
}

export interface RecoveredRealtimeEvent {
	event: string;
	payload: unknown;
	meta: RealtimeEventMeta;
}

export interface RealtimeRecovery {
	events: RecoveredRealtimeEvent[];
	latestSequence: number;
	/**
	 * true when not every missed event can be returned (cursor older than the retention window,
	 * unknown cursor, or more than the limit): the client reloads its data over HTTP instead.
	 */
	truncated: boolean;
}

/** BR-263 bounded backoff the client follows: the delay grows by `multiplier` up to `maxDelayMs`. */
export interface ReconnectPolicy {
	initialDelayMs: number;
	maxDelayMs: number;
	multiplier: number;
	jitterRatio: number;
}

export interface RecoveryRequest {
	afterSequence: number;
	userId: string;
	/** Roles the caller holds now (from the database). */
	roles: string[];
	/** Current Trip membership check (same rule as `trip.subscribe`). */
	isTripMember: (tripId: string) => Promise<boolean>;
}

/**
 * Reference delay for reconnect attempt `attempt` (1-based): never above `maxDelayMs`, whatever
 * the attempt number, with +/- `jitterRatio` spread so clients do not retry at the same moment.
 */
export function reconnectDelayMs(
	policy: ReconnectPolicy,
	attempt: number,
	random: () => number = Math.random
): number {
	const exponent = Math.max(0, Math.floor(attempt) - 1);
	const base = Math.min(policy.maxDelayMs, policy.initialDelayMs * policy.multiplier ** exponent);
	const spread = base * policy.jitterRatio * (random() * 2 - 1);
	return Math.round(Math.min(policy.maxDelayMs, Math.max(0, base + spread)));
}

/**
 * CTMS-082: keeps protected real-time events for a short window and answers a reconnecting
 * client's recovery request with only the events it is allowed to see now.
 */
@Injectable()
export class RealtimeEventsService {
	private readonly logger = new Logger(RealtimeEventsService.name);

	constructor(
		private readonly repository: RealtimeEventsRepository,
		private readonly configService: ConfigService
	) {}

	retentionMs(): number {
		return this.positiveNumber("REALTIME_EVENT_RETENTION_HOURS", DEFAULT_RETENTION_HOURS) * HOUR_MS;
	}

	resumeLimit(): number {
		return Math.min(
			MAX_RESUME_LIMIT,
			Math.floor(this.positiveNumber("REALTIME_RESUME_LIMIT", DEFAULT_RESUME_LIMIT))
		);
	}

	reconnectPolicy(): ReconnectPolicy {
		const initialDelayMs = this.positiveNumber("REALTIME_RECONNECT_INITIAL_DELAY_MS", 1000);
		const maxDelayMs = Math.max(
			initialDelayMs,
			this.positiveNumber("REALTIME_RECONNECT_MAX_DELAY_MS", 30_000)
		);
		const multiplier = Math.max(1, this.positiveNumber("REALTIME_RECONNECT_MULTIPLIER", 2));
		const jitter = Number(this.configService.get<string>("REALTIME_RECONNECT_JITTER_RATIO"));
		const jitterRatio = Number.isFinite(jitter) && jitter >= 0 && jitter <= 1 ? jitter : 0.2;
		return { initialDelayMs, maxDelayMs, multiplier, jitterRatio };
	}

	/**
	 * Stores the event before it is sent live. A storage failure never blocks live delivery: the
	 * event is still sent with its id (sequence null) and only its recovery is lost.
	 */
	async record(
		name: string,
		payload: unknown,
		audience: RealtimeAudience,
		eventId: string = randomUUID(),
		now: Date = new Date()
	): Promise<RealtimeEventMeta> {
		let sequence: number | null = null;
		try {
			sequence = await this.repository.append({
				id: eventId,
				name,
				payload,
				...audience,
				createdAt: now,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.warn(`Real-time event ${name} ${eventId} not stored for recovery: ${message}`);
		}
		return { eventId, sequence, emittedAt: now.toISOString() };
	}

	async latestSequence(): Promise<number> {
		return this.repository.latestSequence();
	}

	/** BR-263 / BR-259: missed events for the caller's current user, roles and Trip membership. */
	async recover(request: RecoveryRequest, now: Date = new Date()): Promise<RealtimeRecovery> {
		const latestSequence = await this.repository.latestSequence();
		const { afterSequence } = request;
		if (afterSequence > latestSequence) {
			// A cursor the server never issued (other database, reset): reload instead.
			return { events: [], latestSequence, truncated: true };
		}
		if (afterSequence === latestSequence) {
			return { events: [], latestSequence, truncated: false };
		}

		const since = new Date(now.getTime() - this.retentionMs());
		// Missed events are lost when one is past the window, or already pruned (the oldest stored
		// event comes after the next expected cursor).
		const [expired, oldest] = await Promise.all([
			this.repository.hasExpiredAfter(afterSequence, since),
			this.repository.oldestSequence(),
		]);
		const expiredGap = expired || oldest === null || afterSequence + 1 < oldest;

		const candidateTrips = await this.repository.tripIdsAfter(afterSequence, since);
		const tripIds: string[] = [];
		for (const tripId of candidateTrips) {
			if (await request.isTripMember(tripId)) tripIds.push(tripId);
		}

		const limit = this.resumeLimit();
		const rows = await this.repository.findForRecipient({
			afterSequence,
			since,
			userId: request.userId,
			roles: request.roles,
			tripIds,
			limit: limit + 1,
		});
		const hasMore = rows.length > limit;
		const events = rows.slice(0, limit).map((row) => ({
			event: row.name,
			payload: row.payload,
			meta: {
				eventId: row.id,
				sequence: row.sequence,
				emittedAt: new Date(row.createdAt).toISOString(),
			},
		}));
		return { events, latestSequence, truncated: expiredGap || hasMore };
	}

	/** Deletes events past the retention window; returns how many were removed. */
	async prune(now: Date = new Date()): Promise<number> {
		return this.repository.deleteOlderThan(new Date(now.getTime() - this.retentionMs()));
	}

	private positiveNumber(key: string, fallback: number): number {
		const value = Number(this.configService.get<string>(key));
		return Number.isFinite(value) && value > 0 ? value : fallback;
	}
}
