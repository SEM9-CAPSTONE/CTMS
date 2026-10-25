import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import type {
	CamperParticipation,
	GpsParticipationSource,
} from "../gps-tracking/gps-participation.source";
import {
	GpsParticipantRole,
	GpsTrackingIneligibleReason,
} from "../gps-tracking/gps-tracking.enums";
import { TripStatus } from "../trips/entities/trip.entity";
import type { SafetyEventInputDto } from "./dto/create-safety-events.dto";
import type { NewSafetyEvent, SafetyEventRepository } from "./safety-event.repository";
import {
	SafetyEventIngestStatus,
	SafetyEventRejectionReason,
	SafetyEventType,
} from "./safety-events.enums";
import { SafetyEventsService } from "./safety-events.service";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const TRIP_ID = "33333333-3333-4333-8333-333333333333";
const ROUTE_ID = "66666666-6666-4666-8666-666666666666";
const EVENT_ID = "44444444-4444-4444-8444-444444444444";
const EVENT_ID_2 = "55555555-5555-4555-8555-555555555555";
const ROUTE_VERSION = "0123456789abcdef0123456789abcdef";

const TRIP_START = new Date("2026-10-26T01:00:00.000Z");
const TRIP_END = new Date("2026-10-26T09:00:00.000Z");
const GEOMETRY = {
	type: "LineString" as const,
	coordinates: [
		[108.2, 16.05],
		[108.21, 16.06],
	] as Array<[number, number]>,
};

function trip(status: TripStatus) {
	return { id: TRIP_ID, status, startsAt: TRIP_START, endsAt: TRIP_END };
}

function camper(overrides: Partial<CamperParticipation> = {}): CamperParticipation {
	return {
		memberStatus: BookingMemberStatus.JOINED,
		checkedInAt: new Date("2026-10-26T00:30:00.000Z"),
		leftAt: null,
		...overrides,
	};
}

function offRoute(overrides: Partial<SafetyEventInputDto> = {}): SafetyEventInputDto {
	return {
		id: EVENT_ID,
		eventType: SafetyEventType.OFF_ROUTE,
		eventTime: "2026-10-26T03:00:00.000Z",
		latitude: 16.05,
		longitude: 108.23,
		accuracyMeters: 8,
		distanceToRouteMeters: 65,
		consecutiveValidSamples: 3,
		detectedOffline: true,
		routeVersion: ROUTE_VERSION,
		configVersion: "v3",
		...overrides,
	};
}

describe("SafetyEventsService", () => {
	let participation: {
		findTrip: jest.Mock;
		findCamperParticipation: jest.Mock;
		findPorterAssignment: jest.Mock;
	};
	let repository: {
		findTripRoute: jest.Mock;
		insertIgnoringExisting: jest.Mock;
		findOwners: jest.Mock;
	};
	let service: SafetyEventsService;

	beforeEach(() => {
		participation = {
			findTrip: jest.fn().mockResolvedValue(trip(TripStatus.ONGOING)),
			findCamperParticipation: jest.fn().mockResolvedValue(camper()),
			findPorterAssignment: jest.fn().mockResolvedValue(null),
		};
		repository = {
			findTripRoute: jest
				.fn()
				.mockResolvedValue({ routeId: ROUTE_ID, routeVersion: ROUTE_VERSION, geometry: GEOMETRY }),
			insertIgnoringExisting: jest.fn(
				async (rows: Array<{ id: string }>) => new Set(rows.map((row) => row.id))
			),
			findOwners: jest.fn().mockResolvedValue(new Map()),
		};
		service = new SafetyEventsService(
			participation as unknown as GpsParticipationSource,
			repository as unknown as SafetyEventRepository
		);
	});

	async function ingestOne(event: SafetyEventInputDto) {
		const response = await service.ingestEvents(USER_ID, TRIP_ID, { events: [event] });
		return response.results[0];
	}

	describe("getRouteDeviationContext (BR-238 / fixed V3 thresholds)", () => {
		it("returns the Trip's authoritative Route geometry, its version and the fixed thresholds", async () => {
			await expect(service.getRouteDeviationContext(USER_ID, TRIP_ID)).resolves.toEqual({
				tripId: TRIP_ID,
				eligible: true,
				reason: null,
				participantRole: GpsParticipantRole.CAMPER,
				routeId: ROUTE_ID,
				routeVersion: ROUTE_VERSION,
				geometry: GEOMETRY,
				thresholds: {
					validSampleMaxAccuracyMeters: 20,
					offRouteMinDistanceMeters: 50,
					onRouteMaxDistanceMeters: 20,
					consecutiveSamples: 3,
					gpsDegradedAfterSeconds: 120,
				},
				configVersion: "v3",
			});
		});

		it("marks detection ineligible when the Trip is not ongoing", async () => {
			participation.findTrip.mockResolvedValue(trip(TripStatus.PUBLISHED));
			const context = await service.getRouteDeviationContext(USER_ID, TRIP_ID);
			expect(context.eligible).toBe(false);
			expect(context.reason).toBe(GpsTrackingIneligibleReason.TRIP_NOT_ONGOING);
		});

		it("rejects callers who are not Trip participants and unknown Trips", async () => {
			participation.findCamperParticipation.mockResolvedValue(null);
			await expect(service.getRouteDeviationContext(USER_ID, TRIP_ID)).rejects.toBeInstanceOf(
				ForbiddenException
			);
			participation.findTrip.mockResolvedValue(null);
			await expect(service.getRouteDeviationContext(USER_ID, TRIP_ID)).rejects.toBeInstanceOf(
				NotFoundException
			);
		});

		it("fails clearly when the Trip has no Route geometry", async () => {
			repository.findTripRoute.mockResolvedValue(null);
			await expect(service.getRouteDeviationContext(USER_ID, TRIP_ID)).rejects.toBeInstanceOf(
				ConflictException
			);
		});
	});

	describe("ingestEvents", () => {
		it("accepts a confirmed OFF_ROUTE and keeps the client context with the server Route", async () => {
			await expect(ingestOne(offRoute())).resolves.toEqual({
				id: EVENT_ID,
				status: SafetyEventIngestStatus.ACCEPTED,
				reason: null,
			});
			const [stored] = repository.insertIgnoringExisting.mock.calls[0][0] as NewSafetyEvent[];
			expect(stored).toMatchObject({
				tripId: TRIP_ID,
				userId: USER_ID,
				participantRole: GpsParticipantRole.CAMPER,
				eventTime: "2026-10-26T03:00:00.000Z",
				distanceToRouteMeters: 65,
				consecutiveValidSamples: 3,
				detectedOffline: true,
				routeId: ROUTE_ID,
				routeVersion: ROUTE_VERSION,
				packageVersion: null,
			});
		});

		describe("OFF_ROUTE thresholds (BR-375 / BR-377 / BR-378)", () => {
			it.each([
				["distance at the 50 m threshold", { distanceToRouteMeters: 50 }],
				["only two consecutive samples", { consecutiveValidSamples: 2 }],
				["an INVALID confirming sample (accuracy 25 m)", { accuracyMeters: 25 }],
			])("rejects %s", async (_label, overrides) => {
				await expect(ingestOne(offRoute(overrides))).resolves.toMatchObject({
					status: SafetyEventIngestStatus.REJECTED,
					reason: SafetyEventRejectionReason.THRESHOLD_NOT_MET,
				});
				expect(repository.insertIgnoringExisting).toHaveBeenCalledWith([]);
			});

			it("accepts accuracy exactly 20 m as VALID", async () => {
				await expect(ingestOne(offRoute({ accuracyMeters: 20 }))).resolves.toMatchObject({
					status: SafetyEventIngestStatus.ACCEPTED,
				});
			});
		});

		describe("ON_ROUTE_RECOVERED thresholds (BR-382 / BR-383)", () => {
			const recovered = (overrides: Partial<SafetyEventInputDto> = {}) =>
				offRoute({
					eventType: SafetyEventType.ON_ROUTE_RECOVERED,
					distanceToRouteMeters: 12,
					...overrides,
				});

			it("accepts three consecutive VALID samples below 20 m", async () => {
				await expect(ingestOne(recovered())).resolves.toMatchObject({
					status: SafetyEventIngestStatus.ACCEPTED,
				});
			});

			it.each([
				["a buffer-zone distance (30 m)", { distanceToRouteMeters: 30 }],
				["distance exactly 20 m", { distanceToRouteMeters: 20 }],
				["fewer than three samples", { consecutiveValidSamples: 1 }],
			])("rejects %s", async (_label, overrides) => {
				await expect(ingestOne(recovered(overrides))).resolves.toMatchObject({
					reason: SafetyEventRejectionReason.THRESHOLD_NOT_MET,
				});
			});
		});

		describe("GPS quality (BR-387 / BR-388)", () => {
			const degraded = (noValidSampleSince: string) =>
				offRoute({
					eventType: SafetyEventType.GPS_DEGRADED,
					latitude: undefined,
					longitude: undefined,
					accuracyMeters: undefined,
					distanceToRouteMeters: undefined,
					consecutiveValidSamples: undefined,
					noValidSampleSince,
				});

			it("accepts GPS_DEGRADED after two minutes without a VALID sample", async () => {
				await expect(ingestOne(degraded("2026-10-26T02:58:00.000Z"))).resolves.toMatchObject({
					status: SafetyEventIngestStatus.ACCEPTED,
				});
			});

			it("rejects GPS_DEGRADED claimed before two minutes have passed", async () => {
				await expect(ingestOne(degraded("2026-10-26T02:58:01.000Z"))).resolves.toMatchObject({
					reason: SafetyEventRejectionReason.THRESHOLD_NOT_MET,
				});
			});

			it("accepts GPS_RESTORED only with a VALID sample", async () => {
				const restored = (accuracyMeters: number) =>
					offRoute({
						eventType: SafetyEventType.GPS_RESTORED,
						accuracyMeters,
						distanceToRouteMeters: undefined,
						consecutiveValidSamples: undefined,
					});
				await expect(ingestOne(restored(15))).resolves.toMatchObject({
					status: SafetyEventIngestStatus.ACCEPTED,
				});
				await expect(ingestOne(restored(25))).resolves.toMatchObject({
					reason: SafetyEventRejectionReason.THRESHOLD_NOT_MET,
				});
			});
		});

		it("rejects an event detected against a Route version other than the Trip's (BR-360)", async () => {
			await expect(ingestOne(offRoute({ routeVersion: "stale-version" }))).resolves.toMatchObject({
				reason: SafetyEventRejectionReason.ROUTE_VERSION_MISMATCH,
			});
		});

		it("applies the participation window: outside the Trip or before check-in is rejected", async () => {
			await expect(
				ingestOne(offRoute({ eventTime: "2026-10-26T09:00:01.000Z" }))
			).resolves.toMatchObject({
				reason: SafetyEventRejectionReason.EVENT_TIME_OUTSIDE_PARTICIPATION,
			});
			participation.findCamperParticipation.mockResolvedValue(
				camper({ checkedInAt: new Date("2026-10-26T03:30:00.000Z") })
			);
			await expect(ingestOne(offRoute())).resolves.toMatchObject({
				reason: SafetyEventRejectionReason.EVENT_TIME_OUTSIDE_PARTICIPATION,
			});
		});

		it("rejects events for a Trip that is no longer trackable", async () => {
			participation.findTrip.mockResolvedValue(trip(TripStatus.CANCELLED));
			await expect(ingestOne(offRoute())).resolves.toMatchObject({
				reason: SafetyEventRejectionReason.TRIP_NOT_TRACKABLE,
			});
		});

		it("accepts events from an assigned Porter and rejects an unassigned one", async () => {
			participation.findCamperParticipation.mockResolvedValue(null);
			participation.findPorterAssignment.mockResolvedValue({ assigned: true });
			await expect(ingestOne(offRoute())).resolves.toMatchObject({
				status: SafetyEventIngestStatus.ACCEPTED,
			});
			participation.findPorterAssignment.mockResolvedValue({ assigned: false });
			await expect(ingestOne(offRoute())).resolves.toMatchObject({
				reason: SafetyEventRejectionReason.PARTICIPATION_NOT_ELIGIBLE,
			});
		});

		describe("idempotency (BR-244)", () => {
			it("reports the caller's own retry as duplicate", async () => {
				repository.insertIgnoringExisting.mockResolvedValue(new Set());
				repository.findOwners.mockResolvedValue(
					new Map([[EVENT_ID, { id: EVENT_ID, tripId: TRIP_ID, userId: USER_ID }]])
				);
				await expect(ingestOne(offRoute())).resolves.toEqual({
					id: EVENT_ID,
					status: SafetyEventIngestStatus.DUPLICATE,
					reason: null,
				});
			});

			it("rejects a UUID that already belongs to another user", async () => {
				repository.insertIgnoringExisting.mockResolvedValue(new Set());
				repository.findOwners.mockResolvedValue(
					new Map([[EVENT_ID, { id: EVENT_ID, tripId: TRIP_ID, userId: OTHER_USER_ID }]])
				);
				await expect(ingestOne(offRoute())).resolves.toMatchObject({
					reason: SafetyEventRejectionReason.ID_CONFLICT,
				});
			});

			it("evaluates a UUID repeated inside one batch once and answers in request order", async () => {
				const response = await service.ingestEvents(USER_ID, TRIP_ID, {
					events: [offRoute(), offRoute({ id: EVENT_ID_2, accuracyMeters: 30 }), offRoute()],
				});
				expect(response.results.map((result) => [result.id, result.status])).toEqual([
					[EVENT_ID, SafetyEventIngestStatus.ACCEPTED],
					[EVENT_ID_2, SafetyEventIngestStatus.REJECTED],
					[EVENT_ID, SafetyEventIngestStatus.ACCEPTED],
				]);
				expect(repository.insertIgnoringExisting.mock.calls[0][0]).toHaveLength(1);
			});
		});
	});
});
