import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import type { GpsLogRepository } from "../gps-tracking/gps-log.repository";
import type { GpsParticipationSource, TrackedTrip } from "../gps-tracking/gps-participation.source";
import { GpsLogIngestStatus } from "../gps-tracking/gps-tracking.enums";
import { GpsTrackingService } from "../gps-tracking/gps-tracking.service";
import type { SafetyEventRepository, TripRoute } from "../safety-events/safety-event.repository";
import {
	ROUTE_DEVIATION_CONFIG_VERSION,
	VALID_SAMPLE_MAX_ACCURACY_METERS,
} from "../safety-events/safety-events.constants";
import { SafetyEventIngestStatus, SafetyEventType } from "../safety-events/safety-events.enums";
import { SafetyEventsService } from "../safety-events/safety-events.service";
import { TripStatus } from "../trips/entities/trip.entity";

describe("Reliable Synchronization After Reconnection (CTMS-065)", () => {
	const tripId = "11111111-1111-4111-8111-111111111111";
	const userId = "22222222-2222-4222-8222-222222222222";
	const routeId = "33333333-3333-4333-8333-333333333333";

	const trackedTrip: TrackedTrip = {
		id: tripId,
		status: TripStatus.ONGOING,
		startsAt: new Date("2026-10-24T06:00:00.000Z"),
		endsAt: new Date("2026-10-24T18:00:00.000Z"),
	};

	const tripRoute: TripRoute = {
		routeId,
		routeVersion: "route-v1",
		geometry: {
			type: "LineString",
			coordinates: [
				[108.4, 11.5],
				[108.4, 11.52],
			],
		},
	};

	let participation: jest.Mocked<GpsParticipationSource>;
	let gpsLogRepo: jest.Mocked<GpsLogRepository>;
	let gpsService: GpsTrackingService;

	let safetyRepo: jest.Mocked<SafetyEventRepository>;
	let safetyService: SafetyEventsService;

	beforeEach(() => {
		participation = {
			findTrip: jest.fn().mockResolvedValue(trackedTrip),
			findCamperParticipation: jest.fn().mockResolvedValue({
				memberStatus: BookingMemberStatus.JOINED,
				checkedInAt: new Date("2026-10-24T06:30:00.000Z"),
				leftAt: null,
			}),
			findPorterAssignment: jest.fn().mockResolvedValue(null),
		} as unknown as jest.Mocked<GpsParticipationSource>;

		gpsLogRepo = {
			insertIgnoringExisting: jest.fn(),
			findOwners: jest.fn(),
		} as unknown as jest.Mocked<GpsLogRepository>;

		gpsService = new GpsTrackingService(participation, gpsLogRepo);

		safetyRepo = {
			findTripRoute: jest.fn().mockResolvedValue(tripRoute),
			insertIgnoringExisting: jest.fn(),
			findOwners: jest.fn(),
		} as unknown as jest.Mocked<SafetyEventRepository>;

		safetyService = new SafetyEventsService(participation, safetyRepo);
	});

	describe("PB AC-3: Preserves original event time, UUID, location, accuracy, and package/config version context", () => {
		it("ingests GPS log preserving client capture context (BR-243)", async () => {
			const uuid = "44444444-4444-4444-8444-444444444444";
			gpsLogRepo.insertIgnoringExisting.mockResolvedValue(new Set([uuid]));

			const response = await gpsService.ingestLogs(userId, tripId, {
				logs: [
					{
						id: uuid,
						eventTime: "2026-10-24T08:30:00.000Z",
						latitude: 11.51,
						longitude: 108.4,
						accuracyMeters: 6.5,
						altitudeMeters: 1200,
						batteryLevel: 88,
						packageVersion: "pkg-v2",
						configVersion: "v3",
					},
				],
			});

			expect(response.results).toEqual([
				{
					id: uuid,
					status: GpsLogIngestStatus.ACCEPTED,
					reason: null,
				},
			]);

			expect(gpsLogRepo.insertIgnoringExisting).toHaveBeenCalledWith([
				expect.objectContaining({
					id: uuid,
					eventTime: "2026-10-24T08:30:00.000Z",
					latitude: 11.51,
					longitude: 108.4,
					accuracyMeters: 6.5,
					altitudeMeters: 1200,
					batteryLevel: 88,
					packageVersion: "pkg-v2",
					configVersion: "v3",
				}),
			]);
		});
	});

	describe("PB AC-4 & PB AC-7: Idempotent ingestion for repeated UUIDs (BR-244)", () => {
		it("treats already ingested GPS UUID as duplicate without recreating records", async () => {
			const uuid = "55555555-5555-4555-8555-555555555555";
			// First call accepted
			gpsLogRepo.insertIgnoringExisting.mockResolvedValueOnce(new Set([uuid]));

			const firstResponse = await gpsService.ingestLogs(userId, tripId, {
				logs: [
					{
						id: uuid,
						eventTime: "2026-10-24T08:30:00.000Z",
						latitude: 11.51,
						longitude: 108.4,
						accuracyMeters: 8,
						configVersion: "v3",
					},
				],
			});
			expect(firstResponse.results[0].status).toBe(GpsLogIngestStatus.ACCEPTED);

			// Reconnection sync sends the same batch again
			gpsLogRepo.insertIgnoringExisting.mockResolvedValueOnce(new Set()); // Already exists
			gpsLogRepo.findOwners.mockResolvedValueOnce(
				new Map([[uuid, { userId, tripId }]]) // Belongs to same user and trip
			);

			const secondResponse = await gpsService.ingestLogs(userId, tripId, {
				logs: [
					{
						id: uuid,
						eventTime: "2026-10-24T08:30:00.000Z",
						latitude: 11.51,
						longitude: 108.4,
						accuracyMeters: 8,
						configVersion: "v3",
					},
				],
			});

			expect(secondResponse.results[0].status).toBe(GpsLogIngestStatus.DUPLICATE);
			expect(secondResponse.results[0].reason).toBeNull();
		});

		it("treats already ingested Safety Event UUID as duplicate idempotently (BR-244)", async () => {
			const uuid = "66666666-6666-4666-8666-666666666666";
			safetyRepo.insertIgnoringExisting.mockResolvedValueOnce(new Set()); // Already in DB
			safetyRepo.findOwners.mockResolvedValueOnce(
				new Map([[uuid, { userId, tripId }]]) // Belongs to same user and trip
			);

			const response = await safetyService.ingestEvents(userId, tripId, {
				events: [
					{
						id: uuid,
						eventType: SafetyEventType.OFF_ROUTE,
						eventTime: "2026-10-24T08:35:00.000Z",
						latitude: 11.51,
						longitude: 108.405,
						accuracyMeters: VALID_SAMPLE_MAX_ACCURACY_METERS,
						distanceToRouteMeters: 550,
						consecutiveValidSamples: 3,
						detectedOffline: true,
						routeVersion: "route-v1",
						packageVersion: "pkg-v2",
						configVersion: ROUTE_DEVIATION_CONFIG_VERSION,
					},
				],
			});

			expect(response.results).toEqual([
				{
					id: uuid,
					status: SafetyEventIngestStatus.DUPLICATE,
					reason: null,
				},
			]);
		});
	});
});
