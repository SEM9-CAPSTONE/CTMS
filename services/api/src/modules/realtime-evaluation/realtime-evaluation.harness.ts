import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { HttpAdapterHost } from "@nestjs/core";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { JwtService } from "@nestjs/jwt";
import { type Socket as ClientSocket, io } from "socket.io-client";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource } from "typeorm";
import {
	type ConnectedPayload,
	// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
	EventsGateway,
	type RealtimeDeliveryAck,
	type RealtimeEvaluationProbeEvent,
	type RealtimeResumeAck,
	roleRoom,
	userRoom,
} from "../realtime/events.gateway";
import type { RealtimeEventMeta } from "../realtime/realtime-events.service";
import { UserRole } from "../users/entities/user.entity";
import {
	REALTIME_EVALUATION_ACK_TIMEOUT_MS,
	REALTIME_EVALUATION_CONNECT_TIMEOUT_MS,
	REALTIME_EVALUATION_DELIVERY_TIMEOUT_MS,
	REALTIME_EVALUATION_PROBE_EMAIL_DOMAIN,
	REALTIME_EVALUATION_WARMUP_EVENTS,
} from "./realtime-evaluation.constants";
import { RealtimeEvaluationScenario } from "./realtime-evaluation.enums";

const SOS_EVENT: RealtimeEvaluationProbeEvent = "evaluation.probe.sos";
const NORMAL_EVENT: RealtimeEvaluationProbeEvent = "evaluation.probe.normal";
const PROBE_ROLE = UserRole.CAMPER;

export interface RealtimeEvaluationParams {
	sosEvents: number;
	normalEvents: number;
	concurrentClients: number;
	missedEvents: number;
}

/** Timing of one event at one client. Payload content is never kept (BR-265). */
export interface RealtimeSampleRecord {
	scenario: RealtimeEvaluationScenario;
	eventType: RealtimeEvaluationProbeEvent;
	eventId: string | null;
	sequence: number | null;
	clientIndex: number;
	warmup: boolean;
	sentAt: Date | null;
	receivedAt: Date | null;
	acknowledgedAt: Date | null;
	latencyMs: number | null;
}

export interface RealtimeHarnessResult {
	samples: RealtimeSampleRecord[];
	recovery: { eligible: number; recovered: number; truncated: boolean };
	scenarios: Array<{
		scenario: RealtimeEvaluationScenario;
		description: string;
		passed: boolean;
		details: Record<string, unknown>;
	}>;
	observations: {
		concurrentClients: number;
		normalBurstMs: number | null;
		duplicateCopiesFiltered: number;
	};
}

interface Delivery {
	eventId: string;
	sequence: number | null;
	sentAt: number;
	receivedAt: number;
	ack: Promise<number | null>;
}

/** One authenticated socket.io client of the harness and what it received. */
class ProbeClient {
	private readonly received = new Map<string, Delivery>();
	private readonly waiters = new Map<string, () => void>();

	constructor(
		readonly index: number,
		readonly userId: string,
		readonly socket: ClientSocket,
		readonly connected: ConnectedPayload
	) {
		for (const name of [SOS_EVENT, NORMAL_EVENT]) {
			socket.on(name, (payload: { index?: number }, meta: RealtimeEventMeta) => {
				const receivedAt = Date.now();
				const key = `${name}:${payload?.index}`;
				if (this.received.has(key)) return;
				const ack = (
					socket
						.timeout(REALTIME_EVALUATION_ACK_TIMEOUT_MS)
						.emitWithAck("realtime.ack", { eventId: meta.eventId }) as Promise<RealtimeDeliveryAck>
				)
					.then((answer) => (answer.ok ? Date.parse(answer.acknowledgedAt) : null))
					.catch(() => null);
				this.received.set(key, {
					eventId: meta.eventId,
					sequence: meta.sequence,
					sentAt: Date.parse(meta.emittedAt),
					receivedAt,
					ack,
				});
				this.waiters.get(key)?.();
			});
		}
	}

	delivery(name: string, index: number): Delivery | undefined {
		return this.received.get(`${name}:${index}`);
	}

	/** Resolves when the event arrives or the delivery timeout passes. */
	waitFor(name: string, index: number): Promise<Delivery | undefined> {
		const key = `${name}:${index}`;
		const existing = this.received.get(key);
		if (existing) return Promise.resolve(existing);
		return new Promise((resolve) => {
			const timer = setTimeout(() => {
				this.waiters.delete(key);
				resolve(undefined);
			}, REALTIME_EVALUATION_DELIVERY_TIMEOUT_MS);
			this.waiters.set(key, () => {
				clearTimeout(timer);
				this.waiters.delete(key);
				resolve(this.received.get(key));
			});
		});
	}

	resume(afterSequence: number): Promise<RealtimeResumeAck> {
		return this.socket
			.timeout(REALTIME_EVALUATION_ACK_TIMEOUT_MS)
			.emitWithAck("realtime.resume", { afterSequence }) as Promise<RealtimeResumeAck>;
	}

	close(): void {
		this.socket.removeAllListeners();
		this.socket.disconnect();
	}
}

/**
 * CTMS-100: drives real socket.io clients against this API over loopback WebSocket (the "stable
 * connection" of spec §12) through the production publish path, then removes its temporary probe
 * accounts and their stored events.
 */
@Injectable()
export class RealtimeEvaluationHarness {
	private nextIndex = 0;

	constructor(
		private readonly dataSource: DataSource,
		private readonly jwtService: JwtService,
		private readonly gateway: EventsGateway,
		private readonly httpAdapterHost: HttpAdapterHost
	) {}

	async run(params: RealtimeEvaluationParams): Promise<RealtimeHarnessResult> {
		const baseUrl = this.baseUrl();
		const userIds = await this.createProbeUsers(params.concurrentClients + 2);
		const clients: ProbeClient[] = [];
		try {
			const open = async (index: number) => {
				const client = await this.connect(baseUrl, index, userIds[index]);
				clients.push(client);
				return client;
			};
			const samples: RealtimeSampleRecord[] = [];
			const scenarios: RealtimeHarnessResult["scenarios"] = [];

			// 1. SOS on a stable connection, one event at a time.
			const sosClient = await open(0);
			const sosTotal = REALTIME_EVALUATION_WARMUP_EVENTS + params.sosEvents;
			for (let i = 0; i < sosTotal; i += 1) {
				const index = this.emit(SOS_EVENT, [sosClient.userId]);
				const delivery = await sosClient.waitFor(SOS_EVENT, index);
				samples.push(
					await this.sample(
						RealtimeEvaluationScenario.STABLE_SOS,
						SOS_EVENT,
						sosClient,
						delivery,
						i < REALTIME_EVALUATION_WARMUP_EVENTS
					)
				);
			}
			const sosMeasured = samples.filter((sample) => !sample.warmup);
			scenarios.push({
				scenario: RealtimeEvaluationScenario.STABLE_SOS,
				description:
					"SOS events to one client over loopback WebSocket, one at a time, warm-up excluded",
				passed: sosMeasured.every((sample) => sample.receivedAt !== null),
				details: {
					measured: sosMeasured.length,
					undelivered: sosMeasured.filter((s) => s.receivedAt === null).length,
				},
			});

			// 2. A burst of normal events to many clients connected at the same time.
			const burstClients = await Promise.all(
				Array.from({ length: params.concurrentClients }, (_, offset) => open(offset + 1))
			);
			const burstUserIds = burstClients.map((client) => client.userId);
			for (let i = 0; i < REALTIME_EVALUATION_WARMUP_EVENTS; i += 1) {
				const index = this.emit(NORMAL_EVENT, burstUserIds);
				for (const client of burstClients) {
					samples.push(
						await this.sample(
							RealtimeEvaluationScenario.CONCURRENT_NORMAL,
							NORMAL_EVENT,
							client,
							await client.waitFor(NORMAL_EVENT, index),
							true
						)
					);
				}
			}
			const burstStarted = Date.now();
			const indexes = Array.from({ length: params.normalEvents }, () =>
				this.emit(NORMAL_EVENT, burstUserIds)
			);
			const burstDeliveries = await Promise.all(
				indexes.flatMap((index) =>
					burstClients.map(async (client) => ({
						client,
						delivery: await client.waitFor(NORMAL_EVENT, index),
					}))
				)
			);
			for (const { client, delivery } of burstDeliveries) {
				samples.push(
					await this.sample(
						RealtimeEvaluationScenario.CONCURRENT_NORMAL,
						NORMAL_EVENT,
						client,
						delivery,
						false
					)
				);
			}
			const lastReceived = Math.max(
				...burstDeliveries.map(({ delivery }) => delivery?.receivedAt ?? 0)
			);
			const normalBurstMs = lastReceived > 0 ? lastReceived - burstStarted : null;
			const burstMeasured = burstDeliveries.length;
			const burstLost = burstDeliveries.filter(({ delivery }) => !delivery).length;
			scenarios.push({
				scenario: RealtimeEvaluationScenario.CONCURRENT_NORMAL,
				description: `${params.normalEvents} normal events published at once to ${params.concurrentClients} connected clients`,
				passed: burstLost === 0,
				details: {
					deliveriesExpected: burstMeasured,
					undelivered: burstLost,
					burstMs: normalBurstMs,
				},
			});

			// 3-5. Offline client, reconnect, recovery, room restore and duplicates.
			const resumeIndex = params.concurrentClients + 1;
			const outcome = await this.reconnectScenarios(
				baseUrl,
				resumeIndex,
				userIds[resumeIndex],
				params.missedEvents,
				clients,
				samples
			);
			scenarios.push(...outcome.scenarios);

			return {
				samples,
				recovery: outcome.recovery,
				scenarios,
				observations: {
					concurrentClients: params.concurrentClients,
					normalBurstMs,
					duplicateCopiesFiltered: outcome.duplicateCopiesFiltered,
				},
			};
		} finally {
			for (const client of clients) client.close();
			await this.gateway.flushPublished();
			await this.removeProbeUsers(userIds);
		}
	}

	private async reconnectScenarios(
		baseUrl: string,
		index: number,
		userId: string,
		missedEvents: number,
		clients: ProbeClient[],
		samples: RealtimeSampleRecord[]
	) {
		const first = await this.connect(baseUrl, index, userId);
		clients.push(first);
		// Establish the cursor the client last saw, as the web client does.
		const anchorIndex = this.emit(NORMAL_EVENT, [userId]);
		const anchor = await first.waitFor(NORMAL_EVENT, anchorIndex);
		const cursor = anchor?.sequence ?? first.connected.latestSequence ?? 0;
		first.close();

		const missed = Array.from({ length: missedEvents }, () => this.emit(NORMAL_EVENT, [userId]));
		await this.gateway.flushPublished();

		const second = await this.connect(baseUrl, index, userId);
		clients.push(second);
		const resumed = await second.resume(cursor);
		const resumedAt = Date.now();
		const recoveredEvents = resumed.ok ? resumed.events : [];
		const recoveredByIndex = new Map(
			recoveredEvents
				.filter((event) => event.event === NORMAL_EVENT)
				.map((event) => [(event.payload as { index?: number }).index, event] as const)
		);
		let recovered = 0;
		for (const missedIndex of missed) {
			const event = recoveredByIndex.get(missedIndex);
			if (event) recovered += 1;
			samples.push({
				scenario: RealtimeEvaluationScenario.RECONNECT_RECOVERY,
				eventType: NORMAL_EVENT,
				eventId: event?.meta.eventId ?? null,
				sequence: event?.meta.sequence ?? null,
				clientIndex: index,
				warmup: false,
				sentAt: event ? new Date(event.meta.emittedAt) : null,
				receivedAt: event ? new Date(resumedAt) : null,
				acknowledgedAt: null,
				latencyMs: event ? Math.max(0, resumedAt - Date.parse(event.meta.emittedAt)) : null,
			});
		}
		const truncated = resumed.ok ? resumed.truncated : false;
		const scenarios: RealtimeHarnessResult["scenarios"] = [
			{
				scenario: RealtimeEvaluationScenario.RECONNECT_RECOVERY,
				description: `${missedEvents} events published while the client was offline, recovered with realtime.resume`,
				passed: resumed.ok && recovered === missedEvents,
				details: { eligible: missedEvents, recovered, resumeOk: resumed.ok, truncated },
			},
		];

		// Room restore: the reconnected socket is back in its user and role rooms and live events arrive.
		const rooms = second.connected.rooms ?? [];
		const liveIndex = this.emit(NORMAL_EVENT, [userId]);
		const live = await second.waitFor(NORMAL_EVENT, liveIndex);
		samples.push(
			await this.sample(RealtimeEvaluationScenario.ROOM_RESTORE, NORMAL_EVENT, second, live, false)
		);
		const roomsRestored = rooms.includes(userRoom(userId)) && rooms.includes(roleRoom(PROBE_ROLE));
		scenarios.push({
			scenario: RealtimeEvaluationScenario.ROOM_RESTORE,
			description:
				"After reconnecting, the user and role rooms are joined again and a live event arrives",
			passed: roomsRestored && live !== undefined,
			details: { rooms, liveEventReceived: live !== undefined },
		});

		// Duplicates: asking again returns copies of events already handled, with the same event ids.
		const handled = new Set<string>([
			...recoveredEvents.map((event) => event.meta.eventId),
			...(live ? [live.eventId] : []),
		]);
		const again = await second.resume(cursor);
		const copies = again.ok ? again.events.filter((event) => event.event === NORMAL_EVENT) : [];
		const newIds = copies.filter((event) => !handled.has(event.meta.eventId)).length;
		const liveCopy = live ? copies.find((event) => event.meta.eventId === live.eventId) : undefined;
		scenarios.push({
			scenario: RealtimeEvaluationScenario.DUPLICATE_HANDLING,
			description:
				"Recovered copies of handled events keep their event id, so a client filters every duplicate",
			passed: again.ok && copies.length > 0 && newIds === 0 && liveCopy !== undefined,
			details: {
				copiesReturned: copies.length,
				unknownIds: newIds,
				liveCopyMatched: liveCopy !== undefined,
			},
		});

		return {
			recovery: { eligible: missedEvents, recovered, truncated },
			scenarios,
			duplicateCopiesFiltered: copies.length,
		};
	}

	private emit(name: RealtimeEvaluationProbeEvent, userIds: string[]): number {
		const index = this.nextIndex++;
		this.gateway.emitEvaluationProbe(name, userIds, { probe: true, index });
		return index;
	}

	private async sample(
		scenario: RealtimeEvaluationScenario,
		eventType: RealtimeEvaluationProbeEvent,
		client: ProbeClient,
		delivery: Delivery | undefined,
		warmup: boolean
	): Promise<RealtimeSampleRecord> {
		const acknowledgedAt = delivery ? await delivery.ack : null;
		return {
			scenario,
			eventType,
			eventId: delivery?.eventId ?? null,
			sequence: delivery?.sequence ?? null,
			clientIndex: client.index,
			warmup,
			sentAt: delivery ? new Date(delivery.sentAt) : null,
			receivedAt: delivery ? new Date(delivery.receivedAt) : null,
			acknowledgedAt: acknowledgedAt === null ? null : new Date(acknowledgedAt),
			latencyMs: delivery ? Math.max(0, delivery.receivedAt - delivery.sentAt) : null,
		};
	}

	private baseUrl(): string {
		const server = this.httpAdapterHost.httpAdapter?.getHttpServer?.();
		const address = server?.address?.() as AddressInfo | string | null | undefined;
		if (!address || typeof address === "string") {
			throw new ServiceUnavailableException(
				"The API is not listening, so the evaluation cannot connect"
			);
		}
		return `http://127.0.0.1:${address.port}`;
	}

	private connect(baseUrl: string, index: number, userId: string): Promise<ProbeClient> {
		const token = this.jwtService.sign({ sub: userId, roles: [PROBE_ROLE] }, { expiresIn: "15m" });
		const socket = io(baseUrl, {
			transports: ["websocket"],
			forceNew: true,
			reconnection: false,
			auth: { token },
		});
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				socket.disconnect();
				reject(new ServiceUnavailableException("Evaluation client could not connect in time"));
			}, REALTIME_EVALUATION_CONNECT_TIMEOUT_MS);
			socket.once("connected", (payload: ConnectedPayload) => {
				clearTimeout(timer);
				if (!payload.authenticated) {
					socket.disconnect();
					reject(new ServiceUnavailableException("Evaluation client was not authenticated"));
					return;
				}
				resolve(new ProbeClient(index, userId, socket, payload));
			});
			socket.once("auth.error", () => {
				clearTimeout(timer);
				socket.disconnect();
				reject(new ServiceUnavailableException("Evaluation client was rejected"));
			});
			socket.once("connect_error", (error: Error) => {
				clearTimeout(timer);
				reject(new ServiceUnavailableException(`Evaluation client failed: ${error.message}`));
			});
		});
	}

	/** Temporary active Camper accounts that cannot log in; removed by `removeProbeUsers`. */
	private async createProbeUsers(count: number): Promise<string[]> {
		const ids = Array.from({ length: count }, () => randomUUID());
		await this.dataSource.transaction(async (manager) => {
			for (const id of ids) {
				await manager.query(
					`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
					 VALUES ($1, $2, 'realtime-evaluation-probe-no-login', $3, 'active', 'Realtime evaluation probe')`,
					[id, `realtime-probe-${id}@${REALTIME_EVALUATION_PROBE_EMAIL_DOMAIN}`, PROBE_ROLE]
				);
				await manager.query(`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)`, [
					id,
					PROBE_ROLE,
				]);
			}
		});
		return ids;
	}

	private async removeProbeUsers(ids: string[]): Promise<void> {
		await this.dataSource.transaction(async (manager) => {
			await manager.query(`DELETE FROM "realtime_events" WHERE "user_ids" && $1::uuid[]`, [ids]);
			await manager.query(`DELETE FROM "user_roles" WHERE "user_id" = ANY($1::uuid[])`, [ids]);
			await manager.query(`DELETE FROM "users" WHERE "id" = ANY($1::uuid[])`, [ids]);
		});
	}
}
