import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime metadata
import { DataSource } from "typeorm";
import type {
	SuggestionRouteReviewSummaryDto,
	UpcomingTripSummaryDto,
} from "./dto/host-analytics-response.dto";
import {
	type ActiveRouteWithAreaRow,
	type BookingRow,
	type CompletedTripRow,
	type LatestCompletedTripTemplate,
	UPCOMING_TRIPS_LIMIT,
	vietnamDateKey,
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

	async getLatestCompletedTripForRoute(
		hostId: string,
		routeId: string
	): Promise<LatestCompletedTripTemplate | null> {
		const rows = await this.dataSource.query<
			Array<{
				id: string;
				title: string;
				route_id: string;
				trip_type: "day_trip" | "overnight";
				area_code: string | null;
				capacity_min: number | string;
				capacity_max: number | string | null;
				price_per_person: number | string;
				starts_at: string | Date;
				ends_at: string | Date;
				meeting_at: string | Date | null;
				booking_deadline: string | Date;
				meeting_lng: number | string | null;
				meeting_lat: number | string | null;
				route_length_meters: number | string | null;
			}>
		>(
			`SELECT
				t.id,
				t.title,
				t.route_id,
				t.trip_type,
				t.area_code,
				t.capacity_min,
				t.capacity_max,
				t.price_per_person,
				t.starts_at,
				t.ends_at,
				t.meeting_at,
				t.booking_deadline,
				CASE WHEN t.meeting_point IS NOT NULL THEN ST_X(t.meeting_point::geometry) ELSE NULL END AS meeting_lng,
				CASE WHEN t.meeting_point IS NOT NULL THEN ST_Y(t.meeting_point::geometry) ELSE NULL END AS meeting_lat,
				r.length_meters AS route_length_meters
			 FROM trips t
			 LEFT JOIN trekking_routes r ON r.id = t.route_id
			 WHERE t.host_id = $1
			   AND t.route_id = $2
			   AND t.status = 'completed'
			 ORDER BY t.starts_at DESC, t.created_at DESC
			 LIMIT 1`,
			[hostId, routeId]
		);

		const row = rows[0];
		if (!row) return null;
		return {
			id: row.id,
			title: row.title,
			routeId: row.route_id,
			tripType: row.trip_type,
			areaCode: row.area_code,
			capacityMin: Number(row.capacity_min),
			capacityMax: row.capacity_max !== null ? Number(row.capacity_max) : null,
			pricePerPerson: Number(row.price_per_person ?? 0),
			startsAt: new Date(row.starts_at),
			endsAt: new Date(row.ends_at),
			meetingAt: row.meeting_at ? new Date(row.meeting_at) : null,
			bookingDeadline: new Date(row.booking_deadline),
			meetingLongitude: row.meeting_lng !== null ? Number(row.meeting_lng) : null,
			meetingLatitude: row.meeting_lat !== null ? Number(row.meeting_lat) : null,
			routeLengthMeters: row.route_length_meters !== null ? Number(row.route_length_meters) : null,
		};
	}

	async getHostBusyDateKeys(hostId: string, now: Date = new Date()): Promise<Set<string>> {
		const rows = await this.dataSource.query<
			Array<{ starts_at: string | Date; ends_at: string | Date }>
		>(
			`SELECT t.starts_at, t.ends_at
			 FROM trips t
			 WHERE t.host_id = $1
			   AND t.status IN ('published', 'ongoing', 'pending_approval')
			   AND t.ends_at >= $2`,
			[hostId, now.toISOString()]
		);

		const busyDates = new Set<string>();
		for (const row of rows) {
			const startMs = new Date(row.starts_at).getTime();
			const endMs = Math.max(startMs, new Date(row.ends_at).getTime());
			for (let cursor = startMs; cursor <= endMs; cursor += 12 * 3600 * 1000) {
				busyDates.add(vietnamDateKey(new Date(cursor)));
			}
			busyDates.add(vietnamDateKey(new Date(endMs)));
		}
		return busyDates;
	}

	async getRouteReviewSummaries(
		hostId: string,
		routeIds: string[]
	): Promise<Map<string, SuggestionRouteReviewSummaryDto>> {
		const result = new Map<string, SuggestionRouteReviewSummaryDto>();
		if (routeIds.length === 0) return result;

		const rows = await this.dataSource.query<
			Array<{
				route_id: string;
				review_count: string;
				avg_rating: string | null;
				safety_pos: string;
				guide_pos: string;
				slip_mentions: string;
			}>
		>(
			`SELECT
				t.route_id,
				COUNT(DISTINCT r.id)::text AS review_count,
				ROUND(AVG(r.rating)::numeric, 1)::text AS avg_rating,
				COUNT(DISTINCT a_safety.id) FILTER (WHERE a_safety.sentiment = 'positive')::text AS safety_pos,
				COUNT(DISTINCT a_guide.id) FILTER (WHERE a_guide.sentiment = 'positive')::text AS guide_pos,
				COUNT(DISTINCT sig.id) FILTER (WHERE sig.incident_type IN ('fall_slip', 'weather') AND sig.occurred IN ('yes', 'warning'))::text AS slip_mentions
			 FROM trips t
			 JOIN trip_reviews r ON r.trip_id = t.id AND r.moderation_status = 'visible'
			 LEFT JOIN trip_review_aspect_sentiments a_safety
			   ON a_safety.review_id = r.id AND a_safety.source_revision = r.revision AND a_safety.aspect = 'safety'
			 LEFT JOIN trip_review_aspect_sentiments a_guide
			   ON a_guide.review_id = r.id AND a_guide.source_revision = r.revision AND a_guide.aspect = 'guide_support'
			 LEFT JOIN trip_review_incident_signals sig
			   ON sig.review_id = r.id AND sig.source_revision = r.revision
			 WHERE t.host_id = $1
			   AND t.route_id = ANY($2::uuid[])
			 GROUP BY t.route_id`,
			[hostId, routeIds]
		);

		for (const row of rows) {
			const reviewCount = Number(row.review_count ?? 0);
			if (reviewCount <= 0) continue;
			const averageRating = row.avg_rating !== null ? Number(row.avg_rating) : null;
			const safetyPos = Number(row.safety_pos ?? 0);
			const guidePos = Number(row.guide_pos ?? 0);
			const slipMentions = Number(row.slip_mentions ?? 0);
			const ratingPrefix =
				averageRating !== null
					? `${averageRating.toFixed(1)}★ (${reviewCount} đánh giá)`
					: `${reviewCount} đánh giá`;

			let detail = "Tuyến nhận phản hồi tích cực từ khách đã tham gia";
			let hasCaution = slipMentions > 0;
			if (slipMentions > 0) {
				detail = "Lưu ý từ đánh giá cũ: Có khách từng nhắc đường trơn khi mưa";
			} else if (averageRating !== null && averageRating < 3.5) {
				detail = "Cần lưu ý cải thiện chất lượng dịch vụ từ đánh giá cũ";
				hasCaution = true;
			} else if (safetyPos > 0 && guidePos > 0) {
				detail = "Khách khen An toàn & Người dẫn đường cao";
			} else if (guidePos > 0) {
				detail = "Khách đánh giá cao sự hỗ trợ của Người dẫn đường";
			} else if (safetyPos > 0) {
				detail = "Khách đánh giá cao độ an toàn của hành trình";
			}

			result.set(row.route_id, {
				averageRating,
				reviewCount,
				highlightText: `${ratingPrefix} · ${detail}`,
				hasSlipOrWeatherCaution: hasCaution,
			});
		}

		return result;
	}
}
