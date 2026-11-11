import type { JwtService } from "@nestjs/jwt";
import type { Server, Socket } from "socket.io";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import type { GpsParticipationSource } from "../gps-tracking/gps-participation.source";
import { TripStatus } from "../trips/entities/trip.entity";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import type { UsersRepository } from "../users/users.repository";
import {
	EventsGateway,
	RealtimeResumeError,
	type SosCreatedPayload,
	TripRoomError,
	roleRoom,
	tripRoom,
	userRoom,
} from "./events.gateway";
import type { RealtimeEventsService, RecoveryRequest } from "./realtime-events.service";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const HOST_ID = "33333333-3333-4333-8333-333333333333";
const SENDER_ID = "22222222-2222-4222-8222-222222222222";
const TRIP_ID = "44444444-4444-4444-8444-444444444444";

interface FakeSocket {
	id: string;
	disconnected: boolean;
	handshake: { auth: Record<string, unknown>; headers: Record<string, string> };
	emit: jest.Mock;
	join: jest.Mock;
	leave: jest.Mock;
	disconnect: jest.Mock;
	data: Record<string, unknown>;
}

function buildSocket(
	auth: Record<string, unknown> = {},
	headers: Record<string, string> = {}
): FakeSocket {
	const socket: FakeSocket = {
		id: `socket-${Math.random()}`,
		disconnected: false,
		handshake: { auth, headers },
		emit: jest.fn(),
		join: jest.fn().mockResolvedValue(undefined),
		leave: jest.fn().mockResolvedValue(undefined),
		data: {},
		disconnect: jest.fn(() => {
			socket.disconnected = true;
		}),
	};
	return socket;
}

const sosPayload: SosCreatedPayload = {
	eventId: "sos-1",
	sosId: "sos-1",
	tripId: "trip-1",
	senderId: SENDER_ID,
	emergencyType: "medical",
	status: "active",
	eventTime: "2026-11-03T01:00:00.000Z",
	persistedAt: "2026-11-03T01:00:01.000Z",
};

describe("EventsGateway (CTMS-078/CTMS-079, BR-259/BR-260)", () => {
	let gateway: EventsGateway;
	let jwtService: { verifyAsync: jest.Mock };
	let usersRepository: { findOneWithRolesById: jest.Mock; getGrantedRoles: jest.Mock };
	let participation: {
		findTrip: jest.Mock;
		findCamperParticipation: jest.Mock;
		findPorterAssignment: jest.Mock;
	};
	let roomEmit: jest.Mock;
	let server: { to: jest.Mock; emit: jest.Mock };
	let realtimeEvents: {
		record: jest.Mock;
		latestSequence: jest.Mock;
		reconnectPolicy: jest.Mock;
		recover: jest.Mock;
	};
	const reconnect = { initialDelayMs: 1000, maxDelayMs: 30000, multiplier: 2, jitterRatio: 0.2 };

	beforeEach(() => {
		jwtService = {
			verifyAsync: jest
				.fn()
				.mockResolvedValue({ sub: USER_ID, roles: ["host"], exp: Date.now() / 1000 + 900 }),
		};
		usersRepository = {
			findOneWithRolesById: jest.fn().mockResolvedValue({ id: USER_ID, status: UserStatus.ACTIVE }),
			getGrantedRoles: jest.fn().mockReturnValue([UserRole.CAMPER]),
		};
		participation = {
			findTrip: jest.fn().mockResolvedValue({
				id: TRIP_ID,
				hostId: HOST_ID,
				status: TripStatus.ONGOING,
				startsAt: new Date(),
				endsAt: new Date(),
			}),
			findCamperParticipation: jest.fn().mockResolvedValue(null),
			findPorterAssignment: jest.fn().mockResolvedValue(null),
		};
		roomEmit = jest.fn();
		server = { to: jest.fn(() => ({ emit: roomEmit })), emit: jest.fn() };
		realtimeEvents = {
			record: jest.fn(
				async (_name: string, _payload: unknown, _audience: unknown, id?: string) => ({
					eventId: id ?? "generated-event-id",
					sequence: 7,
					emittedAt: "2026-11-10T00:00:00.000Z",
				})
			),
			latestSequence: jest.fn().mockResolvedValue(42),
			reconnectPolicy: jest.fn().mockReturnValue(reconnect),
			recover: jest.fn().mockResolvedValue({ events: [], latestSequence: 42, truncated: false }),
		};
		gateway = new EventsGateway(
			jwtService as unknown as JwtService,
			usersRepository as unknown as UsersRepository,
			participation as unknown as GpsParticipationSource,
			realtimeEvents as unknown as RealtimeEventsService
		);
		gateway.server = server as unknown as Server;
	});

	afterEach(async () => {
		jest.useRealTimers();
		await gateway.onModuleDestroy();
	});

	describe("handleConnection", () => {
		it("joins an authenticated active user only to their own user room", async () => {
			const socket = buildSocket({ token: "valid-token" });

			await gateway.handleConnection(socket as unknown as Socket);

			expect(jwtService.verifyAsync).toHaveBeenCalledWith("valid-token");
			expect(socket.join).toHaveBeenCalledTimes(1);
			expect(socket.join).toHaveBeenCalledWith([userRoom(USER_ID), roleRoom(UserRole.CAMPER)]);
			expect(socket.data.identity).toEqual({ userId: USER_ID, roles: [UserRole.CAMPER] });
			expect(socket.disconnect).not.toHaveBeenCalled();
			expect(socket.emit).toHaveBeenCalledWith(
				"connected",
				expect.objectContaining({ authenticated: true })
			);
		});

		it("accepts a Bearer Authorization header for non-browser clients", async () => {
			const socket = buildSocket({}, { authorization: "Bearer header-token" });

			await gateway.handleConnection(socket as unknown as Socket);

			expect(jwtService.verifyAsync).toHaveBeenCalledWith("header-token");
			expect(socket.join).toHaveBeenCalledWith([userRoom(USER_ID), roleRoom(UserRole.CAMPER)]);
		});

		it("keeps a socket without a token anonymous and out of every private room", async () => {
			const socket = buildSocket();

			await gateway.handleConnection(socket as unknown as Socket);

			expect(jwtService.verifyAsync).not.toHaveBeenCalled();
			expect(socket.join).not.toHaveBeenCalled();
			expect(socket.disconnect).not.toHaveBeenCalled();
			expect(socket.emit).toHaveBeenCalledWith(
				"connected",
				expect.objectContaining({ authenticated: false })
			);
		});

		it("rejects an invalid or expired token", async () => {
			jwtService.verifyAsync.mockRejectedValue(new Error("jwt expired"));
			const socket = buildSocket({ token: "expired-token" });

			await gateway.handleConnection(socket as unknown as Socket);

			expect(socket.join).not.toHaveBeenCalled();
			expect(socket.emit).toHaveBeenCalledWith("auth.error", expect.any(Object));
			expect(socket.disconnect).toHaveBeenCalledWith(true);
		});

		it.each([
			["missing", null],
			["suspended", { id: USER_ID, status: UserStatus.SUSPENDED }],
		])("rejects a valid token whose user is %s", async (_label, user) => {
			usersRepository.findOneWithRolesById.mockResolvedValue(user);
			const socket = buildSocket({ token: "valid-token" });

			await gateway.handleConnection(socket as unknown as Socket);

			expect(socket.join).not.toHaveBeenCalled();
			expect(socket.disconnect).toHaveBeenCalledWith(true);
		});

		it("disconnects the socket when its access token expires", async () => {
			jest.useFakeTimers();
			jwtService.verifyAsync.mockResolvedValue({
				sub: USER_ID,
				roles: ["host"],
				exp: Date.now() / 1000 + 60,
			});
			const socket = buildSocket({ token: "valid-token" });

			await gateway.handleConnection(socket as unknown as Socket);
			expect(socket.disconnect).not.toHaveBeenCalled();

			jest.advanceTimersByTime(60_000);

			expect(socket.emit).toHaveBeenCalledWith("auth.error", expect.any(Object));
			expect(socket.disconnect).toHaveBeenCalledWith(true);
		});

		it("clears the expiry timer when the socket disconnects first", async () => {
			jest.useFakeTimers();
			const socket = buildSocket({ token: "valid-token" });

			await gateway.handleConnection(socket as unknown as Socket);
			gateway.handleDisconnect(socket as unknown as Socket);
			jest.advanceTimersByTime(900_000);

			expect(socket.disconnect).not.toHaveBeenCalled();
		});
	});

	describe("role rooms (CTMS-078, BR-172)", () => {
		it("joins role rooms granted in the database even when the token claims another role", async () => {
			jwtService.verifyAsync.mockResolvedValue({
				sub: USER_ID,
				roles: [UserRole.ADMIN],
				exp: Date.now() / 1000 + 900,
			});
			usersRepository.getGrantedRoles.mockReturnValue([UserRole.HOST, UserRole.CAMPER]);
			const socket = buildSocket({ token: "valid-token" });

			await gateway.handleConnection(socket as unknown as Socket);

			expect(socket.join).toHaveBeenCalledWith([
				userRoom(USER_ID),
				roleRoom(UserRole.HOST),
				roleRoom(UserRole.CAMPER),
			]);
			expect(socket.emit).toHaveBeenCalledWith(
				"connected",
				expect.objectContaining({
					rooms: [userRoom(USER_ID), roleRoom(UserRole.HOST), roleRoom(UserRole.CAMPER)],
				})
			);
		});
	});

	describe("trip.subscribe (CTMS-078 PB AC-4/AC-5)", () => {
		async function connected(userId = USER_ID): Promise<FakeSocket> {
			usersRepository.findOneWithRolesById.mockResolvedValue({
				id: userId,
				status: UserStatus.ACTIVE,
			});
			const socket = buildSocket({ token: "valid-token" });
			await gateway.handleConnection(socket as unknown as Socket);
			socket.join.mockClear();
			return socket;
		}

		it("lets the Trip Host join the Trip room", async () => {
			const socket = await connected(HOST_ID);

			const ack = await gateway.subscribeTrip(socket as unknown as Socket, { tripId: TRIP_ID });

			expect(ack).toEqual({ ok: true, room: tripRoom(TRIP_ID) });
			expect(socket.join).toHaveBeenCalledWith(tripRoom(TRIP_ID));
		});

		it.each([BookingMemberStatus.REGISTERED, BookingMemberStatus.JOINED])(
			"lets a %s Camper join the Trip room",
			async (memberStatus) => {
				participation.findCamperParticipation.mockResolvedValue({
					memberStatus,
					checkedInAt: null,
					leftAt: null,
				});
				const socket = await connected();

				const ack = await gateway.subscribeTrip(socket as unknown as Socket, { tripId: TRIP_ID });

				expect(ack).toEqual({ ok: true, room: tripRoom(TRIP_ID) });
			}
		);

		it("lets an assigned Porter join the Trip room", async () => {
			participation.findPorterAssignment.mockResolvedValue({ assigned: true });
			const socket = await connected();

			const ack = await gateway.subscribeTrip(socket as unknown as Socket, { tripId: TRIP_ID });

			expect(ack).toEqual({ ok: true, room: tripRoom(TRIP_ID) });
		});

		it.each([
			["a Host of another Trip", null, null],
			[
				"a Camper who left",
				{ memberStatus: BookingMemberStatus.LEFT, checkedInAt: null, leftAt: new Date() },
				null,
			],
			[
				"a removed Camper",
				{ memberStatus: BookingMemberStatus.REMOVED, checkedInAt: null, leftAt: null },
				null,
			],
			[
				"a no-show Camper",
				{ memberStatus: BookingMemberStatus.NO_SHOW, checkedInAt: null, leftAt: null },
				null,
			],
			["a Porter who is not assigned", null, { assigned: false }],
		])("refuses %s", async (_label, camper, porter) => {
			participation.findCamperParticipation.mockResolvedValue(camper);
			participation.findPorterAssignment.mockResolvedValue(porter);
			const socket = await connected();

			const ack = await gateway.subscribeTrip(socket as unknown as Socket, { tripId: TRIP_ID });

			expect(ack).toEqual({ ok: false, error: TripRoomError.NOT_TRIP_MEMBER });
			expect(socket.join).not.toHaveBeenCalled();
		});

		it("refuses an unknown Trip", async () => {
			participation.findTrip.mockResolvedValue(null);
			const socket = await connected();

			const ack = await gateway.subscribeTrip(socket as unknown as Socket, { tripId: TRIP_ID });

			expect(ack).toEqual({ ok: false, error: TripRoomError.TRIP_NOT_FOUND });
			expect(socket.join).not.toHaveBeenCalled();
		});

		it.each([undefined, {}, { tripId: 42 }, { tripId: "not-a-uuid" }, { tripId: `${TRIP_ID}x` }])(
			"rejects a malformed request %p without touching the database",
			async (body) => {
				const socket = await connected();

				const ack = await gateway.subscribeTrip(
					socket as unknown as Socket,
					body as { tripId?: unknown }
				);

				expect(ack).toEqual({ ok: false, error: TripRoomError.INVALID_TRIP_ID });
				expect(participation.findTrip).not.toHaveBeenCalled();
				expect(socket.join).not.toHaveBeenCalled();
			}
		);

		it("refuses an anonymous socket even for a real Trip", async () => {
			const socket = buildSocket();
			await gateway.handleConnection(socket as unknown as Socket);

			const ack = await gateway.subscribeTrip(socket as unknown as Socket, { tripId: TRIP_ID });

			expect(ack).toEqual({ ok: false, error: TripRoomError.NOT_AUTHENTICATED });
			expect(participation.findTrip).not.toHaveBeenCalled();
			expect(socket.join).not.toHaveBeenCalled();
		});

		it("does not join when the socket was dropped while authorization was running", async () => {
			const socket = await connected(HOST_ID);
			participation.findTrip.mockImplementation(async () => {
				socket.disconnected = true;
				return { id: TRIP_ID, hostId: HOST_ID, status: TripStatus.ONGOING };
			});

			const ack = await gateway.subscribeTrip(socket as unknown as Socket, { tripId: TRIP_ID });

			expect(ack).toEqual({ ok: false, error: TripRoomError.NOT_AUTHENTICATED });
			expect(socket.join).not.toHaveBeenCalled();
		});

		it("leaves the Trip room on trip.unsubscribe", async () => {
			const socket = await connected(HOST_ID);

			const ack = await gateway.unsubscribeTrip(socket as unknown as Socket, { tripId: TRIP_ID });

			expect(ack).toEqual({ ok: true, room: tripRoom(TRIP_ID) });
			expect(socket.leave).toHaveBeenCalledWith(tripRoom(TRIP_ID));
		});
	});

	describe("scoped event routing (CTMS-078 invariant: protected events never broadcast)", () => {
		const PORTER_ID = "55555555-5555-4555-8555-555555555555";
		const STAFF_ID = "66666666-6666-4666-8666-666666666666";

		it.each([
			[
				"trip.review.requested",
				(g: EventsGateway) =>
					g.emitTripReviewRequested({
						tripId: TRIP_ID,
						title: "T",
						hostId: HOST_ID,
						submittedAt: "s",
						deadlineAt: "d",
					}),
				[roleRoom(UserRole.ADMIN)],
			],
			[
				"trip.review.updated",
				(g: EventsGateway) =>
					g.emitTripReviewUpdated({ tripId: TRIP_ID, title: "T", hostId: HOST_ID, updatedAt: "u" }),
				[roleRoom(UserRole.ADMIN)],
			],
			[
				"trip.review.reminder",
				(g: EventsGateway) =>
					g.emitTripReviewReminder({
						tripId: TRIP_ID,
						title: "T",
						hostId: HOST_ID,
						submittedAt: "s",
						deadlineAt: "d",
					}),
				[roleRoom(UserRole.ADMIN)],
			],
			[
				"trip.review.auto_rejected",
				(g: EventsGateway) =>
					g.emitTripReviewAutoRejected({
						tripId: TRIP_ID,
						title: "T",
						hostId: HOST_ID,
						rejectedAt: "r",
						reason: "x",
					}),
				[userRoom(HOST_ID), roleRoom(UserRole.ADMIN)],
			],
			[
				"porter.request.created",
				(g: EventsGateway) =>
					g.emitPorterRequestCreated({
						requestId: "r",
						tripId: TRIP_ID,
						porterId: PORTER_ID,
						requestedBy: HOST_ID,
						requestedRole: "guide",
						expiresAt: "e",
					}),
				[userRoom(PORTER_ID), userRoom(HOST_ID)],
			],
			[
				"porter.request.state_changed",
				(g: EventsGateway) =>
					g.emitPorterRequestStateChanged({
						requestId: "r",
						tripId: TRIP_ID,
						porterId: PORTER_ID,
						requestedBy: HOST_ID,
						status: "accepted",
						respondedAt: null,
					}),
				[userRoom(PORTER_ID), userRoom(HOST_ID)],
			],
			[
				"trip.incident.reported",
				(g: EventsGateway) =>
					g.emitTripIncidentReported({
						incidentId: "i",
						tripId: TRIP_ID,
						hostId: HOST_ID,
						reporterId: SENDER_ID,
						category: "c",
						severity: "s",
						occurredAt: "o",
					}),
				[tripRoom(TRIP_ID), userRoom(HOST_ID)],
			],
			[
				"trip.incident.updated",
				(g: EventsGateway) =>
					g.emitTripIncidentUpdated({
						incidentId: "i",
						tripId: TRIP_ID,
						hostId: HOST_ID,
						status: "in_progress",
						assignedTo: STAFF_ID,
						updatedAt: "u",
					}),
				[tripRoom(TRIP_ID), userRoom(HOST_ID), userRoom(STAFF_ID)],
			],
		])("routes %s only to its authorized rooms", async (event, emit, rooms) => {
			emit(gateway);
			await gateway.flushPublished();

			expect(server.to).toHaveBeenCalledWith(rooms);
			expect(roomEmit).toHaveBeenCalledWith(
				event,
				expect.any(Object),
				expect.objectContaining({ eventId: expect.any(String), sequence: 7 })
			);
			expect(server.emit).not.toHaveBeenCalled();
		});

		it("does not add an assignee room to an unassigned incident update", async () => {
			gateway.emitTripIncidentUpdated({
				incidentId: "i",
				tripId: TRIP_ID,
				hostId: HOST_ID,
				status: "open",
				assignedTo: null,
				updatedAt: "u",
			});
			await gateway.flushPublished();

			expect(server.to).toHaveBeenCalledWith([tripRoom(TRIP_ID), userRoom(HOST_ID)]);
		});

		it("keeps public Trip availability as the only global broadcast", () => {
			const payload = {
				eventId: "e",
				tripId: TRIP_ID,
				seatsTaken: 1,
				capacityMax: 10,
				remainingSeats: 9,
				updatedAt: "u",
			};

			gateway.emitTripAvailabilityUpdated(payload);

			expect(server.emit).toHaveBeenCalledWith("trip.availability.updated", payload);
		});
	});

	describe("SOS routing", () => {
		it("delivers sos.created only to the Trip Host room, never as a global broadcast", async () => {
			gateway.emitSosCreated(HOST_ID, sosPayload);
			await gateway.flushPublished();

			expect(server.to).toHaveBeenCalledWith([userRoom(HOST_ID)]);
			// CTMS-082: the SOS keeps its own event id, so live and recovered copies dedupe.
			expect(roomEmit).toHaveBeenCalledWith(
				"sos.created",
				sosPayload,
				expect.objectContaining({ eventId: sosPayload.eventId })
			);
			expect(server.emit).not.toHaveBeenCalled();
		});

		it("delivers sos.state_changed only to the Trip Host and the SOS sender rooms", async () => {
			const payload = { sosId: "sos-1", tripId: "trip-1", senderId: SENDER_ID, status: "closed" };

			gateway.emitSosStateChanged(HOST_ID, payload);
			await gateway.flushPublished();

			expect(server.to).toHaveBeenCalledWith([userRoom(HOST_ID), userRoom(SENDER_ID)]);
			expect(roomEmit).toHaveBeenCalledWith("sos.state_changed", payload, expect.any(Object));
			expect(server.emit).not.toHaveBeenCalled();
		});
	});

	describe("missed-event recovery (CTMS-082, BR-263/BR-259)", () => {
		it("stores each protected event with its frozen audience before sending it live", async () => {
			gateway.emitTripIncidentUpdated({
				incidentId: "i",
				tripId: TRIP_ID,
				hostId: HOST_ID,
				status: "in_progress",
				assignedTo: SENDER_ID,
				updatedAt: "u",
			});
			expect(roomEmit).not.toHaveBeenCalled();
			await gateway.flushPublished();

			expect(realtimeEvents.record).toHaveBeenCalledWith(
				"trip.incident.updated",
				expect.objectContaining({ incidentId: "i" }),
				{ userIds: [HOST_ID, SENDER_ID], roles: [], tripId: TRIP_ID },
				undefined
			);
			expect(roomEmit).toHaveBeenCalledWith(
				"trip.incident.updated",
				expect.objectContaining({ incidentId: "i" }),
				{ eventId: "generated-event-id", sequence: 7, emittedAt: "2026-11-10T00:00:00.000Z" }
			);
		});

		it("keeps the weather event id as the real-time event id", async () => {
			gateway.emitTripWeatherChanged([USER_ID, USER_ID], {
				eventId: "weather-event-1",
				tripId: TRIP_ID,
				tripTitle: "T",
				tripStartsAt: "s",
				previousRiskLevel: "green",
				riskLevel: "red",
				createdAt: "c",
			});
			await gateway.flushPublished();

			expect(realtimeEvents.record).toHaveBeenCalledWith(
				"trip.weather.changed",
				expect.any(Object),
				{ userIds: [USER_ID], roles: [], tripId: null },
				"weather-event-1"
			);
		});

		it("still delivers live when storing fails (only recovery is lost)", async () => {
			realtimeEvents.record.mockResolvedValueOnce({
				eventId: "e-1",
				sequence: null,
				emittedAt: "2026-11-10T00:00:00.000Z",
			});
			gateway.emitHostWeatherPenaltyCreated(HOST_ID, {
				penaltyId: "p",
				tripId: TRIP_ID,
				tripTitle: "T",
				violationNumber: 1,
				amount: "1.00",
				hostingBlockedUntil: null,
				waiverDeadline: "w",
			});
			await gateway.flushPublished();

			expect(roomEmit).toHaveBeenCalledWith(
				"host.weather_penalty.created",
				expect.any(Object),
				expect.objectContaining({ eventId: "e-1", sequence: null })
			);
		});

		it("sends the cursor and the bounded backoff in the connected event", async () => {
			const socket = buildSocket({ token: "valid-token" });
			await gateway.handleConnection(socket as unknown as Socket);

			expect(socket.emit).toHaveBeenCalledWith(
				"connected",
				expect.objectContaining({ authenticated: true, latestSequence: 42, reconnect })
			);

			const anonymous = buildSocket();
			await gateway.handleConnection(anonymous as unknown as Socket);
			expect(anonymous.emit).toHaveBeenCalledWith(
				"connected",
				expect.objectContaining({ authenticated: false, latestSequence: null, reconnect })
			);
		});

		it("still connects with a null cursor when the event store is unavailable", async () => {
			realtimeEvents.latestSequence.mockRejectedValueOnce(new Error("db down"));
			const socket = buildSocket({ token: "valid-token" });
			await gateway.handleConnection(socket as unknown as Socket);

			expect(socket.disconnect).not.toHaveBeenCalled();
			expect(socket.emit).toHaveBeenCalledWith(
				"connected",
				expect.objectContaining({ authenticated: true, latestSequence: null })
			);
		});

		it("refuses resume from an anonymous socket", async () => {
			const socket = buildSocket();
			await gateway.handleConnection(socket as unknown as Socket);

			await expect(
				gateway.resume(socket as unknown as Socket, { afterSequence: 0 })
			).resolves.toEqual({ ok: false, error: RealtimeResumeError.NOT_AUTHENTICATED });
			expect(realtimeEvents.recover).not.toHaveBeenCalled();
		});

		it.each([[undefined], [-1], [1.5], ["3"]])(
			"refuses the invalid cursor %p",
			async (afterSequence) => {
				const socket = buildSocket({ token: "valid-token" });
				await gateway.handleConnection(socket as unknown as Socket);

				await expect(
					gateway.resume(socket as unknown as Socket, { afterSequence })
				).resolves.toEqual({ ok: false, error: RealtimeResumeError.INVALID_CURSOR });
			}
		);

		it("recovers with the roles and Trip membership the user has now", async () => {
			const socket = buildSocket({ token: "valid-token" });
			await gateway.handleConnection(socket as unknown as Socket);
			// Granted again from the database at resume time, not taken from the connect-time session.
			usersRepository.getGrantedRoles.mockReturnValue([UserRole.CAMPER, UserRole.ADMIN]);
			const recovered = {
				events: [
					{
						event: "trip.review.requested",
						payload: { tripId: TRIP_ID },
						meta: { eventId: "e-9", sequence: 9, emittedAt: "x" },
					},
				],
				latestSequence: 9,
				truncated: false,
			};
			realtimeEvents.recover.mockResolvedValueOnce(recovered);

			await expect(
				gateway.resume(socket as unknown as Socket, { afterSequence: 5 })
			).resolves.toEqual({ ok: true, ...recovered });

			const request = realtimeEvents.recover.mock.calls[0][0] as RecoveryRequest;
			expect(request).toEqual(
				expect.objectContaining({
					afterSequence: 5,
					userId: USER_ID,
					roles: [UserRole.CAMPER, UserRole.ADMIN],
				})
			);
			participation.findCamperParticipation.mockResolvedValueOnce({
				memberStatus: BookingMemberStatus.JOINED,
			});
			await expect(request.isTripMember(TRIP_ID)).resolves.toBe(true);
			participation.findCamperParticipation.mockResolvedValueOnce({
				memberStatus: BookingMemberStatus.LEFT,
			});
			await expect(request.isTripMember(TRIP_ID)).resolves.toBe(false);
		});

		it("rejects the socket when the account is no longer active at resume", async () => {
			const socket = buildSocket({ token: "valid-token" });
			await gateway.handleConnection(socket as unknown as Socket);
			usersRepository.findOneWithRolesById.mockResolvedValueOnce({
				id: USER_ID,
				status: UserStatus.SUSPENDED,
			});

			await expect(
				gateway.resume(socket as unknown as Socket, { afterSequence: 0 })
			).resolves.toEqual({ ok: false, error: RealtimeResumeError.NOT_AUTHENTICATED });
			expect(socket.emit).toHaveBeenCalledWith("auth.error", expect.any(Object));
			expect(socket.disconnect).toHaveBeenCalledWith(true);
			expect(realtimeEvents.recover).not.toHaveBeenCalled();
		});
	});
});
