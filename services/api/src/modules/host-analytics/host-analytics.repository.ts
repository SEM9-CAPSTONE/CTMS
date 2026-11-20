import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime metadata
import { DataSource } from "typeorm";
import type { UpcomingTripSummaryDto } from "./dto/host-analytics-response.dto";
import {
	type ActiveRouteWithAreaRow,
	type BookingRow,
	type CompletedTripRow,
	UPCOMING_TRIPS_LIMIT,
} from "./host-analytics.policy";

export interface SeasonalityTripRow {
	startsAt: Date;
	capacityMax: number | null;
	seatsTaken: number;
	guests: number;
}

export interface HostTripFingerprintRow {
	tripIds: string[];
	maxUpdatedAt: string | null;
	bookingCountsByStatus: Record<string, number>;
}

@Injectable()
export class HostAnalyticsRepository {
	constructor(private readonly dataSource: DataSource) {}

	async areaExists(areaCode: string): Promise<boolean> {
		const rows = await this.dataSource.query<Array<{ exists: boolean }>>(
			"SELECT EXISTS(SELECT 1 FROM geo_areas WHERE code = $1) AS exists",
			[areaCode]
		);
		return Boolean(rows[0]?.exists);
	}

	async isAreaActive(areaCode: string): Promise<boolean> {
		const rows = await this.dataSource.query<Array<{ active: boolean }>>(
			"SELECT active FROM geo_areas WHERE code = $1",
			[areaCode]
		);
		return rows[0]?.active === true;
	}

	async getCompletedTripsInWindow(
		hostId: string,
		from: Date,
		to: Date,
		areaCode?: string
	): Promise<CompletedTripRow[]> {
		const params: unknown[] = [hostId, from.toISOString(), to.toISOString()];
		let areaClause = "";
		if (areaCode) {
			params.push(areaCode);
			areaClause = `AND t.area_code = $${params.length}`;
		}

		const rows = await this.dataSource.query<
			Array<{
				id: string;
				title: string;
				route_id: string;
				route_name: string | null;
				trip_type: "day_trip" | "overnight";
				area_code: string | null;
				area_name: string | null;
				starts_at: string | Date;
				capacity_min: number | string;
				capacity_max: number | string | null;
				seats_taken: number | string;
				price_per_person: number | string;
			}>
		>(
			`SELECT
				t.id,
				t.title,
				t.route_id,
				COALESCE(r.name, '') AS route_name,
				t.trip_type,
				t.area_code,
				t.area_name,
				t.starts_at,
				t.capacity_min,
				t.capacity_max,
				t.seats_taken,
				t.price_per_person
			 FROM trips t
			 LEFT JOIN trekking_routes r ON r.id = t.route_id
			 WHERE t.host_id = $1
			   AND t.status = 'completed'
			   AND t.starts_at >= $2
			   AND t.starts_at <= $3
			   ${areaClause}
			 ORDER BY t.starts_at DESC`,
			params
		);

		return rows.map((row) => ({
			id: row.id,
			title: row.title,
			routeId: row.route_id,
			routeName: row.route_name ?? "",
			tripType: row.trip_type,
			areaCode: row.area_code,
			areaName: row.area_name,
			startsAt: new Date(row.starts_at),
			capacityMin: Number(row.capacity_min),
			capacityMax: row.capacity_max !== null ? Number(row.capacity_max) : null,
			seatsTaken: Number(row.seats_taken ?? 0),
			pricePerPerson: Number(row.price_per_person ?? 0),
		}));
	}

	async getBookingsForTrips(tripIds: string[]): Promise<BookingRow[]> {
		if (tripIds.length === 0) return [];

		const rows = await this.dataSource.query<
			Array<{
				id: string;
				trip_id: string;
				status: string;
				num_people: number | string | null;
				created_at: string | Date;
				trip_starts_at_snapshot: string | Date | null;
			}>
		>(
			`SELECT
				b.id,
				b.trip_id,
				b.status,
				b.num_people,
				b.created_at,
				b.trip_starts_at_snapshot
			 FROM bookings b
			 WHERE b.trip_id = ANY($1::uuid[])`,
			[tripIds]
		);

		return rows.map((row) => ({
			id: row.id,
			tripId: row.trip_id,
			status: row.status,
			numPeople: row.num_people !== null ? Number(row.num_people) : null,
			createdAt: new Date(row.created_at),
			tripStartsAtSnapshot: row.trip_starts_at_snapshot
				? new Date(row.trip_starts_at_snapshot)
				: null,
		}));
	}

	async getCancelledTripsSummary(
		hostId: string,
		from: Date,
		to: Date,
		areaCode?: string
	): Promise<{ count: number; bookingsOnCancelledTrips: number }> {
		const params: unknown[] = [hostId, from.toISOString(), to.toISOString()];
		let areaClause = "";
		if (areaCode) {
			params.push(areaCode);
			areaClause = `AND t.area_code = $${params.length}`;
		}

		const rows = await this.dataSource.query<
			Array<{ trip_count: string; cancelled_bookings: string }>
		>(
			`SELECT
				COUNT(DISTINCT t.id)::text AS trip_count,
				COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'cancelled')::text AS cancelled_bookings
			 FROM trips t
			 LEFT JOIN bookings b ON b.trip_id = t.id
			 WHERE t.host_id = $1
			   AND t.status = 'cancelled'
			   AND t.starts_at >= $2
			   AND t.starts_at <= $3
			   ${areaClause}`,
			params
		);

		return {
			count: Number(rows[0]?.trip_count ?? 0),
			bookingsOnCancelledTrips: Number(rows[0]?.cancelled_bookings ?? 0),
		};
	}

	async getUpcomingTrips(
		hostId: string,
		areaCode?: string,
		now: Date = new Date()
	): Promise<UpcomingTripSummaryDto[]> {
		const params: unknown[] = [hostId, now.toISOString(), UPCOMING_TRIPS_LIMIT];
		let areaClause = "";
		if (areaCode) {
			params.push(areaCode);
			areaClause = `AND t.area_code = $${params.length}`;
		}

		const rows = await this.dataSource.query<
			Array<{
				id: string;
				title: string;
				route_id: string;
				route_name: string | null;
				area_code: string | null;
				area_name: string | null;
				status: "published" | "ongoing";
				starts_at: string | Date;
				capacity_min: number | string;
				capacity_max: number | string | null;
				seats_taken: number | string;
			}>
		>(
			`SELECT
				t.id,
				t.title,
				t.route_id,
				COALESCE(r.name, '') AS route_name,
				t.area_code,
				t.area_name,
				t.status,
				t.starts_at,
				t.capacity_min,
				t.capacity_max,
				t.seats_taken
			 FROM trips t
			 LEFT JOIN trekking_routes r ON r.id = t.route_id
			 WHERE t.host_id = $1
			   AND ((t.status = 'published' AND t.starts_at >= $2) OR t.status = 'ongoing')
			   ${areaClause}
			 ORDER BY t.starts_at ASC
			 LIMIT $3`,
			params
		);

		return rows.map((row) => ({
			tripId: row.id,
			title: row.title,
			routeId: row.route_id,
			routeName: row.route_name ?? "",
			areaCode: row.area_code,
			areaName: row.area_name,
			status: row.status,
			startsAt: new Date(row.starts_at).toISOString(),
			capacityMin: Number(row.capacity_min),
			capacityMax: row.capacity_max !== null ? Number(row.capacity_max) : null,
			seatsTaken: Number(row.seats_taken ?? 0),
		}));
	}

	async getAllCompletedTripsForSeasonality(
		hostId: string,
		areaCode?: string
	): Promise<SeasonalityTripRow[]> {
		const params: unknown[] = [hostId];
		let areaClause = "";
		if (areaCode) {
			params.push(areaCode);
			areaClause = `AND t.area_code = $${params.length}`;
		}

		const rows = await this.dataSource.query<
			Array<{
				starts_at: string | Date;
				capacity_max: number | string | null;
				seats_taken: number | string;
				guests: string;
			}>
		>(
			`SELECT
				t.starts_at,
				t.capacity_max,
				t.seats_taken,
				COALESCE(
					SUM(b.num_people) FILTER (WHERE b.status IN ('confirmed', 'completed')),
					0
				)::text AS guests
			 FROM trips t
			 LEFT JOIN bookings b ON b.trip_id = t.id
			 WHERE t.host_id = $1
			   AND t.status = 'completed'
			   ${areaClause}
			 GROUP BY t.id
			 ORDER BY t.starts_at ASC`,
			params
		);

		return rows.map((row) => ({
			startsAt: new Date(row.starts_at),
			capacityMax: row.capacity_max !== null ? Number(row.capacity_max) : null,
			seatsTaken: Number(row.seats_taken ?? 0),
			guests: Number(row.guests ?? 0),
		}));
	}

	async getActiveRoutesWithLatestArea(hostId: string): Promise<ActiveRouteWithAreaRow[]> {
		const rows = await this.dataSource.query<
			Array<{
				route_id: string;
				route_name: string;
				area_code: string | null;
				area_name: string | null;
				area_active: boolean | null;
			}>
		>(
			`SELECT
				r.id AS route_id,
				r.name AS route_name,
				latest.area_code,
				COALESCE(g.name, latest.area_name) AS area_name,
				COALESCE(g.active, false) AS area_active
			 FROM trekking_routes r
			 LEFT JOIN LATERAL (
				SELECT t.area_code, t.area_name
				FROM trips t
				WHERE t.route_id = r.id
				  AND t.host_id = $1
				  AND t.area_code IS NOT NULL
				ORDER BY t.starts_at DESC, t.created_at DESC
				LIMIT 1
			 ) latest ON true
			 LEFT JOIN geo_areas g ON g.code = latest.area_code
			 WHERE r.host_id = $1
			   AND r.status = 'active'
			 ORDER BY r.name ASC`,
			[hostId]
		);

		return rows.map((row) => ({
			routeId: row.route_id,
			routeName: row.route_name,
			areaCode: row.area_code,
			areaName: row.area_name,
			areaActive: Boolean(row.area_active),
		}));
	}

	async getHostTripFingerprintData(
		hostId: string,
		from: Date,
		to: Date,
		areaCode?: string
	): Promise<HostTripFingerprintRow> {
		const params: unknown[] = [hostId, from.toISOString(), to.toISOString()];
		let areaClause = "";
		if (areaCode) {
			params.push(areaCode);
			areaClause = `AND t.area_code = $${params.length}`;
		}

		const tripRows = await this.dataSource.query<Array<{ id: string; updated_at: string | Date }>>(
			`SELECT t.id, t.updated_at
			 FROM trips t
			 WHERE t.host_id = $1
			   AND t.starts_at >= $2
			   AND t.starts_at <= $3
			   ${areaClause}
			 ORDER BY t.id ASC`,
			params
		);

		const tripIds = tripRows.map((r) => r.id);
		let maxUpdatedAt: string | null = null;
		for (const r of tripRows) {
			const iso = new Date(r.updated_at).toISOString();
			if (maxUpdatedAt === null || iso > maxUpdatedAt) {
				maxUpdatedAt = iso;
			}
		}

		const bookingCountsByStatus: Record<string, number> = {};
		if (tripIds.length > 0) {
			const countRows = await this.dataSource.query<Array<{ status: string; cnt: string }>>(
				`SELECT b.status, COUNT(*)::text AS cnt
				 FROM bookings b
				 WHERE b.trip_id = ANY($1::uuid[])
				 GROUP BY b.status`,
				[tripIds]
			);
			for (const row of countRows) {
				bookingCountsByStatus[row.status] = Number(row.cnt);
			}
		}

		return { tripIds, maxUpdatedAt, bookingCountsByStatus };
	}

	async getRouteStatusForHost(routeId: string): Promise<{ hostId: string; status: string } | null> {
		const rows = await this.dataSource.query<Array<{ host_id: string; status: string }>>(
			"SELECT host_id, status FROM trekking_routes WHERE id = $1",
			[routeId]
		);
		if (!rows[0]) return null;
		return { hostId: rows[0].host_id, status: rows[0].status };
	}
}
