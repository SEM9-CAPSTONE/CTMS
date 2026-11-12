import { Logger, type OnModuleDestroy, Optional } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { JwtService } from "@nestjs/jwt";
import {
	ConnectedSocket,
	MessageBody,
	type OnGatewayConnection,
	type OnGatewayDisconnect,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import type { JwtPayload } from "../auth/jwt.strategy";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import type { EmergencyBroadcastPayload } from "../emergency-broadcasts/emergency-broadcasts.types";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { GpsParticipationSource } from "../gps-tracking/gps-participation.source";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import { UserRole, UserStatus } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { UsersRepository } from "../users/users.repository";
import type { RealtimeAudience } from "./realtime-events.repository";
import type {
	RealtimeEventMeta,
	ReconnectPolicy,
	RecoveredRealtimeEvent,
} from "./realtime-events.service";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { RealtimeEventsService } from "./realtime-events.service";

/** CTMS-078, BR-259: private room an authenticated socket joins; only its own user is ever joined. */
export function userRoom(userId: string): string {
	return `user:${userId}`;
}

/** CTMS-078: one room per role the user actually holds, resolved from the database (BR-172). */
export function roleRoom(role: UserRole): string {
	return `role:${role}`;
}

/** CTMS-078: joined only through an authorized `trip.subscribe`. */
export function tripRoom(tripId: string): string {
	return `trip:${tripId}`;
}

/** Camper member states that currently belong to the Trip team. */
const TRIP_ROOM_MEMBER_STATUSES: ReadonlySet<BookingMemberStatus> = new Set([
	BookingMemberStatus.REGISTERED,
	BookingMemberStatus.JOINED,
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export enum TripRoomError {
	NOT_AUTHENTICATED = "NOT_AUTHENTICATED",
	INVALID_TRIP_ID = "INVALID_TRIP_ID",
	TRIP_NOT_FOUND = "TRIP_NOT_FOUND",
	NOT_TRIP_MEMBER = "NOT_TRIP_MEMBER",
}

export type TripRoomAck = { ok: true; room: string } | { ok: false; error: TripRoomError };

export enum RealtimeResumeError {
	NOT_AUTHENTICATED = "NOT_AUTHENTICATED",
	INVALID_CURSOR = "INVALID_CURSOR",
}

/** CTMS-082: answer to `realtime.resume`; only events the caller may receive now are returned. */
export type RealtimeResumeAck =
	| {
			ok: true;
			events: RecoveredRealtimeEvent[];
			latestSequence: number;
			truncated: boolean;
	  }
	| { ok: false; error: RealtimeResumeError };

/** CTMS-082 data in the `connected` handshake event. */
export interface ConnectedRecoveryContext {
	/** Cursor to send back in `realtime.resume` after a reconnect; null for anonymous sockets. */
	latestSequence: number | null;
	reconnect: ReconnectPolicy;
}

/** `connected` handshake event sent to every socket. */
export interface ConnectedPayload extends ConnectedRecoveryContext {
	message: string;
	authenticated: boolean;
	rooms?: string[];
}

/** CTMS-079: SOS event identity — `eventId` is stable per persisted SOS so clients can dedupe. */
export interface SosCreatedPayload {
	eventId: string;
	sosId: string;
	tripId: string;
	senderId: string;
	emergencyType: string;
	status: string;
	eventTime: string;
	/** Server acceptance/persistence time — the BR-260 latency origin. */
	persistedAt: string;
}

/** CTMS-090: `booking.updated`, the Booking owner's view of a state change. */
export interface BookingUpdatedPayload {
	eventId: string;
	bookingId: string;
	tripId: string;
	tripTitle: string;
	status: "confirmed" | "cancelled" | "expired" | "pending_reconfirmation";
	updatedAt: string;
}

export interface SosStateChangedPayload {
	sosId: string;
	tripId: string;
	senderId: string;
	status: string;
	cancelledBy?: string | null;
	cancelledAt?: string | null;
	cancellationReason?: string | null;
	acknowledgedBy?: string | null;
	acknowledgedAt?: string | null;
	closedBy?: string | null;
	closedAt?: string | null;
	resolutionNote?: string | null;
}

interface SocketSession {
	userId: string;
	roles: UserRole[];
	expiryTimer?: ReturnType<typeof setTimeout>;
}

const SOCKET_AUTH_FAILED_MESSAGE = "Invalid or expired access token";

@WebSocketGateway({
	cors: {
		origin: "*",
	},
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
	private readonly logger = new Logger(EventsGateway.name);
	private readonly sessions = new Map<string, SocketSession>();

	@WebSocketServer()
	server!: Server;

	constructor(
		private readonly jwtService: JwtService,
		private readonly usersRepository: UsersRepository,
		private readonly participation: GpsParticipationSource,
		private readonly realtimeEvents: RealtimeEventsService,
		// CTMS-090: committed events also become background pushes for their addressed users.
		@Optional() private readonly pushes?: PushNotificationsService
	) {}

	/** Live publishes still storing their event; awaited by tests and on shutdown. */
	private readonly publishing = new Set<Promise<void>>();

	/**
	 * CTMS-078, BR-259/BR-170/BR-171: a socket that presents an access token is authenticated against
	 * an active account and joined to its own user room and its database-granted role rooms; an
	 * invalid/expired token or a non-active user is rejected. A socket without a token stays anonymous
	 * (public broadcasts only, e.g. CTMS-083 availability) and never joins a private room.
	 */
	async handleConnection(client: Socket) {
		const token = extractAccessToken(client);
		if (!token) {
			client.emit("connected", {
				message: "Connected to CTMS real-time gateway",
				authenticated: false,
				latestSequence: null,
				reconnect: this.realtimeEvents.reconnectPolicy(),
			} satisfies ConnectedPayload);
			return;
		}

		try {
			const payload = await this.jwtService.verifyAsync<JwtPayload & { exp?: number }>(token);
			const user = await this.usersRepository.findOneWithRolesById(payload.sub);
			if (!user || user.status !== UserStatus.ACTIVE) {
				throw new Error("User is not active");
			}
			if (client.disconnected) return;

			// Roles come from the database, never from token claims (BR-172).
			const roles = this.usersRepository.getGrantedRoles(user);
			const rooms = [userRoom(user.id), ...roles.map(roleRoom)];
			await client.join(rooms);
			const session: SocketSession = { userId: user.id, roles };
			if (payload.exp) {
				// The socket must not outlive the access token; the client reconnects with a fresh one.
				session.expiryTimer = setTimeout(
					() => this.rejectSocket(client),
					Math.max(0, payload.exp * 1000 - Date.now())
				);
			}
			this.sessions.set(client.id, session);
			client.data.identity = { userId: user.id, roles };
			client.emit("connected", {
				message: "Connected to CTMS real-time gateway",
				authenticated: true,
				rooms,
				latestSequence: await this.safeLatestSequence(),
				reconnect: this.realtimeEvents.reconnectPolicy(),
			} satisfies ConnectedPayload);
		} catch {
			this.rejectSocket(client);
		}
	}

	handleDisconnect(client: Socket) {
		const session = this.sessions.get(client.id);
		if (session?.expiryTimer) clearTimeout(session.expiryTimer);
		this.sessions.delete(client.id);
	}

	async onModuleDestroy() {
		for (const session of this.sessions.values()) {
			if (session.expiryTimer) clearTimeout(session.expiryTimer);
		}
		this.sessions.clear();
		await this.flushPublished();
	}

	/** Resolves once every live event published so far has been stored and sent. */
	async flushPublished(): Promise<void> {
		while (this.publishing.size > 0) {
			await Promise.allSettled([...this.publishing]);
		}
	}

	/**
	 * CTMS-082, BR-263/BR-259: after a reconnect the client sends the last cursor it saw and gets the
	 * protected events it missed. Only the authenticated socket of an active account may ask, and
	 * the audience is checked again now: the user's own events, its current database roles and the
	 * Trips it currently belongs to. Previous room membership proves nothing.
	 */
	@SubscribeMessage("realtime.resume")
	async resume(
		@ConnectedSocket() client: Socket,
		@MessageBody() body: { afterSequence?: unknown } | undefined
	): Promise<RealtimeResumeAck> {
		const session = this.sessions.get(client.id);
		if (!session) return { ok: false, error: RealtimeResumeError.NOT_AUTHENTICATED };
		const afterSequence = body?.afterSequence;
		if (
			typeof afterSequence !== "number" ||
			!Number.isSafeInteger(afterSequence) ||
			afterSequence < 0
		) {
			return { ok: false, error: RealtimeResumeError.INVALID_CURSOR };
		}

		const user = await this.usersRepository.findOneWithRolesById(session.userId);
		if (!user || user.status !== UserStatus.ACTIVE) {
			this.rejectSocket(client);
			return { ok: false, error: RealtimeResumeError.NOT_AUTHENTICATED };
		}
		const roles = this.usersRepository.getGrantedRoles(user);
		const recovery = await this.realtimeEvents.recover({
			afterSequence,
			userId: user.id,
			roles,
			isTripMember: async (tripId) => (await this.tripRoomRejection(user.id, tripId)) === null,
		});
		if (client.disconnected) return { ok: false, error: RealtimeResumeError.NOT_AUTHENTICATED };
		return { ok: true, ...recovery };
	}

	/**
	 * CTMS-078 PB AC-4/AC-5: join a Trip room only when the server-owned Trip relationship allows it.
	 * Authentication alone grants nothing; the decision is re-evaluated on every subscribe, so a
	 * reconnecting client must subscribe again.
	 */
	@SubscribeMessage("trip.subscribe")
	async subscribeTrip(
		@ConnectedSocket() client: Socket,
		@MessageBody() body: { tripId?: unknown } | undefined
	): Promise<TripRoomAck> {
		const session = this.sessions.get(client.id);
		if (!session) return { ok: false, error: TripRoomError.NOT_AUTHENTICATED };
		const tripId = body?.tripId;
		if (typeof tripId !== "string" || !UUID_PATTERN.test(tripId)) {
			return { ok: false, error: TripRoomError.INVALID_TRIP_ID };
		}

		const error = await this.tripRoomRejection(session.userId, tripId);
		if (error) return { ok: false, error };
		if (client.disconnected) return { ok: false, error: TripRoomError.NOT_AUTHENTICATED };

		const room = tripRoom(tripId);
		await client.join(room);
		return { ok: true, room };
	}

	@SubscribeMessage("trip.unsubscribe")
	async unsubscribeTrip(
		@ConnectedSocket() client: Socket,
		@MessageBody() body: { tripId?: unknown } | undefined
	): Promise<TripRoomAck> {
		const tripId = body?.tripId;
		if (typeof tripId !== "string" || !UUID_PATTERN.test(tripId)) {
			return { ok: false, error: TripRoomError.INVALID_TRIP_ID };
		}
		const room = tripRoom(tripId);
		await client.leave(room);
		return { ok: true, room };
	}

	/** Trip team: its Host, Campers registered or joined on a participating Booking, assigned Porters. */
	private async tripRoomRejection(userId: string, tripId: string): Promise<TripRoomError | null> {
		const trip = await this.participation.findTrip(tripId);
		if (!trip) return TripRoomError.TRIP_NOT_FOUND;
		if (trip.hostId === userId) return null;

		const [camper, porter] = await Promise.all([
			this.participation.findCamperParticipation(tripId, userId),
			this.participation.findPorterAssignment(tripId, userId),
		]);
		if (camper && TRIP_ROOM_MEMBER_STATUSES.has(camper.memberStatus)) return null;
		if (porter?.assigned) return null;
		return TripRoomError.NOT_TRIP_MEMBER;
	}

	private async safeLatestSequence(): Promise<number | null> {
		try {
			return await this.realtimeEvents.latestSequence();
		} catch {
			return null;
		}
	}

	/**
	 * CTMS-082: store the protected event (identity + cursor + frozen audience), then send it live
	 * with `meta` as the second argument. The payload is unchanged, so existing listeners keep
	 * working; clients dedupe live and recovered copies by `meta.eventId`.
	 */
	private publish(
		name: string,
		payload: object,
		audience: Partial<RealtimeAudience>,
		eventId?: string
	): void {
		const full: RealtimeAudience = {
			userIds: [...new Set(audience.userIds ?? [])],
			roles: [...new Set(audience.roles ?? [])],
			tripId: audience.tripId ?? null,
		};
		const rooms = [
			...(full.tripId ? [tripRoom(full.tripId)] : []),
			...full.userIds.map(userRoom),
			...full.roles.map((role) => roleRoom(role as UserRole)),
		];
		if (rooms.length === 0) return;
		const task: Promise<void> = this.realtimeEvents
			.record(name, payload, full, eventId)
			.then(async (meta: RealtimeEventMeta) => {
				this.server?.to(rooms).emit(name, payload, meta);
				// Same identity as the live copy, so a re-published event is never pushed twice.
				await this.pushes?.enqueueForEvent(name, payload, full.userIds, meta.eventId);
			})
			.catch((error: unknown) => {
				const message = error instanceof Error ? error.message : String(error);
				this.logger.error(`Real-time event ${name} not delivered: ${message}`);
			})
			.finally(() => {
				this.publishing.delete(task);
			});
		this.publishing.add(task);
	}

	private rejectSocket(client: Socket) {
		client.emit("auth.error", { message: SOCKET_AUTH_FAILED_MESSAGE });
		client.disconnect(true);
		this.logger.debug(`Rejected socket ${client.id}: ${SOCKET_AUTH_FAILED_MESSAGE}`);
	}

	emitTripReviewUpdated(payload: {
		tripId: string;
		title: string;
		hostId: string;
		updatedAt: string;
	}) {
		this.publish("trip.review.updated", payload, { roles: [UserRole.ADMIN] });
	}

	emitTripReviewRequested(payload: {
		tripId: string;
		title: string;
		hostId: string;
		submittedAt: string;
		deadlineAt: string;
	}) {
		this.publish("trip.review.requested", payload, { roles: [UserRole.ADMIN] });
	}

	emitTripReviewReminder(payload: {
		tripId: string;
		title: string;
		hostId: string;
		submittedAt: string;
		deadlineAt: string;
	}) {
		this.publish("trip.review.reminder", payload, { roles: [UserRole.ADMIN] });
	}

	emitTripReviewAutoRejected(payload: {
		tripId: string;
		title: string;
		hostId: string;
		rejectedAt: string;
		reason: string;
	}) {
		this.publish("trip.review.auto_rejected", payload, {
			userIds: [payload.hostId],
			roles: [UserRole.ADMIN],
		});
	}

	emitPorterRequestCreated(payload: {
		requestId: string;
		tripId: string;
		porterId: string;
		requestedBy: string;
		requestedRole: string;
		expiresAt: string;
	}) {
		this.publish("porter.request.created", payload, {
			userIds: [payload.porterId, payload.requestedBy],
		});
	}

	emitPorterRequestStateChanged(payload: {
		requestId: string;
		tripId: string;
		porterId: string;
		requestedBy: string;
		status: string;
		respondedAt: string | null;
	}) {
		this.publish("porter.request.state_changed", payload, {
			userIds: [payload.porterId, payload.requestedBy],
		});
	}

	/** CTMS-049: classification only; description and coordinates stay behind the authorized API. */
	emitTripIncidentReported(payload: {
		incidentId: string;
		tripId: string;
		hostId: string;
		reporterId: string;
		category: string;
		severity: string;
		occurredAt: string;
	}) {
		this.publish("trip.incident.reported", payload, {
			tripId: payload.tripId,
			userIds: [payload.hostId],
		});
	}

	/** CTMS-086: Broadcast incident handling state changes and assignments to the Host and team. */
	emitTripIncidentUpdated(payload: {
		incidentId: string;
		tripId: string;
		hostId: string;
		status: string;
		assignedTo: string | null;
		updatedAt: string;
	}) {
		const userIds = [payload.hostId];
		if (payload.assignedTo) userIds.push(payload.assignedTo);
		this.publish("trip.incident.updated", payload, { tripId: payload.tripId, userIds });
	}

	/**
	 * CTMS-074 / CTMS-079, BR-260: deliver a newly persisted SOS only to the authorized Host of its Trip.
	 * Receipt is not acknowledgement — acknowledgement stays an explicit CTMS-080 action.
	 */
	/**
	 * CTMS-081, BR-262: deliver a persisted emergency broadcast to the private room of each frozen
	 * recipient (and the Host's other sessions). Trip rooms are not used because a recipient who has not
	 * opened the Trip screen has not subscribed to them.
	 */
	emitEmergencyBroadcast(userIds: string[], payload: EmergencyBroadcastPayload) {
		if (userIds.length === 0) return;
		this.publish("emergency.broadcast", payload, { userIds }, payload.eventId);
	}

	/** CTMS-93: a Trip's forecast risk level changed; only to the Host and booked Campers. */
	emitTripWeatherChanged(
		userIds: string[],
		payload: {
			eventId: string;
			tripId: string;
			tripTitle: string;
			tripStartsAt: string;
			previousRiskLevel: string;
			riskLevel: string;
			createdAt: string;
		}
	) {
		if (userIds.length === 0) return;
		this.publish("trip.weather.changed", payload, { userIds }, payload.eventId);
	}

	/** Weather decision near departure (policy §5): a reminder for the Host or an Admin. */
	emitTripWeatherDecisionRequired(
		userIds: string[],
		payload: {
			alertId: string;
			tripId: string;
			tripTitle: string;
			tripStartsAt: string;
			milestone: string;
			urgency: string;
			message: string;
			createdAt: string;
		}
	) {
		if (userIds.length === 0) return;
		this.publish("trip.weather.decision_required", payload, { userIds });
	}

	/** Weather penalty (policy §6): the Host was penalised because an Admin had to decide. */
	emitHostWeatherPenaltyCreated(
		hostId: string,
		payload: {
			penaltyId: string;
			tripId: string;
			tripTitle: string;
			violationNumber: number;
			amount: string;
			hostingBlockedUntil: string | null;
			waiverDeadline: string;
		}
	) {
		this.publish("host.weather_penalty.created", payload, { userIds: [hostId] });
	}

	/** Weather penalty (policy §6): a Host asked for a force-majeure waiver. */
	emitWeatherPenaltyWaiverRequested(
		adminIds: string[],
		payload: {
			penaltyId: string;
			tripId: string;
			tripTitle: string;
			hostId: string;
			hostName: string | null;
			reviewDueAt: string | null;
		}
	) {
		if (adminIds.length === 0) return;
		this.publish("weather_penalty.waiver_requested", payload, { userIds: adminIds });
	}

	/**
	 * CTMS-090: a Booking changed state after its transaction committed; sent to the Booking owner
	 * (live and as a background push).
	 */
	emitBookingUpdated(userId: string, payload: BookingUpdatedPayload) {
		this.publish("booking.updated", payload, { userIds: [userId] }, payload.eventId);
	}

	emitSosCreated(hostId: string, payload: SosCreatedPayload) {
		this.publish("sos.created", payload, { userIds: [hostId] }, payload.eventId);
	}

	/** CTMS-077 / CTMS-080: SOS state transition, routed only to the Trip Host and the SOS sender. */
	emitSosStateChanged(hostId: string, payload: SosStateChangedPayload) {
		this.publish("sos.state_changed", payload, { userIds: [hostId, payload.senderId] });
	}

	/**
	 * CTMS-083: public seat counts, intentionally the only broadcast anonymous sockets receive
	 * (CTMS-078 decision recorded in the spec).
	 */
	emitTripAvailabilityUpdated(payload: {
		eventId: string;
		tripId: string;
		seatsTaken: number;
		capacityMax: number | null;
		remainingSeats: number | null;
		updatedAt: string;
	}) {
		this.server?.emit("trip.availability.updated", payload);
	}
}

/** Browser clients send `auth: { token }`; non-browser clients may use the Authorization header. */
function extractAccessToken(client: Socket): string | null {
	const auth = client.handshake.auth as { token?: unknown } | undefined;
	if (typeof auth?.token === "string" && auth.token.length > 0) {
		return auth.token.replace(/^Bearer\s+/i, "");
	}
	const header = client.handshake.headers.authorization;
	if (typeof header === "string" && /^Bearer\s+\S+/i.test(header)) {
		return header.replace(/^Bearer\s+/i, "");
	}
	return null;
}
