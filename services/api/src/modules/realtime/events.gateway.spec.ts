import type { JwtService } from "@nestjs/jwt";
import type { Server, Socket } from "socket.io";
import { UserStatus } from "../users/entities/user.entity";
import type { UsersRepository } from "../users/users.repository";
import { EventsGateway, type SosCreatedPayload, userRoom } from "./events.gateway";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const HOST_ID = "33333333-3333-4333-8333-333333333333";
const SENDER_ID = "22222222-2222-4222-8222-222222222222";

interface FakeSocket {
	id: string;
	disconnected: boolean;
	handshake: { auth: Record<string, unknown>; headers: Record<string, string> };
	emit: jest.Mock;
	join: jest.Mock;
	disconnect: jest.Mock;
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

describe("EventsGateway (CTMS-079, BR-259/BR-260)", () => {
	let gateway: EventsGateway;
	let jwtService: { verifyAsync: jest.Mock };
	let usersRepository: { findOneWithRolesById: jest.Mock };
	let roomEmit: jest.Mock;
	let server: { to: jest.Mock; emit: jest.Mock };

	beforeEach(() => {
		jwtService = {
			verifyAsync: jest
				.fn()
				.mockResolvedValue({ sub: USER_ID, roles: ["host"], exp: Date.now() / 1000 + 900 }),
		};
		usersRepository = {
			findOneWithRolesById: jest.fn().mockResolvedValue({ id: USER_ID, status: UserStatus.ACTIVE }),
		};
		roomEmit = jest.fn();
		server = { to: jest.fn(() => ({ emit: roomEmit })), emit: jest.fn() };
		gateway = new EventsGateway(
			jwtService as unknown as JwtService,
			usersRepository as unknown as UsersRepository
		);
		gateway.server = server as unknown as Server;
	});

	afterEach(() => {
		gateway.onModuleDestroy();
		jest.useRealTimers();
	});

	describe("handleConnection", () => {
		it("joins an authenticated active user only to their own user room", async () => {
			const socket = buildSocket({ token: "valid-token" });

			await gateway.handleConnection(socket as unknown as Socket);

			expect(jwtService.verifyAsync).toHaveBeenCalledWith("valid-token");
			expect(socket.join).toHaveBeenCalledTimes(1);
			expect(socket.join).toHaveBeenCalledWith(userRoom(USER_ID));
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
			expect(socket.join).toHaveBeenCalledWith(userRoom(USER_ID));
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

	describe("SOS routing", () => {
		it("delivers sos.created only to the Trip Host room, never as a global broadcast", () => {
			gateway.emitSosCreated(HOST_ID, sosPayload);

			expect(server.to).toHaveBeenCalledWith(userRoom(HOST_ID));
			expect(roomEmit).toHaveBeenCalledWith("sos.created", sosPayload);
			expect(server.emit).not.toHaveBeenCalled();
		});

		it("delivers sos.state_changed only to the Trip Host and the SOS sender rooms", () => {
			const payload = { sosId: "sos-1", tripId: "trip-1", senderId: SENDER_ID, status: "closed" };

			gateway.emitSosStateChanged(HOST_ID, payload);

			expect(server.to).toHaveBeenCalledWith([userRoom(HOST_ID), userRoom(SENDER_ID)]);
			expect(roomEmit).toHaveBeenCalledWith("sos.state_changed", payload);
			expect(server.emit).not.toHaveBeenCalled();
		});
	});
});
