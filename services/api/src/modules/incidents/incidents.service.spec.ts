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
	IncidentActionType,
	IncidentCategory,
	IncidentErrorCode,
	IncidentLocationStatus,
	IncidentReportOutcome,
	IncidentSeverity,
	IncidentStatus,
} from "./incidents.enums";
import type {
	IncidentActionRow,
	IncidentRow,
	IncidentTrip,
	IncidentsRepository,
	NewIncident,
} from "./incidents.repository";
import { IncidentsService, classifyLocation, isValidStatusTransition } from "./incidents.service";

const PORTER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PORTER_ID = "22222222-2222-4222-8222-222222222222";
const HOST_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_HOST_ID = "77777777-7777-4777-8777-777777777777";
const ASSIGNEE_ID = "88888888-8888-4888-8888-888888888888";
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
		assignedTo: null,
		assignedToName: null,
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
		findUser: jest.Mock;
		isPorterAssigned: jest.Mock;
		insertIfAbsent: jest.Mock;
		findById: jest.Mock;
		listForTrip: jest.Mock;
		attachMediaIfAbsent: jest.Mock;
		assignHandler: jest.Mock;
		updateStatus: jest.Mock;
		listActions: jest.Mock;
	};
	let mediaStorage: IncidentMediaStorage;
	let events: { emitTripIncidentReported: jest.Mock; emitTripIncidentUpdated: jest.Mock };
	let service: IncidentsService;

	beforeEach(() => {
		jest.useFakeTimers({ now: NOW });
		rows = new Map();
		repository = {
			findTrip: jest.fn().mockResolvedValue(trip(TripStatus.ONGOING)),
			findUser: jest.fn().mockImplementation(async (userId: string) => ({
				id: userId,
				fullName: "Assigned Porter",
				role: "porter",
			})),
			isPorterAssigned: jest.fn().mockResolvedValue(true),
			insertIfAbsent: jest.fn(async (incident: NewIncident) => {
				if (rows.has(incident.id)) return false;
				rows.set(incident.id, storedRow(incident));
				return true;
			}),
			findById: jest.fn(async (id: string) => rows.get(id) ?? null),
			listForTrip: jest.fn().mockResolvedValue([]),
			attachMediaIfAbsent: jest.fn(
				async (
					id: string,
					_actorId: string,
					media: { url: string; contentType: string; sizeBytes: number }
				) => {
					const row = rows.get(id);
					if (!row) return false;
					rows.set(id, {
						...row,
						mediaUrl: media.url,
						mediaContentType: media.contentType,
						mediaSizeBytes: media.sizeBytes,
						mediaUploadedAt: NOW,
					});
					return true;
				}
			),
			assignHandler: jest.fn(async (id: string, _actorId: string, assignedTo: string | null) => {
				const row = rows.get(id);
				if (!row) return null;
				const updated: IncidentRow = {
					...row,
					assignedTo,
					assignedToName: assignedTo ? "Assigned Porter" : null,
				};
				rows.set(id, updated);
				return updated;
			}),
			updateStatus: jest.fn(
				async (
					id: string,
					_actorId: string,
					fromStatus: IncidentStatus,
					toStatus: IncidentStatus
				) => {
					const row = rows.get(id);
					if (!row || row.status !== fromStatus) return null;
					const updated: IncidentRow = { ...row, status: toStatus };
					rows.set(id, updated);
					return updated;
				}
			),
			listActions: jest.fn().mockResolvedValue([]),
		};
		mediaStorage = new IncidentMediaStorage();
		jest.spyOn(mediaStorage, "save").mockResolvedValue({
			url: `/uploads/incidents/${INCIDENT_ID}.jpg`,
			contentType: "image/jpeg",
			sizeBytes: JPEG_BYTES.length,
		});
		events = {
			emitTripIncidentReported: jest.fn(),
			emitTripIncidentUpdated: jest.fn(),
		};
		service = new IncidentsService(
			repository as unknown as IncidentsRepository,
			mediaStorage,
			events as unknown as EventsGateway
		);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("reportIncident (BR-161 / BR-162 / BR-221 / PB AC-1)", () => {
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
				capturedOffline: true,
				locationStatus: IncidentLocationStatus.FRESH,
			});
			expect(events.emitTripIncidentReported).toHaveBeenCalledWith({
				incidentId: INCIDENT_ID,
				tripId: TRIP_ID,
				hostId: HOST_ID,
				reporterId: PORTER_ID,
				category: IncidentCategory.INJURY,
				severity: IncidentSeverity.HIGH,
				occurredAt: "2026-10-12T04:30:00.000Z",
			});
		});

		it("allows the authorized Host of the Trip to create an incident directly (PB AC-1)", async () => {
			const result = await service.reportIncident(HOST_ID, TRIP_ID, report(), [UserRole.HOST]);
			expect(result.outcome).toBe(IncidentReportOutcome.CREATED);
			expect(result.incident.reporterId).toBe(HOST_ID);
		});

		it("rejects a Porter not assigned to the Trip without any side effect", async () => {
			repository.isPorterAssigned.mockResolvedValue(false);

			await expect(service.reportIncident(PORTER_ID, TRIP_ID, report())).rejects.toBeInstanceOf(
				ForbiddenException
			);
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
			events.emitTripIncidentReported.mockClear();

			const retry = await service.reportIncident(
				PORTER_ID,
				TRIP_ID,
				report({ description: "mutated description must be ignored" })
			);

			expect(retry.outcome).toBe(IncidentReportOutcome.DUPLICATE);
			expect(retry.incident.description).toBe("Camper twisted an ankle near checkpoint 2");
			expect(events.emitTripIncidentReported).not.toHaveBeenCalled();
		});

		it("still acknowledges a duplicate after the Trip has completed", async () => {
			await service.reportIncident(PORTER_ID, TRIP_ID, report());
			repository.findTrip.mockResolvedValue(trip(TripStatus.COMPLETED));

			const retry = await service.reportIncident(PORTER_ID, TRIP_ID, report());
			expect(retry.outcome).toBe(IncidentReportOutcome.DUPLICATE);
		});

		it("treats a lost concurrent insert race as a duplicate", async () => {
			const initial = report();
			rows.set(
				initial.id,
				storedRow({
					...initial,
					tripId: TRIP_ID,
					reporterId: PORTER_ID,
					locationStatus: IncidentLocationStatus.FRESH,
					latitude: 16.05,
					longitude: 108.23,
					locationAccuracyMeters: 12,
					locationCapturedAt: "2026-10-12T04:31:00.000Z",
					capturedOffline: true,
				})
			);
			repository.findById
				.mockResolvedValueOnce(null)
				.mockResolvedValue(rows.get(initial.id) as IncidentRow);
			repository.insertIfAbsent.mockResolvedValue(false);

			const result = await service.reportIncident(PORTER_ID, TRIP_ID, initial);
			expect(result.outcome).toBe(IncidentReportOutcome.DUPLICATE);
		});

		it("rejects an id already used by another Porter's report", async () => {
			await service.reportIncident(PORTER_ID, TRIP_ID, report());

			await expect(
				service.reportIncident(OTHER_PORTER_ID, TRIP_ID, report())
			).rejects.toMatchObject({
				response: expect.objectContaining({ code: IncidentErrorCode.ID_CONFLICT }),
			});
		});

		it("rejects an id already used on another Trip", async () => {
			await service.reportIncident(PORTER_ID, TRIP_ID, report());

			await expect(
				service.reportIncident(PORTER_ID, OTHER_TRIP_ID, report())
			).rejects.toMatchObject({
				response: expect.objectContaining({ code: IncidentErrorCode.ID_CONFLICT }),
			});
		});

		it.each([TripStatus.PUBLISHED, TripStatus.CANCELLED, TripStatus.DRAFT])(
			"rejects reports for a %s Trip",
			async (status) => {
				repository.findTrip.mockResolvedValue(trip(status));

				await expect(service.reportIncident(PORTER_ID, TRIP_ID, report())).rejects.toMatchObject({
					response: expect.objectContaining({ code: IncidentErrorCode.TRIP_NOT_IN_PROGRESS }),
				});
			}
		);

		it("accepts an offline incident synchronized after the Trip completed", async () => {
			repository.findTrip.mockResolvedValue(trip(TripStatus.COMPLETED));

			const result = await service.reportIncident(PORTER_ID, TRIP_ID, report());
			expect(result.outcome).toBe(IncidentReportOutcome.CREATED);
		});

		it("rejects an incident time before the Trip started", async () => {
			await expect(
				service.reportIncident(
					PORTER_ID,
					TRIP_ID,
					report({ occurredAt: "2026-10-12T00:59:00.000Z" })
				)
			).rejects.toMatchObject({
				response: expect.objectContaining({ code: IncidentErrorCode.OUTSIDE_TRIP_WINDOW }),
			});
		});

		it("rejects an incident time after a completed Trip ended", async () => {
			jest.setSystemTime(new Date("2026-10-12T10:00:00.000Z"));
			repository.findTrip.mockResolvedValue(trip(TripStatus.COMPLETED));

			await expect(
				service.reportIncident(
					PORTER_ID,
					TRIP_ID,
					report({ occurredAt: "2026-10-12T09:05:00.000Z" })
				)
			).rejects.toMatchObject({
				response: expect.objectContaining({ code: IncidentErrorCode.OUTSIDE_TRIP_WINDOW }),
			});
		});

		it("accepts an incident on an ongoing Trip that overran its scheduled end", async () => {
			const overrunTime = new Date(TRIP_END.getTime() + 30 * 60 * 1000);
			jest.useFakeTimers({ now: overrunTime });

			const result = await service.reportIncident(
				PORTER_ID,
				TRIP_ID,
				report({
					occurredAt: overrunTime.toISOString(),
					location: {
						latitude: 16.05,
						longitude: 108.23,
						accuracyMeters: 10,
						capturedAt: overrunTime.toISOString(),
					},
				})
			);
			expect(result.outcome).toBe(IncidentReportOutcome.CREATED);
		});

		it("rejects an event time in the future beyond clock skew", async () => {
			await expect(
				service.reportIncident(
					PORTER_ID,
					TRIP_ID,
					report({ occurredAt: "2026-10-12T05:10:00.000Z" })
				)
			).rejects.toBeInstanceOf(UnprocessableEntityException);
		});

		it("stores no coordinates and marks the location unavailable when none was captured", async () => {
			const result = await service.reportIncident(PORTER_ID, TRIP_ID, report({ location: null }));
			expect(result.incident.location).toBeNull();
			expect(result.incident.locationStatus).toBe(IncidentLocationStatus.UNAVAILABLE);
		});

		it("flags a location fix captured long before the incident as stale", async () => {
			const result = await service.reportIncident(
				PORTER_ID,
				TRIP_ID,
				report({
					occurredAt: "2026-10-12T04:30:00.000Z",
					location: {
						latitude: 16.05,
						longitude: 108.23,
						accuracyMeters: 5,
						capturedAt: "2026-10-12T04:15:00.000Z",
					},
				})
			);
			expect(result.incident.locationStatus).toBe(IncidentLocationStatus.STALE);
		});
	});

	describe("assignIncident (CTMS-086, PB AC-2, PB AC-5)", () => {
		beforeEach(async () => {
			await service.reportIncident(PORTER_ID, TRIP_ID, report());
		});

		it("allows authorized Host to assign handling responsibility", async () => {
			const result = await service.assignIncident(HOST_ID, TRIP_ID, INCIDENT_ID, {
				assignedTo: ASSIGNEE_ID,
				note: "Assigned to lead porter for immediate assistance",
			});

			expect(result.assignedTo).toBe(ASSIGNEE_ID);
			expect(events.emitTripIncidentUpdated).toHaveBeenCalledWith(
				expect.objectContaining({
					incidentId: INCIDENT_ID,
					tripId: TRIP_ID,
					hostId: HOST_ID,
					assignedTo: ASSIGNEE_ID,
				})
			);
		});

		it("allows authorized Host to unassign handler", async () => {
			const result = await service.assignIncident(HOST_ID, TRIP_ID, INCIDENT_ID, {
				assignedTo: null,
			});
			expect(result.assignedTo).toBeNull();
		});

		it("rejects assignment by unauthorized user (PB AC-5)", async () => {
			await expect(
				service.assignIncident(OTHER_HOST_ID, TRIP_ID, INCIDENT_ID, { assignedTo: ASSIGNEE_ID })
			).rejects.toBeInstanceOf(ForbiddenException);
		});

		it("rejects assignment if assignee user does not exist", async () => {
			repository.findUser.mockResolvedValue(null);
			await expect(
				service.assignIncident(HOST_ID, TRIP_ID, INCIDENT_ID, { assignedTo: ASSIGNEE_ID })
			).rejects.toBeInstanceOf(NotFoundException);
		});

		it("rejects assignment for unknown incident", async () => {
			await expect(
				service.assignIncident(HOST_ID, TRIP_ID, "00000000-0000-0000-0000-000000000000", {
					assignedTo: ASSIGNEE_ID,
				})
			).rejects.toBeInstanceOf(NotFoundException);
		});
	});

	describe("updateStatus (CTMS-086, PB AC-3, PB AC-5, BR-269)", () => {
		beforeEach(async () => {
			await service.reportIncident(PORTER_ID, TRIP_ID, report());
		});

		it("transitions incident from OPEN to INVESTIGATING with action note", async () => {
			const result = await service.updateStatus(HOST_ID, TRIP_ID, INCIDENT_ID, {
				status: IncidentStatus.INVESTIGATING,
				note: "Host initiated triage with medical team",
			});

			expect(result.status).toBe(IncidentStatus.INVESTIGATING);
			expect(events.emitTripIncidentUpdated).toHaveBeenCalledWith(
				expect.objectContaining({
					incidentId: INCIDENT_ID,
					status: IncidentStatus.INVESTIGATING,
				})
			);
		});

		it("transitions through valid chain: OPEN -> INVESTIGATING -> RESOLVED -> CLOSED", async () => {
			let result = await service.updateStatus(HOST_ID, TRIP_ID, INCIDENT_ID, {
				status: IncidentStatus.INVESTIGATING,
			});
			expect(result.status).toBe(IncidentStatus.INVESTIGATING);

			result = await service.updateStatus(HOST_ID, TRIP_ID, INCIDENT_ID, {
				status: IncidentStatus.RESOLVED,
				note: "First aid administered, camper walking comfortably",
			});
			expect(result.status).toBe(IncidentStatus.RESOLVED);

			result = await service.updateStatus(HOST_ID, TRIP_ID, INCIDENT_ID, {
				status: IncidentStatus.CLOSED,
				note: "Post-trip check completed, incident closed",
			});
			expect(result.status).toBe(IncidentStatus.CLOSED);
		});

		it("rejects transition to the same status", async () => {
			await expect(
				service.updateStatus(HOST_ID, TRIP_ID, INCIDENT_ID, {
					status: IncidentStatus.OPEN,
				})
			).rejects.toBeInstanceOf(ConflictException);
		});

		it("allows transitioning back to OPEN or RESOLVED from CLOSED", async () => {
			await service.updateStatus(HOST_ID, TRIP_ID, INCIDENT_ID, {
				status: IncidentStatus.CLOSED,
			});

			const result = await service.updateStatus(HOST_ID, TRIP_ID, INCIDENT_ID, {
				status: IncidentStatus.OPEN,
				note: "Reopening incident for further check",
			});
			expect(result.status).toBe(IncidentStatus.OPEN);
		});

		it("rejects update by unauthorized user (PB AC-5)", async () => {
			await expect(
				service.updateStatus(OTHER_HOST_ID, TRIP_ID, INCIDENT_ID, {
					status: IncidentStatus.INVESTIGATING,
				})
			).rejects.toBeInstanceOf(ForbiddenException);
		});

		it("detects concurrent update conflict and rejects without overwriting", async () => {
			repository.updateStatus.mockResolvedValue(null);

			await expect(
				service.updateStatus(HOST_ID, TRIP_ID, INCIDENT_ID, {
					status: IncidentStatus.INVESTIGATING,
				})
			).rejects.toBeInstanceOf(ConflictException);
		});
	});

	describe("listHistory (CTMS-086, PB AC-4)", () => {
		const actionRows: IncidentActionRow[] = [
			{
				id: "action-1",
				incidentId: INCIDENT_ID,
				actorId: PORTER_ID,
				actorName: "Porter A",
				actorRole: "porter",
				action: IncidentActionType.REPORTED,
				fromStatus: null,
				toStatus: IncidentStatus.OPEN,
				note: null,
				createdAt: NOW,
			},
			{
				id: "action-2",
				incidentId: INCIDENT_ID,
				actorId: HOST_ID,
				actorName: "Host H",
				actorRole: "host",
				action: IncidentActionType.ASSIGNED,
				fromStatus: IncidentStatus.OPEN,
				toStatus: IncidentStatus.OPEN,
				note: "Assigned to medical lead",
				createdAt: new Date(NOW.getTime() + 1000),
			},
		];

		beforeEach(async () => {
			await service.reportIncident(PORTER_ID, TRIP_ID, report());
			repository.listActions.mockResolvedValue(actionRows);
		});

		it("returns chronological action logs to authorized Host", async () => {
			const result = await service.listHistory(HOST_ID, [UserRole.HOST], TRIP_ID, INCIDENT_ID);
			expect(result.items).toHaveLength(2);
			expect(result.items[0].action).toBe(IncidentActionType.REPORTED);
			expect(result.items[1].action).toBe(IncidentActionType.ASSIGNED);
			expect(result.items[1].note).toBe("Assigned to medical lead");
		});

		it("returns action logs to assigned Porter", async () => {
			const result = await service.listHistory(PORTER_ID, [UserRole.PORTER], TRIP_ID, INCIDENT_ID);
			expect(result.items).toHaveLength(2);
		});

		it("rejects unauthorized user viewing history", async () => {
			repository.isPorterAssigned.mockResolvedValue(false);
			await expect(
				service.listHistory(OTHER_PORTER_ID, [UserRole.PORTER], TRIP_ID, INCIDENT_ID)
			).rejects.toBeInstanceOf(ForbiddenException);
		});
	});

	describe("isValidStatusTransition", () => {
		it("validates OPEN transitions", () => {
			expect(isValidStatusTransition(IncidentStatus.OPEN, IncidentStatus.INVESTIGATING)).toBe(true);
			expect(isValidStatusTransition(IncidentStatus.OPEN, IncidentStatus.RESOLVED)).toBe(true);
			expect(isValidStatusTransition(IncidentStatus.OPEN, IncidentStatus.CLOSED)).toBe(true);
			expect(isValidStatusTransition(IncidentStatus.OPEN, IncidentStatus.OPEN)).toBe(false);
		});

		it("validates INVESTIGATING transitions", () => {
			expect(isValidStatusTransition(IncidentStatus.INVESTIGATING, IncidentStatus.OPEN)).toBe(true);
			expect(isValidStatusTransition(IncidentStatus.INVESTIGATING, IncidentStatus.RESOLVED)).toBe(
				true
			);
			expect(isValidStatusTransition(IncidentStatus.INVESTIGATING, IncidentStatus.CLOSED)).toBe(
				true
			);
			expect(
				isValidStatusTransition(IncidentStatus.INVESTIGATING, IncidentStatus.INVESTIGATING)
			).toBe(false);
		});

		it("validates RESOLVED transitions", () => {
			expect(isValidStatusTransition(IncidentStatus.RESOLVED, IncidentStatus.INVESTIGATING)).toBe(
				true
			);
			expect(isValidStatusTransition(IncidentStatus.RESOLVED, IncidentStatus.CLOSED)).toBe(true);
			expect(isValidStatusTransition(IncidentStatus.RESOLVED, IncidentStatus.OPEN)).toBe(true);
			expect(isValidStatusTransition(IncidentStatus.RESOLVED, IncidentStatus.RESOLVED)).toBe(false);
		});

		it("validates CLOSED transitions to any non-identical status", () => {
			expect(isValidStatusTransition(IncidentStatus.CLOSED, IncidentStatus.OPEN)).toBe(true);
			expect(isValidStatusTransition(IncidentStatus.CLOSED, IncidentStatus.INVESTIGATING)).toBe(
				true
			);
			expect(isValidStatusTransition(IncidentStatus.CLOSED, IncidentStatus.RESOLVED)).toBe(true);
			expect(isValidStatusTransition(IncidentStatus.CLOSED, IncidentStatus.CLOSED)).toBe(false);
		});
	});

	describe("classifyLocation", () => {
		const base = Date.parse("2026-10-12T04:30:00.000Z");

		it("is fresh within five minutes either side of the event", () => {
			expect(
				classifyLocation(
					{
						latitude: 16,
						longitude: 108,
						accuracyMeters: 5,
						capturedAt: "2026-10-12T04:26:00.000Z",
					},
					base
				)
			).toBe(IncidentLocationStatus.FRESH);
		});

		it("is stale beyond five minutes", () => {
			expect(
				classifyLocation(
					{
						latitude: 16,
						longitude: 108,
						accuracyMeters: 5,
						capturedAt: "2026-10-12T04:24:00.000Z",
					},
					base
				)
			).toBe(IncidentLocationStatus.STALE);
		});

		it("is unavailable without a fix", () => {
			expect(classifyLocation(null, base)).toBe(IncidentLocationStatus.UNAVAILABLE);
		});
	});

	describe("listIncidents", () => {
		it("returns every incident to the Trip's Host", async () => {
			const rowsArray: IncidentRow[] = [
				storedRow({
					...report(),
					tripId: TRIP_ID,
					reporterId: PORTER_ID,
					locationStatus: IncidentLocationStatus.FRESH,
					latitude: 16,
					longitude: 108,
					locationAccuracyMeters: 5,
					locationCapturedAt: null,
					capturedOffline: false,
				}),
			];
			repository.listForTrip.mockResolvedValue(rowsArray);

			const result = await service.listIncidents(HOST_ID, [UserRole.HOST], TRIP_ID);
			expect(repository.listForTrip).toHaveBeenCalledWith(TRIP_ID, null);
			expect(result.items).toHaveLength(1);
		});

		it("returns only own reports to an assigned Porter", async () => {
			await service.listIncidents(PORTER_ID, [UserRole.PORTER], TRIP_ID);
			expect(repository.listForTrip).toHaveBeenCalledWith(TRIP_ID, PORTER_ID);
		});

		it("rejects another Host and an unassigned Porter", async () => {
			await expect(
				service.listIncidents(OTHER_HOST_ID, [UserRole.HOST], TRIP_ID)
			).rejects.toBeInstanceOf(ForbiddenException);

			repository.isPorterAssigned.mockResolvedValue(false);
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
			const result = await service.attachMedia(PORTER_ID, TRIP_ID, INCIDENT_ID, {
				buffer: JPEG_BYTES,
				size: JPEG_BYTES.length,
			});

			expect(result.media).toEqual({
				url: `/uploads/incidents/${INCIDENT_ID}.jpg`,
				contentType: "image/jpeg",
				sizeBytes: JPEG_BYTES.length,
				uploadedAt: NOW.toISOString(),
			});
			expect(repository.attachMediaIfAbsent).toHaveBeenCalledWith(
				INCIDENT_ID,
				PORTER_ID,
				expect.objectContaining({ url: `/uploads/incidents/${INCIDENT_ID}.jpg` })
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
