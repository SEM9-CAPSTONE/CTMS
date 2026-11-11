import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { CheckpointType } from "../../trekking-routes/entities/checkpoint.entity";
import type {
	CheckpointProgressItemDto,
	LastVisitedCheckpointDto,
	MemberCheckpointVisitDto,
	TripOperationalProgressResponseDto,
} from "../dto/trip-operational-progress-response.dto";
import type { CheckpointVisit } from "../entities/checkpoint-visit.entity";
import type { GeoPoint, TripStatus } from "../entities/trip.entity";

export interface UpsertCheckpointVisitItem {
	tripId: string;
	checkpointId: string;
	memberId: string;
	confirmedById: string;
	arrivedAt: Date;
	location: GeoPoint | null;
	capturedOffline: boolean;
	syncId: string | null;
}

export interface TripContextRow {
	id: string;
	status: TripStatus;
	routeId: string;
	title: string;
}

export interface JoinedMemberRow {
	id: string;
	userId: string | null;
	fullName: string | null;
}

interface RouteCheckpointRow {
	id: string;
	name: string;
	type: CheckpointType;
	routePosition: number;
	radiusMeters: number;
}

interface RecordedVisitRow {
	checkpointId: string;
	memberId: string;
	userId: string | null;
	displayName: string | null;
	arrivedAt: Date;
	confirmedById: string;
	capturedOffline: boolean;
}

@Injectable()
export class CheckpointVisitsRepository extends Repository<CheckpointVisit> {
	async isPorterAssignedToTrip(porterId: string, tripId: string): Promise<boolean> {
		const rows = (await this.query(
			`SELECT 1 FROM "trip_porters"
			 WHERE "trip_id" = $1 AND "porter_id" = $2 AND "status" = 'assigned'
			 LIMIT 1`,
			[tripId, porterId]
		)) as Array<{ value: number }>;
		return rows.length > 0;
	}

	async findTripContext(tripId: string): Promise<TripContextRow | null> {
		const rows = (await this.query(
			`SELECT "id", "status", "route_id" AS "routeId", "title"
			 FROM "trips"
			 WHERE "id" = $1
			 LIMIT 1`,
			[tripId]
		)) as TripContextRow[];
		return rows[0] ?? null;
	}

	async isCheckpointOnRoute(checkpointId: string, routeId: string): Promise<boolean> {
		const rows = (await this.query(
			`SELECT 1 FROM "checkpoints"
			 WHERE "id" = $1 AND "route_id" = $2
			 LIMIT 1`,
			[checkpointId, routeId]
		)) as Array<{ value: number }>;
		return rows.length > 0;
	}

	async findJoinedMembersForTrip(tripId: string): Promise<JoinedMemberRow[]> {
		return (await this.query(
			`SELECT member."id", member."user_id" AS "userId", camper."full_name" AS "fullName"
			 FROM "booking_members" member
			 JOIN "bookings" booking ON booking."id" = member."booking_id"
			 LEFT JOIN "users" camper ON camper."id" = member."user_id"
			 WHERE booking."trip_id" = $1
			   AND booking."status" IN ('confirmed', 'pending_reconfirmation', 'completed')
			   AND member."member_status" = 'joined'
			 ORDER BY member."created_at" ASC, member."id" ASC`,
			[tripId]
		)) as JoinedMemberRow[];
	}

	async upsertVisits(items: UpsertCheckpointVisitItem[]): Promise<void> {
		if (items.length === 0) return;

		for (const item of items) {
			const locationSql = item.location
				? "ST_SetSRID(ST_GeomFromGeoJSON($6), 4326)::geography"
				: "NULL";
			const params = [
				item.tripId,
				item.checkpointId,
				item.memberId,
				item.confirmedById,
				item.arrivedAt,
				...(item.location ? [JSON.stringify(item.location)] : []),
				item.capturedOffline,
				item.syncId,
			];
			const offlineParamIndex = item.location ? "$7" : "$6";
			const syncIdParamIndex = item.location ? "$8" : "$7";

			await this.query(
				`INSERT INTO "checkpoint_visits" (
					"trip_id", "checkpoint_id", "member_id", "confirmed_by_id",
					"arrived_at", "location", "captured_offline", "sync_id",
					"created_at", "updated_at"
				) VALUES (
					$1, $2, $3, $4, $5, ${locationSql}, ${offlineParamIndex}, ${syncIdParamIndex},
					CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
				)
				ON CONFLICT ("trip_id", "checkpoint_id", "member_id")
				DO UPDATE SET
					"arrived_at" = EXCLUDED."arrived_at",
					"location" = COALESCE(EXCLUDED."location", "checkpoint_visits"."location"),
					"confirmed_by_id" = EXCLUDED."confirmed_by_id",
					"captured_offline" = EXCLUDED."captured_offline",
					"sync_id" = COALESCE(EXCLUDED."sync_id", "checkpoint_visits"."sync_id"),
					"updated_at" = CURRENT_TIMESTAMP`,
				params
			);
		}
	}

	async getOperationalProgress(tripId: string): Promise<TripOperationalProgressResponseDto | null> {
		const trip = await this.findTripContext(tripId);
		if (!trip) return null;

		const checkpoints = (await this.query(
			`SELECT cp."id", cp."name", cp."type", cp."route_position" AS "routePosition", cp."radius_m" AS "radiusMeters"
			 FROM "checkpoints" cp
			 WHERE cp."route_id" = $1
			 ORDER BY cp."route_position" ASC, cp."created_at" ASC, cp."id" ASC`,
			[trip.routeId]
		)) as RouteCheckpointRow[];

		const joinedMembers = await this.findJoinedMembersForTrip(tripId);
		const totalJoinedCount = joinedMembers.length;

		const visits = (await this.query(
			`SELECT v."checkpoint_id" AS "checkpointId", v."member_id" AS "memberId",
			        v."arrived_at" AS "arrivedAt", v."confirmed_by_id" AS "confirmedById",
			        v."captured_offline" AS "capturedOffline",
			        m."user_id" AS "userId", camper."full_name" AS "displayName"
			 FROM "checkpoint_visits" v
			 JOIN "booking_members" m ON m."id" = v."member_id"
			 LEFT JOIN "users" camper ON camper."id" = m."user_id"
			 WHERE v."trip_id" = $1
			 ORDER BY v."arrived_at" ASC`,
			[tripId]
		)) as RecordedVisitRow[];

		const visitsByCheckpoint = new Map<string, RecordedVisitRow[]>();
		for (const v of visits) {
			const list = visitsByCheckpoint.get(v.checkpointId) ?? [];
			list.push(v);
			visitsByCheckpoint.set(v.checkpointId, list);
		}

		let lastVisited: LastVisitedCheckpointDto | null = null;
		let visitedCount = 0;

		const checkpointDtos: CheckpointProgressItemDto[] = checkpoints.map((cp) => {
			const cpVisits = visitsByCheckpoint.get(cp.id) ?? [];
			const isVisited = cpVisits.length > 0;
			if (isVisited) visitedCount++;

			const memberVisits: MemberCheckpointVisitDto[] = cpVisits.map((v) => ({
				memberId: v.memberId,
				userId: v.userId,
				displayName: v.displayName,
				arrivedAt: new Date(v.arrivedAt).toISOString(),
				capturedOffline: v.capturedOffline,
			}));

			const latestVisit = cpVisits[cpVisits.length - 1];
			const arrivedAtIso = latestVisit ? new Date(latestVisit.arrivedAt).toISOString() : null;

			if (latestVisit) {
				const visitDate = new Date(latestVisit.arrivedAt);
				if (!lastVisited || visitDate > new Date(lastVisited.arrivedAt)) {
					lastVisited = {
						checkpointId: cp.id,
						name: cp.name,
						arrivedAt: visitDate.toISOString(),
						confirmedById: latestVisit.confirmedById,
					};
				}
			}

			return {
				checkpointId: cp.id,
				name: cp.name,
				type: cp.type,
				routePosition: Number(cp.routePosition),
				radiusMeters: Number(cp.radiusMeters),
				status: isVisited ? "arrival_confirmed" : "not_visited",
				arrivedAt: arrivedAtIso,
				confirmedById: latestVisit?.confirmedById ?? null,
				visitedMembersCount: cpVisits.length,
				totalJoinedMembersCount: totalJoinedCount,
				visits: memberVisits,
			};
		});

		const totalCheckpoints = checkpoints.length;
		const progressPercentage =
			totalCheckpoints > 0 ? Math.round((visitedCount / totalCheckpoints) * 100) : 0;

		return {
			tripId: trip.id,
			status: trip.status,
			totalCheckpoints,
			visitedCheckpoints: visitedCount,
			progressPercentage,
			lastVisitedCheckpoint: lastVisited,
			checkpoints: checkpointDtos,
		};
	}
}
