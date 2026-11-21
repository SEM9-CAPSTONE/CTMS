import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { UPLOAD_PUBLIC_PREFIX, getUploadRoot } from "../../shared/uploads/upload-paths";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { IncidentMediaStorage } from "../incidents/incident-media.storage";
import {
	DANGER_ZONE_PROPOSAL_LIST_LIMIT,
	PORTER_PROPOSAL_RADIUS_METERS,
	PROPOSAL_PHOTO_DIRECTORY,
	PROPOSAL_PHOTO_MAX_BYTES,
	PROPOSAL_PHOTO_MAX_COUNT,
} from "./danger-zone-proposals.constants";
import { DangerZoneProposalStatus } from "./danger-zone-proposals.enums";
// biome-ignore lint/style/useImportType: Nest runtime injection
import { DangerZoneProposalsRepository } from "./danger-zone-proposals.repository";
import type { DangerZoneProposalRow } from "./danger-zone-proposals.repository";
import type { PorterDangerZoneProposalDto } from "./dto/porter-danger-zone-proposal.dto";

export interface ProposalPhotoUpload {
	buffer: Buffer;
	size: number;
}

interface FieldTrip {
	routeId: string;
	status: string;
	startsAt: Date;
	endsAt: Date;
	actualStartedAt: Date | null;
	actualEndedAt: Date | null;
}

export function assertProposalTime(
	trip: FieldTrip,
	dto: PorterDangerZoneProposalDto,
	now = Date.now()
): void {
	const observed = Date.parse(dto.observedAt);
	const captured = Date.parse(dto.location.capturedAt);
	if (
		![observed, captured].every(Number.isFinite) ||
		observed > now + 30_000 ||
		captured > now + 30_000 ||
		Math.abs(observed - captured) > 30_000
	) {
		throw new UnprocessableEntityException({ code: "PROPOSAL_GPS_STALE" });
	}
	const start = (trip.actualStartedAt ?? trip.startsAt).getTime();
	const end =
		trip.status === "ongoing" ? now + 30_000 : (trip.actualEndedAt ?? trip.endsAt).getTime();
	if (!["ongoing", "completed"].includes(trip.status) || observed < start || observed > end) {
		throw new ConflictException({ code: "PROPOSAL_OUTSIDE_TRIP" });
	}
}

@Injectable()
export class PorterDangerZoneProposalsService {
	constructor(private readonly repository: DangerZoneProposalsRepository) {}

	private async assigned(
		manager: EntityManager,
		porterId: string,
		tripId: string
	): Promise<FieldTrip> {
		const rows = await manager.query<FieldTrip[]>(
			`SELECT t."route_id" AS "routeId", t."status", t."starts_at" AS "startsAt", t."ends_at" AS "endsAt",
			t."actual_started_at" AS "actualStartedAt", t."actual_ended_at" AS "actualEndedAt"
			FROM "trips" t JOIN "trip_porters" tp ON tp."trip_id" = t."id"
			WHERE t."id" = $1 AND tp."porter_id" = $2 AND tp."status" = 'assigned' FOR SHARE OF t, tp`,
			[tripId, porterId]
		);
		if (!rows[0]) throw new ForbiddenException({ code: "PROPOSAL_PORTER_NOT_ASSIGNED" });
		return rows[0];
	}

	async list(porterId: string, tripId: string): Promise<DangerZoneProposalRow[]> {
		await this.repository.transaction((manager) => this.assigned(manager, porterId, tripId));
		return this.repository.list({
			tripId,
			proposerId: porterId,
			limit: DANGER_ZONE_PROPOSAL_LIST_LIMIT,
		});
	}

	async create(
		porterId: string,
		tripId: string,
		dto: PorterDangerZoneProposalDto
	): Promise<DangerZoneProposalRow> {
		const payload = JSON.stringify({ tripId, ...dto });
		const id = await this.repository.transaction(async (manager) => {
			const trip = await this.assigned(manager, porterId, tripId);
			await manager.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
				`${porterId}:${dto.clientRequestId}`,
			]);
			const prior = await manager.query<Array<{ id: string; matches: boolean }>>(
				`SELECT "id", "request_payload" = $3::jsonb AS "matches"
				FROM "danger_zone_proposals" WHERE "proposer_id" = $1 AND "client_request_id" = $2 AND "source" = 'PORTER'`,
				[porterId, dto.clientRequestId, payload]
			);
			if (prior[0]) {
				if (!prior[0].matches) throw new ConflictException({ code: "PROPOSAL_REQUEST_CONFLICT" });
				return prior[0].id;
			}
			assertProposalTime(trip, dto);
			const radius = PORTER_PROPOSAL_RADIUS_METERS;
			const inserted = await manager.query<Array<{ id: string }>>(
				`INSERT INTO "danger_zone_proposals"
				("source", "route_id", "trip_id", "proposer_id", "client_request_id", "request_payload", "hazard_type", "geom", "radius_m", "severity", "description", "location_accuracy_meters", "observed_at")
				VALUES ('PORTER', $1, $2, $3, $4, $5::jsonb, $6, ST_SetSRID(ST_MakePoint($7, $8),4326)::geography, $9, $10, $11, $12, $13) RETURNING "id"`,
				[
					trip.routeId,
					tripId,
					porterId,
					dto.clientRequestId,
					payload,
					dto.hazardType,
					dto.location.longitude,
					dto.location.latitude,
					radius,
					dto.severity,
					dto.description,
					dto.location.accuracyMeters,
					dto.observedAt,
				]
			);
			await manager.getRepository(AuditLog).save({
				actorId: porterId,
				action: "danger_zone_proposal.submitted",
				targetType: "danger_zone_proposal",
				targetId: inserted[0].id,
				before: null,
				after: { routeId: trip.routeId, tripId, source: "PORTER", hazardType: dto.hazardType },
				reason: "porter_reported_danger_zone",
			});
			return inserted[0].id;
		});
		const result = await this.repository.findById(id);
		if (!result) throw new ConflictException({ code: "PROPOSAL_NOT_FOUND" });
		return result;
	}

	/**
	 * Adds one field photo to the Porter's own pending report. The content hash makes a retried
	 * upload return the stored photo instead of counting twice toward the limit.
	 */
	async addPhoto(
		porterId: string,
		tripId: string,
		proposalId: string,
		file: ProposalPhotoUpload | undefined
	): Promise<DangerZoneProposalRow> {
		const signature = file ? new IncidentMediaStorage().detectImage(file.buffer) : null;
		if (!file || !signature || file.size > PROPOSAL_PHOTO_MAX_BYTES) {
			throw new UnprocessableEntityException({ code: "PROPOSAL_PHOTO_INVALID" });
		}
		const digest = createHash("sha256").update(file.buffer).digest("hex");
		await this.repository.transaction(async (manager) => {
			await this.assigned(manager, porterId, tripId);
			const [proposal] = await manager.query<Array<{ status: DangerZoneProposalStatus }>>(
				`SELECT "status" FROM "danger_zone_proposals"
				WHERE "id" = $1 AND "trip_id" = $2 AND "proposer_id" = $3 AND "source" = 'PORTER' FOR UPDATE`,
				[proposalId, tripId, porterId]
			);
			if (!proposal) throw new NotFoundException({ code: "PROPOSAL_NOT_FOUND" });
			const photos = await manager.query<Array<{ sha256: string }>>(
				`SELECT "sha256" FROM "danger_zone_proposal_photos" WHERE "proposal_id" = $1`,
				[proposalId]
			);
			if (photos.some((photo) => photo.sha256 === digest)) return;
			if (proposal.status !== DangerZoneProposalStatus.PENDING) {
				throw new ConflictException({ code: "PROPOSAL_ALREADY_DECIDED" });
			}
			if (photos.length >= PROPOSAL_PHOTO_MAX_COUNT) {
				throw new ConflictException({ code: "PROPOSAL_PHOTO_LIMIT" });
			}
			const directory = join(getUploadRoot(), PROPOSAL_PHOTO_DIRECTORY);
			const fileName = `${proposalId}-${digest}.${signature.extension}`;
			await mkdir(directory, { recursive: true });
			await writeFile(join(directory, fileName), file.buffer);
			const url = `${UPLOAD_PUBLIC_PREFIX}${PROPOSAL_PHOTO_DIRECTORY}/${fileName}`;
			await manager.query(
				`INSERT INTO "danger_zone_proposal_photos" ("proposal_id", "url", "content_type", "size_bytes", "sha256")
				VALUES ($1, $2, $3, $4, $5)`,
				[proposalId, url, signature.contentType, file.size, digest]
			);
			await manager.getRepository(AuditLog).save({
				actorId: porterId,
				action: "danger_zone_proposal.photo_added",
				targetType: "danger_zone_proposal",
				targetId: proposalId,
				before: null,
				after: { tripId, contentType: signature.contentType, sizeBytes: file.size },
				reason: "porter_attached_danger_zone_photo",
			});
		});
		const result = await this.repository.findById(proposalId);
		if (!result) throw new NotFoundException({ code: "PROPOSAL_NOT_FOUND" });
		return result;
	}
}
