import { Logger, type OnModuleDestroy } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { JwtService } from "@nestjs/jwt";
import {
	type OnGatewayConnection,
	type OnGatewayDisconnect,
	WebSocketGateway,
	WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import type { JwtPayload } from "../auth/jwt.strategy";
import { UserStatus } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { UsersRepository } from "../users/users.repository";

/** CTMS-079, BR-259: private room an authenticated socket joins; only its own user is ever joined. */
export function userRoom(userId: string): string {
	return `user:${userId}`;
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
		private readonly usersRepository: UsersRepository
	) {}

	/**
	 * CTMS-079, BR-259: a socket that presents an access token is authenticated and joined only to its
	 * own user room; an invalid/expired token or a non-active user is rejected. A socket without a token
	 * stays anonymous (public broadcasts only, e.g. CTMS-083 availability) and never joins a private room.
	 */
	async handleConnection(client: Socket) {
		const token = extractAccessToken(client);
		if (!token) {
			client.emit("connected", {
				message: "Connected to CTMS real-time gateway",
				authenticated: false,
			});
			return;
		}

		try {
			const payload = await this.jwtService.verifyAsync<JwtPayload & { exp?: number }>(token);
			const user = await this.usersRepository.findOneWithRolesById(payload.sub);
			if (!user || user.status !== UserStatus.ACTIVE) {
				throw new Error("User is not active");
			}
			if (client.disconnected) return;

			await client.join(userRoom(user.id));
			const session: SocketSession = { userId: user.id };
			if (payload.exp) {
				// The socket must not outlive the access token; the client reconnects with a fresh one.
				session.expiryTimer = setTimeout(
					() => this.rejectSocket(client),
					Math.max(0, payload.exp * 1000 - Date.now())
				);
			}
			this.sessions.set(client.id, session);
			client.emit("connected", {
				message: "Connected to CTMS real-time gateway",
				authenticated: true,
			});
		} catch {
			this.rejectSocket(client);
		}
	}

	handleDisconnect(client: Socket) {
		const session = this.sessions.get(client.id);
		if (session?.expiryTimer) clearTimeout(session.expiryTimer);
		this.sessions.delete(client.id);
	}

	onModuleDestroy() {
		for (const session of this.sessions.values()) {
			if (session.expiryTimer) clearTimeout(session.expiryTimer);
		}
		this.sessions.clear();
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
		this.server?.emit("trip.review.updated", payload);
	}

	emitTripReviewRequested(payload: {
		tripId: string;
		title: string;
		hostId: string;
		submittedAt: string;
		deadlineAt: string;
	}) {
		this.server?.emit("trip.review.requested", payload);
	}

	emitTripReviewReminder(payload: {
		tripId: string;
		title: string;
		hostId: string;
		submittedAt: string;
		deadlineAt: string;
	}) {
		this.server?.emit("trip.review.reminder", payload);
	}

	emitTripReviewAutoRejected(payload: {
		tripId: string;
		title: string;
		hostId: string;
		rejectedAt: string;
		reason: string;
	}) {
		this.server?.emit("trip.review.auto_rejected", payload);
	}

	emitPorterRequestCreated(payload: {
		requestId: string;
		tripId: string;
		porterId: string;
		requestedBy: string;
		requestedRole: string;
		expiresAt: string;
	}) {
		this.server?.emit("porter.request.created", payload);
	}

	emitPorterRequestStateChanged(payload: {
		requestId: string;
		tripId: string;
		porterId: string;
		requestedBy: string;
		status: string;
		respondedAt: string | null;
	}) {
		this.server?.emit("porter.request.state_changed", payload);
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
		this.server?.emit("trip.incident.reported", payload);
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
		this.server?.emit("trip.incident.updated", payload);
	}

	/**
	 * CTMS-074 / CTMS-079, BR-260: deliver a newly persisted SOS only to the authorized Host of its Trip.
	 * Receipt is not acknowledgement — acknowledgement stays an explicit CTMS-080 action.
	 */
	emitSosCreated(hostId: string, payload: SosCreatedPayload) {
		this.server?.to(userRoom(hostId)).emit("sos.created", payload);
	}

	/** CTMS-077 / CTMS-080: SOS state transition, routed only to the Trip Host and the SOS sender. */
	emitSosStateChanged(hostId: string, payload: SosStateChangedPayload) {
		this.server
			?.to([userRoom(hostId), userRoom(payload.senderId)])
			.emit("sos.state_changed", payload);
	}

	/** CTMS-083: Broadcast trip capacity and availability changes to connected clients in real time. */
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
