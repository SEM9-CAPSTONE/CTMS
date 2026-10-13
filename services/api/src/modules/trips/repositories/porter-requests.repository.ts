import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { IntendedPorterRole } from "../dto/available-porters-query.dto";
import { type PorterRequest, PorterRequestStatus } from "../entities/porter-request.entity";

export interface CreatePendingPorterRequestInput {
	tripId: string;
	porterId: string;
	requestedBy: string;
	requestedRole: IntendedPorterRole;
	note: string | null;
	expiresAt: Date;
}

@Injectable()
export class PorterRequestsRepository extends Repository<PorterRequest> {
	async createPendingIdempotent(input: CreatePendingPorterRequestInput): Promise<{
		request: PorterRequest;
		created: boolean;
	}> {
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
			ORDER BY "created_at" DESC
			LIMIT 1
			`,
			[tripId, porterId, PorterRequestStatus.PENDING]
		)) as PorterRequest[];

		return rows[0] ?? null;
	}
}
