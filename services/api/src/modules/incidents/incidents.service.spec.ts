import {
	ConflictException,
	ForbiddenException,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import type { EventsGateway } from "../realtime/events.gateway";
import { TripStatus } from "../trips/entities/trip.entity";
import { UserRole } from "../users/entities/user.entity";
import type { ReportIncidentDto } from "./dto/report-incident.dto";
import { IncidentMediaStorage } from "./incident-media.storage";
import {
	IncidentCategory,
	IncidentErrorCode,
	IncidentLocationStatus,
	IncidentReportOutcome,
	IncidentSeverity,
	IncidentStatus,
} from "./incidents.enums";
import type {
	IncidentRow,
	IncidentTrip,
	IncidentsRepository,
	NewIncident,
} from "./incidents.repository";
import { IncidentsService, classifyLocation } from "./incidents.service";

const PORTER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PORTER_ID = "22222222-2222-4222-8222-222222222222";
const HOST_ID = "33333333-3333-4333-8333-333333333333";
const TRIP_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_TRIP_ID = "55555555-5555-4555-8555-555555555555";
const INCIDENT_ID = "66666666-6666-4666-8666-666666666666";

const NOW = new Date("2026-10-12T05:00:00.000Z");
const TRIP_START = new Date("2026-10-12T01:00:00.000Z");
const TRIP_END = new Date("2026-10-12T09:00:00.000Z");

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

function trip(status: TripStatus, overrides: Partial<IncidentTrip> = {}): IncidentTrip {
	return {
		id: TRIP_ID,
		hostId: HOST_ID,
		status,
		startsAt: TRIP_START,
		endsAt: TRIP_END,
		...overrides,
	};
}

function report(overrides: Partial<ReportIncidentDto> = {}): ReportIncidentDto {
	return {
		id: INCIDENT_ID,
		category: IncidentCategory.INJURY,
		severity: IncidentSeverity.HIGH,
		description: "Camper twisted an ankle near checkpoint 2",
		occurredAt: "2026-10-12T04:30:00.000Z",
		location: {
			latitude: 16.05,
			longitude: 108.23,
			accuracyMeters: 12,
			capturedAt: "2026-10-12T04:31:00.000Z",
		},
		capturedOffline: true,
		...overrides,
	};
}

function storedRow(incident: NewIncident): IncidentRow {
	return {
		id: incident.id,
		tripId: incident.tripId,
		reporterId: incident.reporterId,
		reporterName: "Porter A",
		category: incident.category,
		severity: incident.severity,
		status: IncidentStatus.OPEN,
		description: incident.description,
		occurredAt: new Date(incident.occurredAt),
		latitude: incident.latitude,
		longitude: incident.longitude,
		locationAccuracyMeters: incident.locationAccuracyMeters,
		locationCapturedAt: incident.locationCapturedAt ? new Date(incident.locationCapturedAt) : null,
		locationStatus: incident.locationStatus,
		capturedOffline: incident.capturedOffline,
		mediaUrl: null,
		mediaContentType: null,
		mediaSizeBytes: null,
		mediaUploadedAt: null,
		receivedAt: NOW,
	};
}

describe("IncidentsService", () => {
	let rows: Map<string, IncidentRow>;
	let repository: {
		findTrip: jest.Mock;
		isPorterAssigned: jest.Mock;
		insertIfAbsent: jest.Mock;
		findById: jest.Mock;
		listForTrip: jest.Mock;
		attachMediaIfAbsent: jest.Mock;
	};
	let mediaStorage: IncidentMediaStorage;
	let events: { emitTripIncidentReported: jest.Mock };
	let service: IncidentsService;

	beforeEach(() => {
		jest.useFakeTimers({ now: NOW });
		rows = new Map();
		repository = {
			findTrip: jest.fn().mockResolvedValue(trip(TripStatus.ONGOING)),
			isPorterAssigned: jest.fn().mockResolvedValue(true),
			insertIfAbsent: jest.fn(async (incident: NewIncident) => {
				if (rows.has(incident.id)) return false;
				rows.set(incident.id, storedRow(incident));
				return true;
			}),
			findById: jest.fn(async (id: string) => rows.get(id) ?? null),
			listForTrip: jest.fn().mockResolvedValue([]),
			attachMediaIfAbsent: jest.fn().mockResolvedValue(true),
		};
		mediaStorage = new IncidentMediaStorage();
		jest.spyOn(mediaStorage, "save").mockResolvedValue({
			url: `/uploads/incidents/${INCIDENT_ID}.jpg`,
			contentType: "image/jpeg",
			sizeBytes: JPEG_BYTES.length,
		});
		events = { emitTripIncidentReported: jest.fn() };
		service = new IncidentsService(
			repository as unknown as IncidentsRepository,
			mediaStorage,
			events as unknown as EventsGateway
		);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("reportIncident (BR-161 / BR-162 / BR-221)", () => {
		it("stores an assigned Porter's incident with its original time and notifies the Host", async () => {
			const result = await service.reportIncident(PORTER_ID, TRIP_ID, report());

			expect(result.outcome).toBe(IncidentReportOutcome.CREATED);
			expect(result.incident).toMatchObject({
				id: INCIDENT_ID,
				tripId: TRIP_ID,
				reporterId: PORTER_ID,
				category: IncidentCategory.INJURY,
				severity: IncidentSeverity.HIGH,
				status: IncidentStatus.OPEN,
				occurredAt: "2026-10-12T04:30:00.000Z",
				locationStatus: IncidentLocationStatus.FRESH,
				capturedOffline: true,
				media: null,
			});
			expect(events.emitTripIncidentReported).toHaveBeenCalledWith(
				expect.objectContaining({ incidentId: INCIDENT_ID, tripId: TRIP_ID, hostId: HOST_ID })
			);
		});

		it("rejects a Porter not assigned to the Trip without any side effect", async () => {
			repository.isPorterAssigned.mockResolvedValue(false);

			await expect(
				service.reportIncident(OTHER_PORTER_ID, TRIP_ID, report())
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(repository.insertIfAbsent).not.toHaveBeenCalled();
			expect(events.emitTripIncidentReported).not.toHaveBeenCalled();
		});

		it("returns 404 for an unknown Trip", async () => {
			repository.findTrip.mockResolvedValue(null);

			await expect(service.reportIncident(PORTER_ID, TRIP_ID, report())).rejects.toBeInstanceOf(
				NotFoundException
			);
		});

		it("returns the stored incident unchanged when the same id is synchronized again", async () => {
			await service.reportIncident(PORTER_ID, TRIP_ID, report());
			const retry = await service.reportIncident(
				PORTER_ID,
				TRIP_ID,
				report({ description: "edited on the device after the first sync" })
			);

			expect(retry.outcome).toBe(IncidentReportOutcome.DUPLICATE);
			expect(retry.incident.description).toBe("Camper twisted an ankle near checkpoint 2");
			expect(rows.size).toBe(1);
			expect(events.emitTripIncidentReported).toHaveBeenCalledTimes(1);
		});

		it("still acknowledges a duplicate after the Trip has completed", async () => {
			await service.reportIncident(PORTER_ID, TRIP_ID, report());
			repository.findTrip.mockResolvedValue(trip(TripStatus.COMPLETED));

			const retry = await service.reportIncident(PORTER_ID, TRIP_ID, report());
			expect(retry.outcome).toBe(IncidentReportOutcome.DUPLICATE);
		});

		it("treats a lost concurrent insert race as a duplicate", async () => {
			repository.insertIfAbsent.mockImplementationOnce(async (incident: NewIncident) => {
				rows.set(incident.id, storedRow(incident));
				return false;
			});

			const result = await service.reportIncident(PORTER_ID, TRIP_ID, report());
			expect(result.outcome).toBe(IncidentReportOutcome.DUPLICATE);
			expect(events.emitTripIncidentReported).not.toHaveBeenCalled();
		});

		it("rejects an id already used by another Porter's report", async () => {
			await service.reportIncident(OTHER_PORTER_ID, TRIP_ID, report());

			await expect(service.reportIncident(PORTER_ID, TRIP_ID, report())).rejects.toMatchObject({
				response: expect.objectContaining({ code: IncidentErrorCode.ID_CONFLICT }),
			});
		});

		it("rejects an id already used on another Trip", async () => {
			await service.reportIncident(PORTER_ID, OTHER_TRIP_ID, report());

			await expect(service.reportIncident(PORTER_ID, TRIP_ID, report())).rejects.toBeInstanceOf(
				ConflictException
			);
		});

		it.each([TripStatus.PUBLISHED, TripStatus.CANCELLED, TripStatus.DRAFT])(
			"rejects reports for a %s Trip",
			async (status) => {
				repository.findTrip.mockResolvedValue(trip(status));

				await expect(service.reportIncident(PORTER_ID, TRIP_ID, report())).rejects.toMatchObject({
					response: expect.objectContaining({ code: IncidentErrorCode.TRIP_NOT_IN_PROGRESS }),
				});
				expect(repository.insertIfAbsent).not.toHaveBeenCalled();
			}
		);

		it("accepts an offline incident synchronized after the Trip completed", async () => {
			repository.findTrip.mockResolvedValue(trip(TripStatus.COMPLETED));

			const result = await service.reportIncident(PORTER_ID, TRIP_ID, report());
			expect(result.outcome).toBe(IncidentReportOutcome.CREATED);
		});

		it.each([
			["before the Trip started", "2026-10-12T00:59:00.000Z", TripStatus.ONGOING],
			["after a completed Trip ended", "2026-10-12T09:01:00.000Z", TripStatus.COMPLETED],
		])("rejects an incident time %s", async (_label, occurredAt, status) => {
			jest.setSystemTime(new Date("2026-10-12T10:00:00.000Z"));
			repository.findTrip.mockResolvedValue(trip(status));

			await expect(
				service.reportIncident(PORTER_ID, TRIP_ID, report({ occurredAt, location: null }))
			).rejects.toMatchObject({
				response: expect.objectContaining({ code: IncidentErrorCode.OUTSIDE_TRIP_WINDOW }),
			});
		});

		it("accepts an incident on an ongoing Trip that overran its scheduled end", async () => {
			jest.setSystemTime(new Date("2026-10-12T09:30:00.000Z"));

			const result = await service.reportIncident(
				PORTER_ID,
				TRIP_ID,
				report({ occurredAt: "2026-10-12T09:20:00.000Z", location: null })
			);
			expect(result.outcome).toBe(IncidentReportOutcome.CREATED);
		});

		it("rejects an event time in the future beyond clock skew", async () => {
			await expect(
				service.reportIncident(
					PORTER_ID,
					TRIP_ID,
					report({ occurredAt: "2026-10-12T05:10:00.000Z", location: null })
				)
			).rejects.toBeInstanceOf(UnprocessableEntityException);
		});

		it("stores no coordinates and marks the location unavailable when none was captured", async () => {
			const result = await service.reportIncident(PORTER_ID, TRIP_ID, report({ location: null }));

			expect(result.incident.location).toBeNull();
			expect(result.incident.locationStatus).toBe(IncidentLocationStatus.UNAVAILABLE);
			expect(repository.insertIfAbsent).toHaveBeenCalledWith(
				expect.objectContaining({ latitude: null, longitude: null })
			);
		});

		it("flags a location fix captured long before the incident as stale", async () => {
			const result = await service.reportIncident(
				PORTER_ID,
				TRIP_ID,
				report({
					location: {
						latitude: 16.05,
						longitude: 108.23,
						accuracyMeters: 30,
						capturedAt: "2026-10-12T03:00:00.000Z",
					},
				})
			);
			expect(result.incident.locationStatus).toBe(IncidentLocationStatus.STALE);
		});
	});

	describe("classifyLocation", () => {
		const occurredAt = Date.parse("2026-10-12T04:30:00.000Z");
		const fix = (capturedAt: string) => ({
			latitude: 1,
			longitude: 1,
			accuracyMeters: 5,
			capturedAt,
		});

		it("is fresh within five minutes either side of the event", () => {
			expect(classifyLocation(fix("2026-10-12T04:25:00.000Z"), occurredAt)).toBe(
				IncidentLocationStatus.FRESH
			);
			expect(classifyLocation(fix("2026-10-12T04:35:00.000Z"), occurredAt)).toBe(
				IncidentLocationStatus.FRESH
			);
		});

		it("is stale beyond five minutes", () => {
			expect(classifyLocation(fix("2026-10-12T04:24:59.000Z"), occurredAt)).toBe(
				IncidentLocationStatus.STALE
			);
		});

		it("is unavailable without a fix", () => {
			expect(classifyLocation(null, occurredAt)).toBe(IncidentLocationStatus.UNAVAILABLE);
		});
	});

	describe("listIncidents", () => {
		it("returns every incident to the Trip's Host", async () => {
			await service.listIncidents(HOST_ID, [UserRole.HOST], TRIP_ID);
			expect(repository.listForTrip).toHaveBeenCalledWith(TRIP_ID, null);
		});

		it("returns only own reports to an assigned Porter", async () => {
			await service.listIncidents(PORTER_ID, [UserRole.PORTER], TRIP_ID);
			expect(repository.listForTrip).toHaveBeenCalledWith(TRIP_ID, PORTER_ID);
		});

		it("rejects another Host and an unassigned Porter", async () => {
			repository.isPorterAssigned.mockResolvedValue(false);

			await expect(
				service.listIncidents(OTHER_PORTER_ID, [UserRole.HOST], TRIP_ID)
			).rejects.toBeInstanceOf(ForbiddenException);
			await expect(
				service.listIncidents(OTHER_PORTER_ID, [UserRole.PORTER], TRIP_ID)
			).rejects.toBeInstanceOf(ForbiddenException);
		});
	});

	describe("attachMedia (BR-224)", () => {
		beforeEach(async () => {
			await service.reportIncident(PORTER_ID, TRIP_ID, report());
		});

		it("verifies and stores a JPEG photo", async () => {
			await service.attachMedia(PORTER_ID, TRIP_ID, INCIDENT_ID, {
				buffer: JPEG_BYTES,
				size: JPEG_BYTES.length,
			});

			expect(mediaStorage.save).toHaveBeenCalled();
			expect(repository.attachMediaIfAbsent).toHaveBeenCalledWith(
				INCIDENT_ID,
				PORTER_ID,
				expect.objectContaining({ contentType: "image/jpeg" })
			);
		});

		it("rejects a file whose bytes are not a supported image, keeping the incident", async () => {
			const fakeImage = Buffer.from("<script>alert(1)</script>");

			await expect(
				service.attachMedia(PORTER_ID, TRIP_ID, INCIDENT_ID, {
					buffer: fakeImage,
					size: fakeImage.length,
				})
			).rejects.toMatchObject({
				response: expect.objectContaining({ code: IncidentErrorCode.MEDIA_INVALID }),
			});
			expect(mediaStorage.save).not.toHaveBeenCalled();
			expect(rows.has(INCIDENT_ID)).toBe(true);
		});

		it("rejects a missing file", async () => {
			await expect(
				service.attachMedia(PORTER_ID, TRIP_ID, INCIDENT_ID, undefined)
			).rejects.toBeInstanceOf(UnprocessableEntityException);
		});

		it("does not replace a photo that is already attached", async () => {
			const existing = rows.get(INCIDENT_ID) as IncidentRow;
			rows.set(INCIDENT_ID, {
				...existing,
				mediaUrl: "/uploads/incidents/first.jpg",
				mediaContentType: "image/jpeg",
				mediaSizeBytes: 10,
				mediaUploadedAt: NOW,
			});

			const result = await service.attachMedia(PORTER_ID, TRIP_ID, INCIDENT_ID, {
				buffer: JPEG_BYTES,
				size: JPEG_BYTES.length,
			});
			expect(result.media?.url).toBe("/uploads/incidents/first.jpg");
			expect(mediaStorage.save).not.toHaveBeenCalled();
		});

		it("rejects another Porter and an incident from another Trip", async () => {
			await expect(
				service.attachMedia(OTHER_PORTER_ID, TRIP_ID, INCIDENT_ID, {
					buffer: JPEG_BYTES,
					size: JPEG_BYTES.length,
				})
			).rejects.toBeInstanceOf(ForbiddenException);
			await expect(
				service.attachMedia(PORTER_ID, OTHER_TRIP_ID, INCIDENT_ID, {
					buffer: JPEG_BYTES,
					size: JPEG_BYTES.length,
				})
			).rejects.toBeInstanceOf(NotFoundException);
		});
	});
});

describe("IncidentMediaStorage.detectImage", () => {
	const storage = new IncidentMediaStorage();

	it.each([
		["image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00])],
		["image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])],
		["image/webp", Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")])],
	])("recognizes %s by its signature", (contentType, bytes) => {
		expect(storage.detectImage(bytes)?.contentType).toBe(contentType);
	});

	it("rejects other content", () => {
		expect(storage.detectImage(Buffer.from("GIF89a....."))).toBeNull();
	});
});
