import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import { TripPorterStatus } from "../../profiles/entities/trip-porter.entity";
import type { IntendedPorterRole } from "../dto/available-porters-query.dto";
import { type PorterRequest, PorterRequestStatus } from "../entities/porter-request.entity";
import type { TripStatus } from "../entities/trip.entity";

export interface CreatePendingPorterRequestInput {
	tripId: string;
	porterId: string;
	requestedBy: string;
	requestedRole: IntendedPorterRole;
	note: string | null;
	expiresAt: Date;
}

export interface PorterRequestTripSummary {
	id: string;
	title: string;
	status: TripStatus;
	startsAt: Date;
	endsAt: Date;
	meetingAt: Date | null;
}

export interface PorterRequestAssignmentSummary {
	tripId: string;
	porterId: string;
	status: TripPorterStatus;
}

export interface PorterRequestWithContext extends Omit<PorterRequest, "trip"> {
	trip?: PorterRequestTripSummary | null;
	assignment?: PorterRequestAssignmentSummary | null;
}

@Injectable()
export class PorterRequestsRepository extends Repository<PorterRequest> {
	async hasActiveAssignmentForTrip(tripId: string): Promise<boolean> {
		const rows = (await this.query(
			`SELECT 1 FROM "trip_porters" WHERE "trip_id" = $1
			 AND "status" IN ('assigned', 'pending_reconfirmation') LIMIT 1`,
			[tripId]
		)) as Array<{ value: number }>;
		return rows.length > 0;
	}

	async createPendingIdempotent(input: CreatePendingPorterRequestInput): Promise<{
		request: PorterRequest;
		created: boolean;
	}> {
		await this.expirePendingByTripAndPorter(input.tripId, input.porterId);

		const rows = (await this.query(
			`
			INSERT INTO "porter_requests" (
				"trip_id",
				"porter_id",
				"requested_by",
				"requested_role",
				"note",
				"status",
				"expires_at"
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT ("trip_id", "porter_id")
				WHERE "status" = 'pending'
			DO NOTHING
			RETURNING
				"id",
				"trip_id" AS "tripId",
				"porter_id" AS "porterId",
				"requested_by" AS "requestedBy",
				"requested_role" AS "requestedRole",
				"note",
				"status",
				"expires_at" AS "expiresAt",
				"responded_at" AS "respondedAt",
				"created_at" AS "createdAt",
				"updated_at" AS "updatedAt"
			`,
			[
				input.tripId,
				input.porterId,
				input.requestedBy,
				input.requestedRole,
				input.note,
				PorterRequestStatus.PENDING,
				input.expiresAt,
			]
		)) as PorterRequest[];

		if (rows[0]) {
			return { request: rows[0], created: true };
		}

		const existing = await this.findPendingByTripAndPorter(input.tripId, input.porterId);
		if (!existing) {
			throw new Error("Pending Porter Request could not be loaded after duplicate guard");
		}
		return { request: existing, created: false };
	}

	async findPendingByTripAndPorter(
		tripId: string,
		porterId: string
	): Promise<PorterRequest | null> {
		const rows = (await this.query(
			`
			SELECT
				"id",
				"trip_id" AS "tripId",
				"porter_id" AS "porterId",
				"requested_by" AS "requestedBy",
				"requested_role" AS "requestedRole",
				"note",
				"status",
				"expires_at" AS "expiresAt",
				"responded_at" AS "respondedAt",
				"created_at" AS "createdAt",
				"updated_at" AS "updatedAt"
			FROM "porter_requests"
			WHERE "trip_id" = $1
				AND "porter_id" = $2
				AND "status" = $3
				AND "expires_at" > clock_timestamp()
			ORDER BY "created_at" DESC
			LIMIT 1
			`,
			[tripId, porterId, PorterRequestStatus.PENDING]
		)) as PorterRequest[];

		return rows[0] ?? null;
	}

	async findByIdForUpdate(requestId: string): Promise<PorterRequest | null> {
		const rows = (await this.query(
			`
			SELECT
				"id",
				"trip_id" AS "tripId",
				"porter_id" AS "porterId",
				"requested_by" AS "requestedBy",
				"requested_role" AS "requestedRole",
				"note",
				"status",
				"expires_at" AS "expiresAt",
				"responded_at" AS "respondedAt",
				"created_at" AS "createdAt",
				"updated_at" AS "updatedAt"
			FROM "porter_requests"
			WHERE "id" = $1
			FOR UPDATE
			`,
			[requestId]
		)) as PorterRequest[];

		return rows[0] ?? null;
	}

	async findByIdWithContext(requestId: string): Promise<PorterRequestWithContext | null> {
		const rows = (await this.query(
			`
			SELECT
				request."id",
				request."trip_id" AS "tripId",
				request."porter_id" AS "porterId",
				request."requested_by" AS "requestedBy",
				request."requested_role" AS "requestedRole",
				request."note",
				request."status",
				request."expires_at" AS "expiresAt",
				request."responded_at" AS "respondedAt",
				request."created_at" AS "createdAt",
				request."updated_at" AS "updatedAt",
				CASE WHEN trip."id" IS NULL THEN NULL ELSE jsonb_build_object(
					'id', trip."id",
					'title', trip."title",
					'status', trip."status",
					'startsAt', trip."starts_at",
					'endsAt', trip."ends_at",
					'meetingAt', trip."meeting_at"
				) END AS "trip",
				CASE WHEN assignment."trip_id" IS NULL THEN NULL ELSE jsonb_build_object(
					'tripId', assignment."trip_id",
					'porterId', assignment."porter_id",
					'status', assignment."status"
				) END AS "assignment"
			FROM "porter_requests" request
			LEFT JOIN "trips" trip ON trip."id" = request."trip_id"
			LEFT JOIN "trip_porters" assignment
				ON assignment."trip_id" = request."trip_id"
				AND assignment."porter_id" = request."porter_id"
			WHERE request."id" = $1
			`,
			[requestId]
		)) as PorterRequestWithContext[];

		return rows[0] ?? null;
	}

	async listForPorter(porterId: string): Promise<PorterRequestWithContext[]> {
		return this.query(
			`
			SELECT
				request."id",
				request."trip_id" AS "tripId",
				request."porter_id" AS "porterId",
				request."requested_by" AS "requestedBy",
				request."requested_role" AS "requestedRole",
				request."note",
				request."status",
				request."expires_at" AS "expiresAt",
				request."responded_at" AS "respondedAt",
				request."created_at" AS "createdAt",
				request."updated_at" AS "updatedAt",
				jsonb_build_object(
					'id', trip."id",
					'title', trip."title",
					'status', trip."status",
					'startsAt', trip."starts_at",
					'endsAt', trip."ends_at",
					'meetingAt', trip."meeting_at"
				) AS "trip",
				CASE WHEN assignment."trip_id" IS NULL THEN NULL ELSE jsonb_build_object(
					'tripId', assignment."trip_id",
					'porterId', assignment."porter_id",
					'status', assignment."status"
				) END AS "assignment"
			FROM "porter_requests" request
			INNER JOIN "trips" trip ON trip."id" = request."trip_id"
			LEFT JOIN "trip_porters" assignment
				ON assignment."trip_id" = request."trip_id"
				AND assignment."porter_id" = request."porter_id"
				AND assignment."status" IN ('assigned', 'pending_reconfirmation')
			WHERE request."porter_id" = $1
			ORDER BY
				CASE request."status" WHEN 'pending' THEN 0 ELSE 1 END,
				request."created_at" DESC
			`,
			[porterId]
		);
	}

	async listByTripForHost(tripId: string): Promise<PorterRequestWithContext[]> {
		return this.query(
			`
			SELECT
				request."id",
				request."trip_id" AS "tripId",
				request."porter_id" AS "porterId",
				request."requested_by" AS "requestedBy",
				request."requested_role" AS "requestedRole",
				request."note",
				request."status",
				request."expires_at" AS "expiresAt",
				request."responded_at" AS "respondedAt",
				request."created_at" AS "createdAt",
				request."updated_at" AS "updatedAt",
				jsonb_build_object(
					'id', trip."id",
					'title', trip."title",
					'status', trip."status",
					'startsAt', trip."starts_at",
					'endsAt', trip."ends_at",
					'meetingAt', trip."meeting_at"
				) AS "trip",
				CASE WHEN assignment."trip_id" IS NULL THEN NULL ELSE jsonb_build_object(
					'tripId', assignment."trip_id",
					'porterId', assignment."porter_id",
					'status', assignment."status"
				) END AS "assignment"
			FROM "porter_requests" request
			INNER JOIN "trips" trip ON trip."id" = request."trip_id"
			LEFT JOIN "trip_porters" assignment
				ON assignment."trip_id" = request."trip_id"
				AND assignment."porter_id" = request."porter_id"
				AND assignment."status" IN ('assigned', 'pending_reconfirmation')
			WHERE request."trip_id" = $1
			ORDER BY request."created_at" DESC
			`,
			[tripId]
		);
	}

	async expirePendingByHost(hostId: string): Promise<PorterRequest[]> {
		const result = await this.query(
			`UPDATE "porter_requests"
			 SET "status" = $1,
				 "responded_at" = clock_timestamp(),
				 "updated_at" = clock_timestamp()
			 WHERE "requested_by" = $2
				 AND "status" = $3
				 AND "expires_at" <= clock_timestamp()
			 RETURNING
				 "id",
				 "trip_id" AS "tripId",
				 "porter_id" AS "porterId",
				 "requested_by" AS "requestedBy",
				 "requested_role" AS "requestedRole",
				 "note",
				 "status",
				 "expires_at" AS "expiresAt",
				 "responded_at" AS "respondedAt",
				 "created_at" AS "createdAt",
				 "updated_at" AS "updatedAt"`,
			[PorterRequestStatus.EXPIRED, hostId, PorterRequestStatus.PENDING]
		);
		return normalizeRows<PorterRequest>(result);
	}

	async expirePendingByPorter(porterId: string): Promise<PorterRequest[]> {
		return this.expirePendingBatch(null, porterId);
	}

	async expirePendingBatch(limit: number | null, porterId?: string): Promise<PorterRequest[]> {
		const result = await this.query(
			`UPDATE "porter_requests"
			 SET "status" = $1, "responded_at" = clock_timestamp(), "updated_at" = clock_timestamp()
			 WHERE "id" IN (
				SELECT "id" FROM "porter_requests"
				WHERE "status" = $2 AND "expires_at" <= clock_timestamp()
				  AND ($4::uuid IS NULL OR "porter_id" = $4)
				ORDER BY "expires_at", "id"
				LIMIT $3 FOR UPDATE SKIP LOCKED
			 ) AND "status" = $2 AND "expires_at" <= clock_timestamp()
			 RETURNING "id", "trip_id" AS "tripId", "porter_id" AS "porterId",
			 "requested_by" AS "requestedBy", "requested_role" AS "requestedRole", "note", "status",
			 "expires_at" AS "expiresAt", "responded_at" AS "respondedAt",
			 "created_at" AS "createdAt", "updated_at" AS "updatedAt"`,
			[PorterRequestStatus.EXPIRED, PorterRequestStatus.PENDING, limit, porterId ?? null]
		);
		return normalizeRows<PorterRequest>(result);
	}

	async listRespondedForHost(hostId: string): Promise<PorterRequestWithContext[]> {
		return this.query(
			`SELECT
				request."id",
				request."trip_id" AS "tripId",
				request."porter_id" AS "porterId",
				request."requested_by" AS "requestedBy",
				request."requested_role" AS "requestedRole",
				request."note",
				request."status",
				request."expires_at" AS "expiresAt",
				request."responded_at" AS "respondedAt",
				request."created_at" AS "createdAt",
				request."updated_at" AS "updatedAt",
				jsonb_build_object(
					'id', trip."id",
					'title', trip."title",
					'status', trip."status",
					'startsAt', trip."starts_at",
					'endsAt', trip."ends_at",
					'meetingAt', trip."meeting_at"
				) AS "trip",
				CASE WHEN assignment."trip_id" IS NULL THEN NULL ELSE jsonb_build_object(
					'tripId', assignment."trip_id",
					'porterId', assignment."porter_id",
					'status', assignment."status"
				) END AS "assignment"
			 FROM "porter_requests" request
			 INNER JOIN "trips" trip ON trip."id" = request."trip_id"
			 LEFT JOIN "trip_porters" assignment
				 ON assignment."trip_id" = request."trip_id"
				 AND assignment."porter_id" = request."porter_id"
			 WHERE request."requested_by" = $1
				 AND request."status" IN ('pending', 'accepted', 'declined')
			 ORDER BY
				 CASE request."status" WHEN 'pending' THEN 0 WHEN 'accepted' THEN 1 ELSE 2 END,
				 request."created_at" DESC`,
			[hostId]
		);
	}

	async markStatus(
		requestId: string,
		status:
			| PorterRequestStatus.ACCEPTED
			| PorterRequestStatus.DECLINED
			| PorterRequestStatus.CANCELLED
			| PorterRequestStatus.EXPIRED,
		respondedAt: Date | null
	): Promise<PorterRequest> {
		const result = await this.query(
			`
			UPDATE "porter_requests"
			SET "status" = $2,
				"responded_at" = COALESCE($3, "responded_at"),
				"updated_at" = clock_timestamp()
			WHERE "id" = $1
			RETURNING
				"id",
				"trip_id" AS "tripId",
				"porter_id" AS "porterId",
				"requested_by" AS "requestedBy",
				"requested_role" AS "requestedRole",
				"note",
				"status",
				"expires_at" AS "expiresAt",
				"responded_at" AS "respondedAt",
				"created_at" AS "createdAt",
				"updated_at" AS "updatedAt"
			`,
			[requestId, status, respondedAt]
		);
		const rows = normalizeRows<PorterRequest>(result);
		if (!rows[0]) {
			throw new Error("Porter Request transition failed to return a row");
		}
		return rows[0];
	}

	async declinePendingForOverlappingTrips(input: {
		porterId: string;
		acceptedTripId: string;
		startsAt: Date;
		endsAt: Date;
		respondedAt: Date;
	}): Promise<PorterRequest[]> {
		const result = await this.query(
			`UPDATE "porter_requests" request
			 SET "status" = $1,
			     "responded_at" = $5,
			     "updated_at" = clock_timestamp()
			 FROM "trips" pending_trip
			 WHERE pending_trip."id" = request."trip_id"
			   AND request."porter_id" = $2
			   AND request."trip_id" <> $3
			   AND request."status" = $4
			   AND request."expires_at" > $5
			   AND pending_trip."starts_at" < $6
			   AND pending_trip."ends_at" > $7
			 RETURNING request."id", request."trip_id" AS "tripId",
			   request."porter_id" AS "porterId", request."requested_by" AS "requestedBy",
			   request."requested_role" AS "requestedRole", request."note", request."status",
			   request."expires_at" AS "expiresAt", request."responded_at" AS "respondedAt",
			   request."created_at" AS "createdAt", request."updated_at" AS "updatedAt"`,
			[
				PorterRequestStatus.DECLINED,
				input.porterId,
				input.acceptedTripId,
				PorterRequestStatus.PENDING,
				input.respondedAt,
				input.endsAt,
				input.startsAt,
			]
		);
		return normalizeRows<PorterRequest>(result);
	}

	async createAssignedTripPorterIdempotent(
		tripId: string,
		porterId: string
	): Promise<PorterRequestAssignmentSummary> {
		const result = await this.query(
			`
			INSERT INTO "trip_porters" ("trip_id", "porter_id", "status")
			VALUES ($1, $2, $3)
			ON CONFLICT ("trip_id", "porter_id")
			DO UPDATE SET
				"status" = CASE
					WHEN "trip_porters"."status" = 'unassigned' THEN EXCLUDED."status"
					ELSE "trip_porters"."status"
				END,
				"declined_at" = CASE
					WHEN "trip_porters"."status" = 'unassigned' THEN NULL
					ELSE "trip_porters"."declined_at"
				END
			RETURNING
				"trip_id" AS "tripId",
				"porter_id" AS "porterId",
				"status"
			`,
			[tripId, porterId, TripPorterStatus.ASSIGNED]
		);
		const rows = normalizeRows<PorterRequestAssignmentSummary>(result);
		const assignment = rows[0];
		if (!assignment || assignment.status !== TripPorterStatus.ASSIGNED) {
			throw new Error("Porter Assignment could not be created as assigned");
		}
		return assignment;
	}

	private async expirePendingByTripAndPorter(tripId: string, porterId: string): Promise<void> {
		await this.query(
			`
			UPDATE "porter_requests"
			SET "status" = $3,
				"updated_at" = clock_timestamp()
			WHERE "trip_id" = $1
				AND "porter_id" = $2
				AND "status" = $4
				AND "expires_at" <= clock_timestamp()
			`,
			[tripId, porterId, PorterRequestStatus.EXPIRED, PorterRequestStatus.PENDING]
		);
	}
}

function normalizeRows<T>(result: unknown): T[] {
	if (Array.isArray(result) && Array.isArray(result[0])) return result[0] as T[];
	return result as T[];
}
