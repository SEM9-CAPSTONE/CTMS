import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import { TripStatus } from "../trips/entities/trip.entity";
import type { GpsLogInputDto } from "./dto/create-gps-logs.dto";
import type { GpsLogRepository } from "./gps-log.repository";
import type { CamperParticipation, GpsParticipationSource } from "./gps-participation.source";
import {
	GpsLogIngestStatus,
	GpsLogRejectionReason,
	GpsParticipantRole,
	GpsTrackingIneligibleReason,
} from "./gps-tracking.enums";
import { GpsTrackingService } from "./gps-tracking.service";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const TRIP_ID = "33333333-3333-4333-8333-333333333333";
const LOG_ID = "44444444-4444-4444-8444-444444444444";
const LOG_ID_2 = "55555555-5555-4555-8555-555555555555";

const TRIP_START = new Date("2026-10-12T01:00:00.000Z");
const TRIP_END = new Date("2026-10-12T09:00:00.000Z");

function trip(status: TripStatus) {
	return { id: TRIP_ID, status, startsAt: TRIP_START, endsAt: TRIP_END };
}

function camper(overrides: Partial<CamperParticipation> = {}): CamperParticipation {
	return {
		memberStatus: BookingMemberStatus.JOINED,
		checkedInAt: new Date("2026-10-12T00:30:00.000Z"),
		leftAt: null,
		...overrides,
	};
}

function log(overrides: Partial<GpsLogInputDto> = {}): GpsLogInputDto {
	return {
		id: LOG_ID,
		eventTime: "2026-10-12T03:00:00.000Z",
		latitude: 16.05,
		longitude: 108.23,
		accuracyMeters: 8,
		configVersion: "v3",
		...overrides,
	};
}

describe("GpsTrackingService", () => {
	let participation: {
		findTrip: jest.Mock;
		findCamperParticipation: jest.Mock;
		findPorterAssignment: jest.Mock;
	};
	let gpsLogs: { insertIgnoringExisting: jest.Mock; findOwners: jest.Mock };
	let service: GpsTrackingService;

	beforeEach(() => {
		participation = {
			findTrip: jest.fn().mockResolvedValue(trip(TripStatus.ONGOING)),
			findCamperParticipation: jest.fn().mockResolvedValue(camper()),
			findPorterAssignment: jest.fn().mockResolvedValue(null),
		};
		gpsLogs = {
			insertIgnoringExisting: jest.fn(
				async (rows: Array<{ id: string }>) => new Set(rows.map((row) => row.id))
			),
			findOwners: jest.fn().mockResolvedValue(new Map()),
		};
		service = new GpsTrackingService(
			participation as unknown as GpsParticipationSource,
			gpsLogs as unknown as GpsLogRepository
		);
	});

	describe("getTrackingContext (BR-237 / BR-368 / BR-396)", () => {
		it("allows a joined Camper on an ongoing Trip and returns the fixed V3 intervals", async () => {
			await expect(service.getTrackingContext(USER_ID, TRIP_ID)).resolves.toEqual({
				tripId: TRIP_ID,
				eligible: true,
				reason: null,
				participantRole: GpsParticipantRole.CAMPER,
				samplingIntervalSeconds: 10,
				loggingIntervalSeconds: 30,
				configVersion: "v3",
			});
		});

		it("allows an assigned Porter on an ongoing Trip", async () => {
			participation.findCamperParticipation.mockResolvedValue(null);
			participation.findPorterAssignment.mockResolvedValue({ assigned: true });

			const context = await service.getTrackingContext(USER_ID, TRIP_ID);

			expect(context).toMatchObject({ eligible: true, participantRole: GpsParticipantRole.PORTER });
		});

		it.each([TripStatus.PUBLISHED, TripStatus.COMPLETED, TripStatus.CANCELLED])(
			"refuses tracking while the Trip is %s",
			async (status) => {
				participation.findTrip.mockResolvedValue(trip(status));

				const context = await service.getTrackingContext(USER_ID, TRIP_ID);

				expect(context).toMatchObject({
					eligible: false,
					reason: GpsTrackingIneligibleReason.TRIP_NOT_ONGOING,
				});
			}
		);

		it.each([
			BookingMemberStatus.REGISTERED,
			BookingMemberStatus.NO_SHOW,
			BookingMemberStatus.LEFT,
		])("refuses tracking for a %s Camper", async (memberStatus) => {
			participation.findCamperParticipation.mockResolvedValue(camper({ memberStatus }));

			const context = await service.getTrackingContext(USER_ID, TRIP_ID);

			expect(context).toMatchObject({
				eligible: false,
				reason: GpsTrackingIneligibleReason.CAMPER_NOT_JOINED,
			});
		});

		it("refuses tracking for a Porter who is not assigned", async () => {
			participation.findCamperParticipation.mockResolvedValue(null);
			participation.findPorterAssignment.mockResolvedValue({ assigned: false });

			const context = await service.getTrackingContext(USER_ID, TRIP_ID);

			expect(context).toMatchObject({
				eligible: false,
				reason: GpsTrackingIneligibleReason.PORTER_NOT_ASSIGNED,
			});
		});

		it("prefers the capacity that allows tracking when the user is both Camper and Porter", async () => {
			participation.findCamperParticipation.mockResolvedValue(
				camper({ memberStatus: BookingMemberStatus.REGISTERED })
			);
			participation.findPorterAssignment.mockResolvedValue({ assigned: true });

			const context = await service.getTrackingContext(USER_ID, TRIP_ID);

			expect(context).toMatchObject({ eligible: true, participantRole: GpsParticipantRole.PORTER });
		});

		it("rejects a user with no link to the Trip", async () => {
			participation.findCamperParticipation.mockResolvedValue(null);

			await expect(service.getTrackingContext(USER_ID, TRIP_ID)).rejects.toBeInstanceOf(
				ForbiddenException
			);
		});

		it("returns 404 for an unknown Trip", async () => {
			participation.findTrip.mockResolvedValue(null);

			await expect(service.getTrackingContext(USER_ID, TRIP_ID)).rejects.toBeInstanceOf(
				NotFoundException
			);
		});
	});

	describe("ingestLogs (BR-237 / BR-244 / BR-396)", () => {
		it("stores a valid log exactly as captured, without altering coordinates or time", async () => {
			const input = log({ altitudeMeters: 1200, batteryLevel: 64, packageVersion: "pkg-7" });

			const response = await service.ingestLogs(USER_ID, TRIP_ID, { logs: [input] });

			expect(response.results).toEqual([
				{ id: LOG_ID, status: GpsLogIngestStatus.ACCEPTED, reason: null },
			]);
			expect(gpsLogs.insertIgnoringExisting).toHaveBeenCalledWith([
				{
					id: LOG_ID,
					tripId: TRIP_ID,
					userId: USER_ID,
					participantRole: GpsParticipantRole.CAMPER,
					eventTime: input.eventTime,
					latitude: 16.05,
					longitude: 108.23,
					accuracyMeters: 8,
					altitudeMeters: 1200,
					batteryLevel: 64,
					packageVersion: "pkg-7",
					configVersion: "v3",
				},
			]);
		});

		it("accepts late synchronization after the Trip has completed", async () => {
			participation.findTrip.mockResolvedValue(trip(TripStatus.COMPLETED));

			const response = await service.ingestLogs(USER_ID, TRIP_ID, { logs: [log()] });

			expect(response.results[0].status).toBe(GpsLogIngestStatus.ACCEPTED);
		});

		it("rejects logs for a Trip that never became trackable", async () => {
			participation.findTrip.mockResolvedValue(trip(TripStatus.PUBLISHED));

			const response = await service.ingestLogs(USER_ID, TRIP_ID, { logs: [log()] });

			expect(response.results[0]).toEqual({
				id: LOG_ID,
				status: GpsLogIngestStatus.REJECTED,
				reason: GpsLogRejectionReason.TRIP_NOT_TRACKABLE,
			});
			expect(gpsLogs.insertIgnoringExisting).toHaveBeenCalledWith([]);
		});

		it("rejects logs from a Camper who never joined", async () => {
			participation.findCamperParticipation.mockResolvedValue(
				camper({ memberStatus: BookingMemberStatus.NO_SHOW })
			);

			const response = await service.ingestLogs(USER_ID, TRIP_ID, { logs: [log()] });

			expect(response.results[0].reason).toBe(GpsLogRejectionReason.PARTICIPATION_NOT_ELIGIBLE);
		});

		it("rejects logs from an unassigned Porter", async () => {
			participation.findCamperParticipation.mockResolvedValue(null);
			participation.findPorterAssignment.mockResolvedValue({ assigned: false });

			const response = await service.ingestLogs(USER_ID, TRIP_ID, { logs: [log()] });

			expect(response.results[0].reason).toBe(GpsLogRejectionReason.PARTICIPATION_NOT_ELIGIBLE);
		});

		it.each([
			["before the Trip starts", "2026-10-12T00:59:59.000Z"],
			["after the Trip ends", "2026-10-12T09:00:01.000Z"],
		])("rejects a log captured %s", async (_label, eventTime) => {
			const response = await service.ingestLogs(USER_ID, TRIP_ID, { logs: [log({ eventTime })] });

			expect(response.results[0].reason).toBe(
				GpsLogRejectionReason.EVENT_TIME_OUTSIDE_PARTICIPATION
			);
		});

		it("accepts a departed Camper's logs before leaving and rejects those after", async () => {
			participation.findCamperParticipation.mockResolvedValue(
				camper({
					memberStatus: BookingMemberStatus.LEFT,
					leftAt: new Date("2026-10-12T05:00:00.000Z"),
				})
			);

			const response = await service.ingestLogs(USER_ID, TRIP_ID, {
				logs: [
					log({ id: LOG_ID, eventTime: "2026-10-12T04:59:00.000Z" }),
					log({ id: LOG_ID_2, eventTime: "2026-10-12T05:01:00.000Z" }),
				],
			});

			expect(response.results.map((result) => result.status)).toEqual([
				GpsLogIngestStatus.ACCEPTED,
				GpsLogIngestStatus.REJECTED,
			]);
		});

		it("reports an already-stored log of the same user and Trip as a duplicate", async () => {
			gpsLogs.insertIgnoringExisting.mockResolvedValue(new Set());
			gpsLogs.findOwners.mockResolvedValue(
				new Map([[LOG_ID, { id: LOG_ID, tripId: TRIP_ID, userId: USER_ID }]])
			);

			const response = await service.ingestLogs(USER_ID, TRIP_ID, { logs: [log()] });

			expect(response.results[0]).toEqual({
				id: LOG_ID,
				status: GpsLogIngestStatus.DUPLICATE,
				reason: null,
			});
		});

		it("rejects a UUID already used by another user's log without overwriting it", async () => {
			gpsLogs.insertIgnoringExisting.mockResolvedValue(new Set());
			gpsLogs.findOwners.mockResolvedValue(
				new Map([[LOG_ID, { id: LOG_ID, tripId: TRIP_ID, userId: OTHER_USER_ID }]])
			);

			const response = await service.ingestLogs(USER_ID, TRIP_ID, { logs: [log()] });

			expect(response.results[0]).toEqual({
				id: LOG_ID,
				status: GpsLogIngestStatus.REJECTED,
				reason: GpsLogRejectionReason.ID_CONFLICT,
			});
		});

		it("stores a UUID repeated inside one batch only once", async () => {
			const response = await service.ingestLogs(USER_ID, TRIP_ID, { logs: [log(), log()] });

			expect(gpsLogs.insertIgnoringExisting).toHaveBeenCalledWith([
				expect.objectContaining({ id: LOG_ID }),
			]);
			expect(response.results).toHaveLength(2);
			expect(response.results[1]).toEqual(response.results[0]);
		});
	});
});
