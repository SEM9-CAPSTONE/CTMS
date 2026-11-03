import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
import type { CancelSosDto } from "./dto/cancel-sos.dto";
import type { CloseSosDto } from "./dto/close-sos.dto";
import type { CreateSosDto } from "./dto/create-sos.dto";
import type { SosAlertResponseDto } from "./dto/sos-alert-response.dto";
import { SosController } from "./sos.controller";
import { EmergencyType, SosStatus } from "./sos.enums";
import type { SosService } from "./sos.service";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const HOST_ID = "33333333-3333-4333-8333-333333333333";
const TRIP_ID = "44444444-4444-4444-8444-444444444444";
const SOS_ID = "55555555-5555-4555-8555-555555555555";

describe("SosController", () => {
	let controller: SosController;
	let sosService: {
		createSos: jest.Mock;
		cancel: jest.Mock;
		acknowledge: jest.Mock;
		close: jest.Mock;
		listForTrip: jest.Mock;
	};

	const camperUser: AuthenticatedUser = {
		userId: USER_ID,
		email: "camper@ctms.local",
		phone: "+84901234567",
		roles: [UserRole.CAMPER],
	};

	const hostUser: AuthenticatedUser = {
		userId: HOST_ID,
		email: "host@ctms.local",
		phone: "+84909999999",
		roles: [UserRole.HOST],
	};

	const sampleResponse: SosAlertResponseDto = {
		id: SOS_ID,
		tripId: TRIP_ID,
		senderId: USER_ID,
		emergencyType: EmergencyType.MEDICAL,
		location: { latitude: 16.05, longitude: 108.2 },
		batteryLevel: 90,
		eventTime: "2026-10-27T03:00:00.000Z",
		status: SosStatus.CANCELLED,
		cancelledBy: USER_ID,
		cancelledAt: "2026-10-27T03:05:00.000Z",
		cancellationReason: "False alarm",
		acknowledgedBy: null,
		acknowledgedAt: null,
		closedBy: null,
		closedAt: null,
		resolutionNote: null,
		receivedAt: "2026-10-27T03:00:01.000Z",
		createdAt: "2026-10-27T03:00:01.000Z",
		updatedAt: "2026-10-27T03:05:00.000Z",
	};

	const acknowledgedResponse: SosAlertResponseDto = {
		...sampleResponse,
		status: SosStatus.ACKNOWLEDGED,
		cancelledBy: null,
		cancelledAt: null,
		cancellationReason: null,
		acknowledgedBy: HOST_ID,
		acknowledgedAt: "2026-10-27T03:02:00.000Z",
	};

	const closedResponse: SosAlertResponseDto = {
		...acknowledgedResponse,
		status: SosStatus.CLOSED,
		closedBy: HOST_ID,
		closedAt: "2026-10-27T04:00:00.000Z",
		resolutionNote: "Camper recovered safely by medical team",
	};

	beforeEach(() => {
		sosService = {
			createSos: jest.fn().mockResolvedValue(sampleResponse),
			cancel: jest.fn().mockResolvedValue(sampleResponse),
			acknowledge: jest.fn().mockResolvedValue(acknowledgedResponse),
			close: jest.fn().mockResolvedValue(closedResponse),
			listForTrip: jest.fn().mockResolvedValue([sampleResponse]),
		};

		controller = new SosController(sosService as unknown as SosService);
	});

	it("POST /trips/:tripId/sos delegates to sosService.createSos", async () => {
		const dto: CreateSosDto = {
			emergencyType: EmergencyType.MEDICAL,
			location: { latitude: 16.05, longitude: 108.2 },
			batteryLevel: 90,
			eventTime: "2026-10-27T03:00:00.000Z",
		};

		const result = await controller.create({ user: camperUser }, TRIP_ID, dto);

		expect(result).toEqual(sampleResponse);
		expect(sosService.createSos).toHaveBeenCalledWith(USER_ID, TRIP_ID, dto);
	});

	it("PATCH /trips/:tripId/sos/:sosId/cancel delegates to sosService.cancel", async () => {
		const dto: CancelSosDto = {
			reason: "Accidentally clicked button",
		};

		const result = await controller.cancel({ user: camperUser }, TRIP_ID, SOS_ID, dto);

		expect(result).toEqual(sampleResponse);
		expect(sosService.cancel).toHaveBeenCalledWith(USER_ID, TRIP_ID, SOS_ID, dto);
	});

	it("PATCH /trips/:tripId/sos/:sosId/acknowledge delegates to sosService.acknowledge", async () => {
		const result = await controller.acknowledge({ user: hostUser }, TRIP_ID, SOS_ID);

		expect(result).toEqual(acknowledgedResponse);
		expect(sosService.acknowledge).toHaveBeenCalledWith(HOST_ID, TRIP_ID, SOS_ID);
	});

	it("PATCH /trips/:tripId/sos/:sosId/close delegates to sosService.close", async () => {
		const dto: CloseSosDto = {
			resolutionNote: "Camper recovered safely by medical team",
		};

		const result = await controller.close({ user: hostUser }, TRIP_ID, SOS_ID, dto);

		expect(result).toEqual(closedResponse);
		expect(sosService.close).toHaveBeenCalledWith(HOST_ID, TRIP_ID, SOS_ID, dto);
	});

	it("GET /trips/:tripId/sos delegates to sosService.listForTrip", async () => {
		const result = await controller.list({ user: camperUser }, TRIP_ID);

		expect(result).toEqual([sampleResponse]);
		expect(sosService.listForTrip).toHaveBeenCalledWith(USER_ID, TRIP_ID);
	});
});
