import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import { IntendedPorterRole } from "../../trips/dto/available-porters-query.dto";
import { PorterRequestStatus } from "../../trips/entities/porter-request.entity";
import { TripStatus } from "../../trips/entities/trip.entity";
import type { PorterProfile } from "../entities/porter-profile.entity";
import { TripPorterStatus } from "../entities/trip-porter.entity";

export interface PorterLedTripHistoryRow {
	tripId: string;
	tripTitle: string;
	routeId: string;
	routeName: string;
	startsAt: Date;
	endsAt: Date;
	role: "lead";
	status: "completed";
}

export interface PorterLedTripHistoryResult {
	items: PorterLedTripHistoryRow[];
	total: number;
}

interface PorterLedTripHistoryQueryRow extends Partial<PorterLedTripHistoryRow> {
	total: string | number;
}

@Injectable()
export class PorterProfilesRepository extends Repository<PorterProfile> {
	findByPorterId(porterId: string): Promise<PorterProfile | null> {
		return this.findOneBy({ porterId });
	}

	findByPorterIdForUpdate(porterId: string): Promise<PorterProfile | null> {
		return this.createQueryBuilder("profile")
			.where("profile.porterId = :porterId", { porterId })
			.setLock("pessimistic_write")
			.getOne();
	}

	async findLedTripHistory(
		porterId: string,
		page: number,
		limit: number
	): Promise<PorterLedTripHistoryResult> {
		const offset = (page - 1) * limit;
		const rows = (await this.query(
			`WITH eligible AS (
				SELECT
					trip."id" AS "tripId",
					trip."title" AS "tripTitle",
					route."id" AS "routeId",
					route."name" AS "routeName",
					trip."starts_at" AS "startsAt",
					trip."ends_at" AS "endsAt",
					$4::text AS "role",
					$5::text AS "status"
				FROM "trip_porters" assignment
				INNER JOIN "trips" trip ON trip."id" = assignment."trip_id"
				INNER JOIN "trekking_routes" route ON route."id" = trip."route_id"
				WHERE assignment."porter_id" = $1
					AND assignment."status"::text = $6
					AND trip."status"::text = $5
					AND EXISTS (
						SELECT 1
						FROM "porter_requests" request
						WHERE request."trip_id" = assignment."trip_id"
							AND request."porter_id" = assignment."porter_id"
							AND request."status"::text = $7
							AND request."requested_role"::text = $4
					)
			), paged AS (
				SELECT *
				FROM eligible
				ORDER BY "endsAt" DESC, "tripId" ASC
				LIMIT $2 OFFSET $3
			)
			SELECT paged.*, counts."total"
			FROM (SELECT COUNT(*) AS "total" FROM eligible) counts
			LEFT JOIN paged ON TRUE
			ORDER BY paged."endsAt" DESC NULLS LAST, paged."tripId" ASC NULLS LAST`,
			[
				porterId,
				limit,
				offset,
				IntendedPorterRole.LEAD,
				TripStatus.COMPLETED,
				TripPorterStatus.ASSIGNED,
				PorterRequestStatus.ACCEPTED,
			]
		)) as PorterLedTripHistoryQueryRow[];

		const total = Number(rows[0]?.total ?? 0);
		const items = rows
			.filter((row): row is PorterLedTripHistoryQueryRow & PorterLedTripHistoryRow =>
				Boolean(row.tripId)
			)
			.map(({ total: _total, ...item }) => item);

		return { items, total };
	}
}
