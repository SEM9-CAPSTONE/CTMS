import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import type { GpsParticipationSource, TrackedTrip } from "../gps-tracking/gps-participation.source";
import { TripStatus } from "../trips/entities/trip.entity";
import { UserRole } from "../users/entities/user.entity";
import type { DeviceSyncRepository, ParticipantSyncStats } from "./device-sync.repository";
import { DeviceSyncService } from "./device-sync.service";

describe("DeviceSyncService (CTMS-067)", () => {
	let service: DeviceSyncService;
	let participation: jest.Mocked<GpsParticipationSource>;
	let repository: jest.Mocked<DeviceSyncRepository>;

	const sampleTrip: TrackedTrip = {
		id: "trip-001",
		status: TripStatus.ONGOING,
		startsAt: new Date("2026-10-23T06:00:00.000Z"),
		endsAt: new Date("2026-10-23T18:00:00.000Z"),
	};

	beforeEach(() => {
		participation = {
			findTrip: jest.fn(),
			findCamperParticipation: jest.fn(),
			findPorterAssignment: jest.fn(),
		} as unknown as jest.Mocked<GpsParticipationSource>;

		repository = {
			getTripHostId: jest.fn(),
			getParticipantSyncStats: jest.fn(),
			getTripParticipantsSyncHealth: jest.fn(),
		} as unknown as jest.Mocked<DeviceSyncRepository>;

		service = new DeviceSyncService(participation, repository);
	});

	it("throws NotFoundException when trip does not exist", async () => {
		participation.findTrip.mockResolvedValue(null);

		await expect(
			service.getSyncStatus("user-1", [UserRole.CAMPER], "trip-unknown")
		).rejects.toThrow(NotFoundException);
	});

	it("throws ForbiddenException when user is not linked to trip", async () => {
		participation.findTrip.mockResolvedValue(sampleTrip);
		repository.getTripHostId.mockResolvedValue("host-999");
		participation.findCamperParticipation.mockResolvedValue(null);
		participation.findPorterAssignment.mockResolvedValue(null);

		await expect(service.getSyncStatus("stranger", [UserRole.CAMPER], "trip-001")).rejects.toThrow(
			ForbiddenException
		);
	});

	it("returns authoritative status for a joined Camper (PB AC-1..3, BR-226)", async () => {
		participation.findTrip.mockResolvedValue(sampleTrip);
		repository.getTripHostId.mockResolvedValue("host-999");
		participation.findCamperParticipation.mockResolvedValue({
			memberStatus: BookingMemberStatus.JOINED,
			checkedInAt: new Date("2026-10-23T06:30:00.000Z"),
			leftAt: null,
		});
		participation.findPorterAssignment.mockResolvedValue(null);

		const stats: ParticipantSyncStats = {
			gpsCount: 45,
			safetyCount: 1,
			lastReceivedAt: new Date("2026-10-23T08:15:00.000Z"),
			packageVersion: "pkg-v1",
		};
		repository.getParticipantSyncStats.mockResolvedValue(stats);

		const result = await service.getSyncStatus("camper-1", [UserRole.CAMPER], "trip-001");

		expect(result).toEqual({
			tripId: "trip-001",
			userId: "camper-1",
			participantRole: "camper",
			serverConfirmedGpsCount: 45,
			serverConfirmedSafetyCount: 1,
			lastReceivedAt: "2026-10-23T08:15:00.000Z",
			packageVersion: "pkg-v1",
			configVersion: "v3",
		});
		expect(result.membersSyncHealth).toBeUndefined();
	});

	it("returns authoritative status for an assigned Porter", async () => {
		participation.findTrip.mockResolvedValue(sampleTrip);
		repository.getTripHostId.mockResolvedValue("host-999");
		participation.findCamperParticipation.mockResolvedValue(null);
		participation.findPorterAssignment.mockResolvedValue({ assigned: true });

		repository.getParticipantSyncStats.mockResolvedValue({
			gpsCount: 90,
			safetyCount: 3,
			lastReceivedAt: new Date("2026-10-23T09:00:00.000Z"),
			packageVersion: null,
		});

		const result = await service.getSyncStatus("porter-1", [UserRole.PORTER], "trip-001");

		expect(result.participantRole).toBe("porter");
		expect(result.serverConfirmedGpsCount).toBe(90);
		expect(result.serverConfirmedSafetyCount).toBe(3);
		expect(result.lastReceivedAt).toBe("2026-10-23T09:00:00.000Z");
	});

	it("returns aggregate members health when caller is the Trip Host", async () => {
		participation.findTrip.mockResolvedValue(sampleTrip);
		repository.getTripHostId.mockResolvedValue("host-1");
		participation.findCamperParticipation.mockResolvedValue(null);
		participation.findPorterAssignment.mockResolvedValue(null);

		repository.getParticipantSyncStats.mockResolvedValue({
			gpsCount: 0,
			safetyCount: 0,
			lastReceivedAt: null,
			packageVersion: null,
		});

		repository.getTripParticipantsSyncHealth.mockResolvedValue([
			{
				userId: "camper-1",
				displayName: "Camper One",
				role: "camper",
				gpsCount: 20,
				safetyCount: 0,
				lastReceivedAt: "2026-10-23T08:00:00.000Z",
				status: "connected",
			},
			{
				userId: "porter-1",
				displayName: "Porter Lead",
				role: "porter",
				gpsCount: 50,
				safetyCount: 2,
				lastReceivedAt: "2026-10-23T07:30:00.000Z",
				status: "stale",
			},
		]);

		const result = await service.getSyncStatus("host-1", [UserRole.HOST], "trip-001");

		expect(result.participantRole).toBe("host");
		expect(result.membersSyncHealth).toHaveLength(2);
		expect(result.membersSyncHealth?.[0].status).toBe("connected");
		expect(result.membersSyncHealth?.[1].status).toBe("stale");
	});

	it("handles zero counts and null lastReceivedAt gracefully when no data has synced yet", async () => {
		participation.findTrip.mockResolvedValue(sampleTrip);
		repository.getTripHostId.mockResolvedValue("host-999");
		participation.findCamperParticipation.mockResolvedValue({
			memberStatus: BookingMemberStatus.JOINED,
			checkedInAt: new Date("2026-10-23T06:30:00.000Z"),
			leftAt: null,
		});
		participation.findPorterAssignment.mockResolvedValue(null);

		repository.getParticipantSyncStats.mockResolvedValue({
			gpsCount: 0,
			safetyCount: 0,
			lastReceivedAt: null,
			packageVersion: null,
		});

		const result = await service.getSyncStatus("camper-empty", [UserRole.CAMPER], "trip-001");

		expect(result.serverConfirmedGpsCount).toBe(0);
		expect(result.serverConfirmedSafetyCount).toBe(0);
		expect(result.lastReceivedAt).toBeNull();
		expect(result.packageVersion).toBeNull();
	});
});
