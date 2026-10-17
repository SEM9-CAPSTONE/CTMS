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
import type {
	IncidentListResponseDto,
	IncidentResponseDto,
	ReportIncidentResponseDto,
} from "./dto/incident-response.dto";
import type { IncidentLocationInputDto, ReportIncidentDto } from "./dto/report-incident.dto";
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
} from "./incidents.enums";
import {
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

@Injectable()
export class IncidentsService {
	constructor(
		private readonly incidents: IncidentsRepository,
		private readonly mediaStorage: IncidentMediaStorage,
		private readonly events: EventsGateway
	) {}

	/**
	 * Records a Porter incident idempotently. A repeated sync of an id the same Porter
	 * already stored returns that stored incident unchanged (BR-162, BR-221), even if the
	 * Trip has since completed; a rejected report has no side effect (BR-243).
	 */
	async reportIncident(
		porterId: string,
		tripId: string,
		dto: ReportIncidentDto
	): Promise<ReportIncidentResponseDto> {
		const trip = await this.requireTrip(tripId);
		if (!(await this.incidents.isPorterAssigned(tripId, porterId))) {
			throw new ForbiddenException("Only a Porter assigned to this Trip can report incidents");
		}

		const existing = await this.incidents.findById(dto.id);
		if (existing) {
			return this.duplicateOutcome(existing, porterId, tripId);
		}

		const now = Date.now();
		const occurredAt = Date.parse(dto.occurredAt);
		this.assertNotInFuture(occurredAt, now, "occurredAt");
		if (dto.location) {
			this.assertNotInFuture(Date.parse(dto.location.capturedAt), now, "location.capturedAt");
		}
		this.assertAcceptedByTrip(trip, occurredAt, now);

		const newIncident = toNewIncident(dto, tripId, porterId, occurredAt);
		const inserted = await this.incidents.insertIfAbsent(newIncident);
		const stored = await this.incidents.findById(dto.id);
		if (!stored) {
			throw new NotFoundException("Incident not found");
		}
		if (!inserted) {
			// A concurrent sync of the same id won the insert.
			return this.duplicateOutcome(stored, porterId, tripId);
		}

		this.events.emitTripIncidentReported({
			incidentId: stored.id,
			tripId,
			hostId: trip.hostId,
			reporterId: porterId,
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
		porterId: string,
		tripId: string,
		incidentId: string,
		file: IncidentMediaUpload | undefined
	): Promise<IncidentResponseDto> {
		const incident = await this.incidents.findById(incidentId);
		if (!incident || incident.tripId !== tripId) {
			throw new NotFoundException("Incident not found");
		}
		if (incident.reporterId !== porterId) {
			throw new ForbiddenException("Only the reporting Porter can attach media to this incident");
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
		await this.incidents.attachMediaIfAbsent(incidentId, porterId, media);
		const updated = await this.incidents.findById(incidentId);
		return toIncidentResponse(updated ?? incident);
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
		porterId: string,
		tripId: string
	): ReportIncidentResponseDto {
		const isOwnRetry = existing.reporterId === porterId && existing.tripId === tripId;
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
