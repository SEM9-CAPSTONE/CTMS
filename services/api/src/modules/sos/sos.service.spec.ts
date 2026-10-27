import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { DataSource, EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import type {
	CamperParticipation,
	GpsParticipationSource,
	TrackedTrip,
} from "../gps-tracking/gps-participation.source";
import type { EventsGateway } from "../realtime/events.gateway";
import { TripStatus } from "../trips/entities/trip.entity";
import type { CancelSosDto } from "./dto/cancel-sos.dto";
import type { CreateSosDto } from "./dto/create-sos.dto";
import { SosAlert } from "./entities/sos-alert.entity";
import type { SosAlertsRepository } from "./sos-alerts.repository";
import { EmergencyType, SosErrorCode, SosStatus } from "./sos.enums";
import { SosService } from "./sos.service";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const HOST_ID = "33333333-3333-4333-8333-333333333333";
const TRIP_ID = "44444444-4444-4444-8444-444444444444";
const SOS_ID = "55555555-5555-4555-8555-555555555555";

function buildTrip(overrides: Partial<TrackedTrip> = {}): TrackedTrip {
	return {
		id: TRIP_ID,
		hostId: HOST_ID,
		status: TripStatus.ONGOING,
		startsAt: new Date("2026-10-27T01:00:00.000Z"),
		endsAt: new Date("2026-10-27T09:00:00.000Z"),
		...overrides,
	};
}

function buildCamper(overrides: Partial<CamperParticipation> = {}): CamperParticipation {
	return {
		memberStatus: BookingMemberStatus.JOINED,
		checkedInAt: new Date("2026-10-27T00:30:00.000Z"),
		leftAt: null,
		...overrides,
	};
}

function buildSosAlert(overrides: Partial<SosAlert> = {}): SosAlert {
	const alert = new SosAlert();
	alert.id = SOS_ID;
	alert.tripId = TRIP_ID;
	alert.senderId = USER_ID;
	alert.emergencyType = EmergencyType.MEDICAL;
	alert.location = { type: "Point", coordinates: [108.2, 16.05] };
	alert.batteryLevel = 80;
	alert.eventTime = new Date("2026-10-27T03:00:00.000Z");
	alert.status = SosStatus.ACTIVE;
	alert.cancelledBy = null;
	alert.cancelledAt = null;
	alert.cancellationReason = null;
	alert.acknowledgedBy = null;
	alert.acknowledgedAt = null;
	alert.closedBy = null;
	alert.closedAt = null;
	alert.resolutionNote = null;
	alert.receivedAt = new Date("2026-10-27T03:00:01.000Z");
	alert.createdAt = new Date("2026-10-27T03:00:01.000Z");
	alert.updatedAt = new Date("2026-10-27T03:00:01.000Z");
	return Object.assign(alert, overrides);
}

describe("SosService", () => {
	let service: SosService;
	let sosRepository: {
		findById: jest.Mock;
		findForUpdate: jest.Mock;
		findByTripId: jest.Mock;
		save: jest.Mock;
		create: jest.Mock;
	};
	let participation: {
		findTrip: jest.Mock;
		findCamperParticipation: jest.Mock;
		findPorterAssignment: jest.Mock;
	};
	let eventsGateway: {
		emitSosCreated: jest.Mock;
		emitSosStateChanged: jest.Mock;
	};
	let auditRepository: {
		save: jest.Mock;
	};
	let alertRepositoryMock: {
		save: jest.Mock;
	};
	let dataSource: {
		transaction: jest.Mock;
		getRepository: jest.Mock;
	};

	beforeEach(() => {
		sosRepository = {
			findById: jest.fn(),
			findForUpdate: jest.fn(),
			findByTripId: jest.fn(),
			save: jest.fn((alert: SosAlert) => Promise.resolve(alert)),
			create: jest.fn((data: Partial<SosAlert>) => Object.assign(new SosAlert(), data)),
		};

		participation = {
			findTrip: jest.fn().mockResolvedValue(buildTrip()),
			findCamperParticipation: jest.fn().mockResolvedValue(buildCamper()),
			findPorterAssignment: jest.fn().mockResolvedValue(null),
		};

		eventsGateway = {
			emitSosCreated: jest.fn(),
			emitSosStateChanged: jest.fn(),
		};

		auditRepository = {
			save: jest.fn().mockResolvedValue(undefined),
		};

		alertRepositoryMock = {
			save: jest.fn((alert: SosAlert) => Promise.resolve(alert)),
		};

		const manager = {
			getRepository: (entity: unknown) => {
				if (entity === SosAlert) return alertRepositoryMock;
				if (entity === AuditLog) return auditRepository;
				throw new Error("Unexpected entity repository request in test");
			},
		} as unknown as EntityManager;

		dataSource = {
			transaction: jest.fn(async (run: (m: EntityManager) => Promise<unknown>) => run(manager)),
			getRepository: jest.fn((entity: unknown) => {
				if (entity === AuditLog) return auditRepository;
				if (entity === SosAlert) return alertRepositoryMock;
				throw new Error("Unexpected getRepository request in test");
			}),
		};

		service = new SosService(
			sosRepository as unknown as SosAlertsRepository,
			participation as unknown as GpsParticipationSource,
			eventsGateway as unknown as EventsGateway,
			dataSource as unknown as DataSource
		);
	});

	describe("createSos", () => {
		const createDto: CreateSosDto = {
			emergencyType: EmergencyType.MEDICAL,
			location: { latitude: 16.05, longitude: 108.2 },
			batteryLevel: 75,
			eventTime: "2026-10-27T03:00:00.000Z",
		};

		it("creates SOS alert in ACTIVE state, records audit log, and emits socket event", async () => {
			const result = await service.createSos(USER_ID, TRIP_ID, createDto);

			expect(result.status).toBe(SosStatus.ACTIVE);
			expect(result.senderId).toBe(USER_ID);
			expect(result.tripId).toBe(TRIP_ID);
			expect(result.emergencyType).toBe(EmergencyType.MEDICAL);
			expect(auditRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					action: "SOS_CREATED",
					actorId: USER_ID,
					targetType: "sos_alert",
				})
			);
			expect(eventsGateway.emitSosCreated).toHaveBeenCalledWith(
				expect.objectContaining({
					tripId: TRIP_ID,
					senderId: USER_ID,
					emergencyType: EmergencyType.MEDICAL,
				})
			);
		});

		it("throws NotFoundException if trip does not exist", async () => {
			participation.findTrip.mockResolvedValue(null);

			await expect(service.createSos(USER_ID, TRIP_ID, createDto)).rejects.toThrow(
				NotFoundException
			);
		});

		it("throws ForbiddenException if caller is not a trip participant", async () => {
			participation.findCamperParticipation.mockResolvedValue(null);
			participation.findPorterAssignment.mockResolvedValue(null);

			await expect(service.createSos(OTHER_USER_ID, TRIP_ID, createDto)).rejects.toThrow(
				ForbiddenException
			);
		});
	});

	describe("cancel (CTMS-077, BR-258)", () => {
		const cancelDto: CancelSosDto = {
			reason: "Accidentally clicked SOS while checking map, false alarm",
		};

		it("cancels active SOS alert, saves cancelled_by, cancelled_at, reason, records audit, and emits socket event", async () => {
			const existing = buildSosAlert({ status: SosStatus.ACTIVE });
			sosRepository.findForUpdate.mockResolvedValue(existing);

			const result = await service.cancel(USER_ID, TRIP_ID, SOS_ID, cancelDto);

			expect(result.status).toBe(SosStatus.CANCELLED);
			expect(result.cancelledBy).toBe(USER_ID);
			expect(result.cancelledAt).toBeTruthy();
			expect(result.cancellationReason).toBe(cancelDto.reason);

			// BR-191: Audit log must record critical action
			expect(auditRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					actorId: USER_ID,
					action: "SOS_CANCELLED",
					targetType: "sos_alert",
					targetId: SOS_ID,
					reason: cancelDto.reason,
					before: expect.objectContaining({ status: SosStatus.ACTIVE }),
					after: expect.objectContaining({
						status: SosStatus.CANCELLED,
						cancelledBy: USER_ID,
						cancellationReason: cancelDto.reason,
					}),
				})
			);

			// Realtime broadcast to Host and room
			expect(eventsGateway.emitSosStateChanged).toHaveBeenCalledWith(
				expect.objectContaining({
					sosId: SOS_ID,
					tripId: TRIP_ID,
					senderId: USER_ID,
					status: SosStatus.CANCELLED,
					cancelledBy: USER_ID,
					cancellationReason: cancelDto.reason,
				})
			);
		});

		it("throws NotFoundException if SOS does not exist or belongs to another trip", async () => {
			sosRepository.findForUpdate.mockResolvedValue(null);

			await expect(service.cancel(USER_ID, TRIP_ID, SOS_ID, cancelDto)).rejects.toThrow(
				NotFoundException
			);
		});

		it("throws ForbiddenException if caller is not the sender who created the SOS alert", async () => {
			const existing = buildSosAlert({ senderId: USER_ID });
			sosRepository.findForUpdate.mockResolvedValue(existing);

			// OTHER_USER_ID tries to cancel USER_ID's alert
			participation.findCamperParticipation.mockResolvedValue(buildCamper());

			await expect(service.cancel(OTHER_USER_ID, TRIP_ID, SOS_ID, cancelDto)).rejects.toThrow(
				ForbiddenException
			);

			expect(auditRepository.save).not.toHaveBeenCalled();
			expect(eventsGateway.emitSosStateChanged).not.toHaveBeenCalled();
		});

		it("throws ConflictException if SOS alert is already CANCELLED", async () => {
			const existing = buildSosAlert({ status: SosStatus.CANCELLED });
			sosRepository.findForUpdate.mockResolvedValue(existing);

			const error = await service
				.cancel(USER_ID, TRIP_ID, SOS_ID, cancelDto)
				.catch((e: unknown) => e);

			expect(error).toBeInstanceOf(ConflictException);
			expect((error as ConflictException).getResponse()).toMatchObject({
				error: SosErrorCode.SOS_ALREADY_CANCELLED,
			});
		});

		it("throws ConflictException if SOS alert is already ACKNOWLEDGED by Host", async () => {
			const existing = buildSosAlert({ status: SosStatus.ACKNOWLEDGED });
			sosRepository.findForUpdate.mockResolvedValue(existing);

			const error = await service
				.cancel(USER_ID, TRIP_ID, SOS_ID, cancelDto)
				.catch((e: unknown) => e);

			expect(error).toBeInstanceOf(ConflictException);
			expect((error as ConflictException).getResponse()).toMatchObject({
				error: SosErrorCode.SOS_ALREADY_ACKNOWLEDGED,
			});
		});

		it("throws ConflictException if SOS alert is already CLOSED", async () => {
			const existing = buildSosAlert({ status: SosStatus.CLOSED });
			sosRepository.findForUpdate.mockResolvedValue(existing);

			const error = await service
				.cancel(USER_ID, TRIP_ID, SOS_ID, cancelDto)
				.catch((e: unknown) => e);

			expect(error).toBeInstanceOf(ConflictException);
			expect((error as ConflictException).getResponse()).toMatchObject({
				error: SosErrorCode.SOS_ALREADY_CLOSED,
			});
		});
	});

	describe("listForTrip", () => {
		it("returns SOS alerts for the trip", async () => {
			const alert1 = buildSosAlert({ id: "alert-1" });
			const alert2 = buildSosAlert({ id: "alert-2" });
			sosRepository.findByTripId.mockResolvedValue([alert1, alert2]);

			const results = await service.listForTrip(USER_ID, TRIP_ID);

			expect(results).toHaveLength(2);
			expect(results[0].id).toBe("alert-1");
			expect(results[1].id).toBe("alert-2");
		});

		it("throws ForbiddenException if caller is not a trip participant", async () => {
			participation.findCamperParticipation.mockResolvedValue(null);
			participation.findPorterAssignment.mockResolvedValue(null);

			await expect(service.listForTrip(OTHER_USER_ID, TRIP_ID)).rejects.toThrow(ForbiddenException);
		});
	});
});
