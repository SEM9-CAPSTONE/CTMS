import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { EventsGateway } from "../realtime/events.gateway";
import { TripStatus } from "../trips/entities/trip.entity";
import { UserRole } from "../users/entities/user.entity";
import type { AssignIncidentDto } from "./dto/assign-incident.dto";
import type {
	IncidentActionListResponseDto,
	IncidentActionResponseDto,
} from "./dto/incident-action-response.dto";
import type {
	IncidentListResponseDto,
	IncidentResponseDto,
	ReportIncidentResponseDto,
} from "./dto/incident-response.dto";
import type { IncidentLocationInputDto, ReportIncidentDto } from "./dto/report-incident.dto";
import type { UpdateIncidentStatusDto } from "./dto/update-incident-status.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { IncidentMediaStorage } from "./incident-media.storage";
import {
	INCIDENT_CLOCK_SKEW_SECONDS,
	INCIDENT_LOCATION_STALE_AFTER_SECONDS,
	INCIDENT_MEDIA_MAX_BYTES,
} from "./incidents.constants";
import {
	IncidentErrorCode,
	IncidentLocationStatus,
	IncidentReportOutcome,
	IncidentStatus,
} from "./incidents.enums";
import {
	type IncidentActionRow,
	type IncidentRow,
	type IncidentTrip,
	// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
	IncidentsRepository,
	type NewIncident,
} from "./incidents.repository";

export interface IncidentMediaUpload {
	buffer: Buffer;
	size: number;
}

/** Trip states in which incidents (live or synchronized late) are accepted. */
const INCIDENT_ACCEPTING_TRIP_STATUSES: ReadonlySet<TripStatus> = new Set([
	TripStatus.ONGOING,
	TripStatus.COMPLETED,
]);

const SECOND_MS = 1000;

/** Valid status transitions (CTMS-086, PB AC-3, BR-269). Allows any transition between non-identical statuses. */
const VALID_INCIDENT_TRANSITIONS: Readonly<Record<IncidentStatus, ReadonlySet<IncidentStatus>>> = {
	[IncidentStatus.OPEN]: new Set([
		IncidentStatus.INVESTIGATING,
		IncidentStatus.RESOLVED,
		IncidentStatus.CLOSED,
	]),
	[IncidentStatus.INVESTIGATING]: new Set([
		IncidentStatus.OPEN,
		IncidentStatus.RESOLVED,
		IncidentStatus.CLOSED,
	]),
	[IncidentStatus.RESOLVED]: new Set([
		IncidentStatus.OPEN,
		IncidentStatus.INVESTIGATING,
		IncidentStatus.CLOSED,
	]),
	[IncidentStatus.CLOSED]: new Set([
		IncidentStatus.OPEN,
		IncidentStatus.INVESTIGATING,
		IncidentStatus.RESOLVED,
	]),
};

export function isValidStatusTransition(from: IncidentStatus, to: IncidentStatus): boolean {
	if (from === to) return false;
	const allowed = VALID_INCIDENT_TRANSITIONS[from];
	return allowed ? allowed.has(to) : false;
}

@Injectable()
export class IncidentsService {
	constructor(
		private readonly incidents: IncidentsRepository,
		private readonly mediaStorage: IncidentMediaStorage,
		private readonly events: EventsGateway
	) {}

	/**
	 * Records an incident idempotently (CTMS-049 / CTMS-086, PB AC-1).
	 * Authorized Host or assigned Porter may report incidents.
	 * A repeated sync of an id the same reporter already stored returns that stored incident
	 * unchanged (BR-162, BR-221); a rejected report has no side effect (BR-243).
	 */
	async reportIncident(
		reporterId: string,
		tripId: string,
		dto: ReportIncidentDto,
		roles: string[] = []
	): Promise<ReportIncidentResponseDto> {
		const trip = await this.requireTrip(tripId);
		const isHost = trip.hostId === reporterId || roles.includes(UserRole.HOST);
		const isAssignedPorter = await this.incidents.isPorterAssigned(tripId, reporterId);

		if (!isHost && !isAssignedPorter) {
			throw new ForbiddenException(
				"Only the Trip's Host or an assigned Porter can report incidents"
			);
		}

		const existing = await this.incidents.findById(dto.id);
		if (existing) {
			return this.duplicateOutcome(existing, reporterId, tripId);
		}

		const now = Date.now();
		const occurredAt = Date.parse(dto.occurredAt);
		this.assertNotInFuture(occurredAt, now, "occurredAt");
		if (dto.location) {
			this.assertNotInFuture(Date.parse(dto.location.capturedAt), now, "location.capturedAt");
		}
		this.assertAcceptedByTrip(trip, occurredAt, now);

		const newIncident = toNewIncident(dto, tripId, reporterId, occurredAt);
		const inserted = await this.incidents.insertIfAbsent(newIncident);
		const stored = await this.incidents.findById(dto.id);
		if (!stored) {
			throw new NotFoundException("Incident not found");
		}
		if (!inserted) {
			// A concurrent sync of the same id won the insert.
			return this.duplicateOutcome(stored, reporterId, tripId);
		}

		this.events.emitTripIncidentReported({
			incidentId: stored.id,
			tripId,
			hostId: trip.hostId,
			reporterId,
			category: stored.category,
			severity: stored.severity,
			occurredAt: stored.occurredAt.toISOString(),
		});
		return { outcome: IncidentReportOutcome.CREATED, incident: toIncidentResponse(stored) };
	}

	/** The Trip's Host sees every incident; an assigned Porter sees the ones they reported. */
	async listIncidents(
		userId: string,
		roles: string[],
		tripId: string
	): Promise<IncidentListResponseDto> {
		const trip = await this.requireTrip(tripId);
		let reporterFilter: string | null;
		if (roles.includes(UserRole.HOST) && trip.hostId === userId) {
			reporterFilter = null;
		} else if (
			roles.includes(UserRole.PORTER) &&
			(await this.incidents.isPorterAssigned(tripId, userId))
		) {
			reporterFilter = userId;
		} else {
			throw new ForbiddenException("You cannot view incidents of this Trip");
		}

		const rows = await this.incidents.listForTrip(tripId, reporterFilter);
		return { items: rows.map(toIncidentResponse) };
	}

	/**
	 * Attaches the optional photo to an already-stored incident. Media is a separate
	 * step so its failure never invalidates the incident itself (BR-224); a retry after
	 * success returns the stored incident without replacing the photo.
	 */
	async attachMedia(
		reporterId: string,
		tripId: string,
		incidentId: string,
		file: IncidentMediaUpload | undefined
	): Promise<IncidentResponseDto> {
		const incident = await this.incidents.findById(incidentId);
		if (!incident || incident.tripId !== tripId) {
			throw new NotFoundException("Incident not found");
		}
		if (incident.reporterId !== reporterId) {
			throw new ForbiddenException("Only the reporting user can attach media to this incident");
		}
		if (incident.mediaUrl) {
			return toIncidentResponse(incident);
		}

		const signature = file ? this.mediaStorage.detectImage(file.buffer) : null;
		if (!file || !signature || file.size > INCIDENT_MEDIA_MAX_BYTES) {
			throw new UnprocessableEntityException({
				statusCode: 422,
				error: "Unprocessable Entity",
				code: IncidentErrorCode.MEDIA_INVALID,
				message: "Attach one JPEG, PNG or WebP image of at most 5 MB",
			});
		}

		const media = await this.mediaStorage.save(incidentId, file.buffer, signature);
		await this.incidents.attachMediaIfAbsent(incidentId, reporterId, media);
		const updated = await this.incidents.findById(incidentId);
		return toIncidentResponse(updated ?? incident);
	}

	/**
	 * Assigns handling responsibility for an incident (CTMS-086, PB AC-2, PB AC-5).
	 * Only the authorized Host of the Trip can assign handlers.
	 */
	async assignIncident(
		hostId: string,
		tripId: string,
		incidentId: string,
		dto: AssignIncidentDto
	): Promise<IncidentResponseDto> {
		const trip = await this.requireTrip(tripId);
		if (trip.hostId !== hostId) {
			throw new ForbiddenException("Only the Trip's Host can assign handling responsibility");
		}

		const incident = await this.incidents.findById(incidentId);
		if (!incident || incident.tripId !== tripId) {
			throw new NotFoundException("Incident not found");
		}

		if (dto.assignedTo) {
			const targetUser = await this.incidents.findUser(dto.assignedTo);
			if (!targetUser) {
				throw new NotFoundException("Assignee user not found");
			}
		}

		const updated = await this.incidents.assignHandler(
			incidentId,
			hostId,
			dto.assignedTo ?? null,
			dto.note
		);
		if (!updated) {
			throw new NotFoundException("Incident not found");
		}

		this.events.emitTripIncidentUpdated({
			incidentId: updated.id,
			tripId,
			hostId,
			status: updated.status,
			assignedTo: updated.assignedTo,
			updatedAt: new Date().toISOString(),
		});

		return toIncidentResponse(updated);
	}

	/**
	 * Updates the incident status following valid lifecycle transitions (CTMS-086, PB AC-3, PB AC-5).
	 * Only the authorized Host of the Trip can update status.
	 */
	async updateStatus(
		hostId: string,
		tripId: string,
		incidentId: string,
		dto: UpdateIncidentStatusDto
	): Promise<IncidentResponseDto> {
		const trip = await this.requireTrip(tripId);
		if (trip.hostId !== hostId) {
			throw new ForbiddenException("Only the Trip's Host can update incident status");
		}

		const incident = await this.incidents.findById(incidentId);
		if (!incident || incident.tripId !== tripId) {
			throw new NotFoundException("Incident not found");
		}

		if (!isValidStatusTransition(incident.status, dto.status)) {
			throw new ConflictException({
				statusCode: 409,
				error: "Conflict",
				code: IncidentErrorCode.INVALID_STATUS_TRANSITION,
				message: `Cannot transition incident status from '${incident.status}' to '${dto.status}'`,
			});
		}

		const updated = await this.incidents.updateStatus(
			incidentId,
			hostId,
			incident.status,
			dto.status,
			dto.note
		);
		if (!updated) {
			// Concurrently modified
			throw new ConflictException({
				statusCode: 409,
				error: "Conflict",
				message: "Incident status was concurrently updated by another operation",
			});
		}

		this.events.emitTripIncidentUpdated({
			incidentId: updated.id,
			tripId,
			hostId,
			status: updated.status,
			assignedTo: updated.assignedTo,
			updatedAt: new Date().toISOString(),
		});

		return toIncidentResponse(updated);
	}

	/**
	 * Lists the auditable action history for an incident (CTMS-086, PB AC-4).
	 * Host of the Trip or assigned Porter can view history.
	 */
	async listHistory(
		userId: string,
		roles: string[],
		tripId: string,
		incidentId: string
	): Promise<IncidentActionListResponseDto> {
		const trip = await this.requireTrip(tripId);
		const isHost = roles.includes(UserRole.HOST) && trip.hostId === userId;
		const isAssignedPorter =
			roles.includes(UserRole.PORTER) && (await this.incidents.isPorterAssigned(tripId, userId));

		if (!isHost && !isAssignedPorter) {
			throw new ForbiddenException("You cannot view history of this incident");
		}

		const incident = await this.incidents.findById(incidentId);
		if (!incident || incident.tripId !== tripId) {
			throw new NotFoundException("Incident not found");
		}

		const rows = await this.incidents.listActions(incidentId);
		return {
			items: rows.map(toIncidentActionResponse),
		};
	}

	private async requireTrip(tripId: string): Promise<IncidentTrip> {
		const trip = await this.incidents.findTrip(tripId);
		if (!trip) {
			throw new NotFoundException("Trip not found");
		}
		return trip;
	}

	private duplicateOutcome(
		existing: IncidentRow,
		reporterId: string,
		tripId: string
	): ReportIncidentResponseDto {
		const isOwnRetry = existing.reporterId === reporterId && existing.tripId === tripId;
		if (!isOwnRetry) {
			throw new ConflictException({
				statusCode: 409,
				error: "Conflict",
				code: IncidentErrorCode.ID_CONFLICT,
				message: "This incident id is already used by another report",
			});
		}
		return { outcome: IncidentReportOutcome.DUPLICATE, incident: toIncidentResponse(existing) };
	}

	private assertNotInFuture(timestamp: number, now: number, field: string): void {
		if (timestamp > now + INCIDENT_CLOCK_SKEW_SECONDS * SECOND_MS) {
			throw new UnprocessableEntityException({
				statusCode: 422,
				error: "Unprocessable Entity",
				message: [{ field, errors: [`${field} cannot be in the future`] }],
			});
		}
	}

	/**
	 * Authoritative Trip policy: incidents belong to a Trip that has started, and must
	 * have happened between its start and its end (or now, while it is still ongoing).
	 */
	private assertAcceptedByTrip(trip: IncidentTrip, occurredAt: number, now: number): void {
		if (!INCIDENT_ACCEPTING_TRIP_STATUSES.has(trip.status)) {
			throw new ConflictException({
				statusCode: 409,
				error: "Conflict",
				code: IncidentErrorCode.TRIP_NOT_IN_PROGRESS,
				message: "Incidents can be reported only for an ongoing or just-completed Trip",
			});
		}
		const windowEnd =
			trip.status === TripStatus.ONGOING
				? Math.max(trip.endsAt.getTime(), now) + INCIDENT_CLOCK_SKEW_SECONDS * SECOND_MS
				: trip.endsAt.getTime();
		if (occurredAt < trip.startsAt.getTime() || occurredAt > windowEnd) {
			throw new ConflictException({
				statusCode: 409,
				error: "Conflict",
				code: IncidentErrorCode.OUTSIDE_TRIP_WINDOW,
				message: "The incident time is outside this Trip's operating window",
			});
		}
	}
}

/** Server-side classification of the reported fix; a missing fix is never filled in. */
export function classifyLocation(
	location: IncidentLocationInputDto | null | undefined,
	occurredAt: number
): IncidentLocationStatus {
	if (!location) {
		return IncidentLocationStatus.UNAVAILABLE;
	}
	const ageMs = Math.abs(occurredAt - Date.parse(location.capturedAt));
	return ageMs > INCIDENT_LOCATION_STALE_AFTER_SECONDS * SECOND_MS
		? IncidentLocationStatus.STALE
		: IncidentLocationStatus.FRESH;
}

function toNewIncident(
	dto: ReportIncidentDto,
	tripId: string,
	reporterId: string,
	occurredAt: number
): NewIncident {
	const location = dto.location ?? null;
	return {
		id: dto.id,
		tripId,
		reporterId,
		category: dto.category,
		severity: dto.severity,
		description: dto.description,
		occurredAt: dto.occurredAt,
		latitude: location?.latitude ?? null,
		longitude: location?.longitude ?? null,
		locationAccuracyMeters: location?.accuracyMeters ?? null,
		locationCapturedAt: location?.capturedAt ?? null,
		locationStatus: classifyLocation(location, occurredAt),
		capturedOffline: dto.capturedOffline ?? false,
	};
}

export function toIncidentResponse(row: IncidentRow): IncidentResponseDto {
	const hasLocation =
		row.latitude !== null &&
		row.longitude !== null &&
		row.locationAccuracyMeters !== null &&
		row.locationCapturedAt !== null;
	const hasMedia =
		row.mediaUrl !== null &&
		row.mediaContentType !== null &&
		row.mediaSizeBytes !== null &&
		row.mediaUploadedAt !== null;
	return {
		id: row.id,
		tripId: row.tripId,
		reporterId: row.reporterId,
		reporterName: row.reporterName,
		assignedTo: row.assignedTo,
		assignedToName: row.assignedToName,
		category: row.category,
		severity: row.severity,
		status: row.status,
		description: row.description,
		occurredAt: row.occurredAt.toISOString(),
		location: hasLocation
			? {
					latitude: Number(row.latitude),
					longitude: Number(row.longitude),
					accuracyMeters: Number(row.locationAccuracyMeters),
					capturedAt: (row.locationCapturedAt as Date).toISOString(),
				}
			: null,
		locationStatus: row.locationStatus,
		capturedOffline: row.capturedOffline,
		media: hasMedia
			? {
					url: row.mediaUrl as string,
					contentType: row.mediaContentType as string,
					sizeBytes: Number(row.mediaSizeBytes),
					uploadedAt: (row.mediaUploadedAt as Date).toISOString(),
				}
			: null,
		receivedAt: row.receivedAt.toISOString(),
	};
}

export function toIncidentActionResponse(row: IncidentActionRow): IncidentActionResponseDto {
	return {
		id: row.id,
		incidentId: row.incidentId,
		actorId: row.actorId,
		actorName: row.actorName,
		actorRole: row.actorRole,
		action: row.action,
		fromStatus: row.fromStatus,
		toStatus: row.toStatus,
		note: row.note,
		createdAt: row.createdAt.toISOString(),
	};
}
