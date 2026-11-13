import type { JwtService } from "@nestjs/jwt";
import type { Server, Socket } from "socket.io";
import type { GpsParticipationSource } from "../gps-tracking/gps-participation.source";
import type { PushNotificationsService } from "../push-notifications/push-notifications.service";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import type { UsersRepository } from "../users/users.repository";
import { EventsGateway, userRoom } from "./events.gateway";
import type { RealtimeEventsService } from "./realtime-events.service";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "55555555-5555-4555-8555-555555555555";

function socket(): Socket {
	return {
		id: `socket-${Math.random()}`,
		disconnected: false,
		handshake: { auth: { token: "t" }, headers: {} },
		emit: jest.fn(),
		join: jest.fn().mockResolvedValue(undefined),
		data: {},
		disconnect: jest.fn(),
	} as unknown as Socket;
}

describe("EventsGateway evaluation hooks (CTMS-100, BR-265)", () => {
	let gateway: EventsGateway;
	let roomEmit: jest.Mock;
	let server: { to: jest.Mock };
	let record: jest.Mock;
	let pushes: { enqueueForEvent: jest.Mock };

	beforeEach(() => {
		roomEmit = jest.fn();
		server = { to: jest.fn(() => ({ emit: roomEmit })) };
		record = jest.fn(async () => ({
			eventId: EVENT_ID,
			sequence: 9,
			emittedAt: "2026-11-13T00:00:00.000Z",
		}));
		pushes = { enqueueForEvent: jest.fn().mockResolvedValue(0) };
		gateway = new EventsGateway(
			{ verifyAsync: jest.fn().mockResolvedValue({ sub: USER_ID }) } as unknown as JwtService,
			{
				findOneWithRolesById: jest
					.fn()
					.mockResolvedValue({ id: USER_ID, status: UserStatus.ACTIVE }),
				getGrantedRoles: jest.fn().mockReturnValue([UserRole.CAMPER]),
			} as unknown as UsersRepository,
			{} as GpsParticipationSource,
			{
				record,
				latestSequence: jest.fn().mockResolvedValue(1),
				reconnectPolicy: jest.fn().mockReturnValue({}),
			} as unknown as RealtimeEventsService,
			pushes as unknown as PushNotificationsService
		);
		gateway.server = server as unknown as Server;
	});

	it("publishes an evaluation probe through the stored path, only to the given users", async () => {
		gateway.emitEvaluationProbe("evaluation.probe.sos", [USER_ID], { probe: true, index: 3 });
		await gateway.flushPublished();
		expect(record).toHaveBeenCalledWith(
			"evaluation.probe.sos",
			{ probe: true, index: 3 },
			{ userIds: [USER_ID], roles: [], tripId: null },
			undefined
		);
		expect(server.to).toHaveBeenCalledWith([userRoom(USER_ID)]);
		expect(roomEmit).toHaveBeenCalledWith(
			"evaluation.probe.sos",
			{ probe: true, index: 3 },
			expect.objectContaining({ eventId: EVENT_ID, sequence: 9 })
		);
	});

	it("acknowledges a delivery only for an authenticated socket and a valid event id", async () => {
		const anonymous = socket();
		expect(gateway.acknowledgeDelivery(anonymous, { eventId: EVENT_ID })).toEqual({
			ok: false,
			error: "NOT_AUTHENTICATED",
		});

		const client = socket();
		await gateway.handleConnection(client);
		expect(gateway.acknowledgeDelivery(client, { eventId: "nope" })).toEqual({
			ok: false,
			error: "INVALID_EVENT_ID",
		});
		const before = Date.now();
		const ack = gateway.acknowledgeDelivery(client, { eventId: EVENT_ID });
		expect(ack.ok).toBe(true);
		if (ack.ok) expect(Date.parse(ack.acknowledgedAt)).toBeGreaterThanOrEqual(before);
		gateway.handleDisconnect(client);
	});
});
