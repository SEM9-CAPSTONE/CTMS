import { Injectable, Logger } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource } from "typeorm";
import type { GetRouteSafetyOverviewQueryDto } from "./dtos/get-route-safety-overview-query.dto";
import type { GetTripFeedbackOverviewQueryDto } from "./dtos/get-trip-feedback-overview-query.dto";
import type {
	IncidentSignalSummaryDto,
	RouteSafetyItemDto,
	RouteSafetyOverviewResponseDto,
} from "./dtos/route-safety-overview-response.dto";
import type {
	AspectSentimentSummaryDto,
	TripFeedbackItemDto,
	TripFeedbackOverviewResponseDto,
} from "./dtos/trip-feedback-overview-response.dto";
import {
	ALL_ASPECT_TYPES,
	ALL_INCIDENT_TYPES,
	DASHBOARD_SAFETY_MIN_SAMPLE_SIZE,
	DASHBOARD_TRIP_MIN_SAMPLE_SIZE,
} from "./trip-review-analytics.constants";
import type {
	AspectType,
	IncidentOccurred,
	IncidentSeverity,
	IncidentType,
	SentimentType,
} from "./trip-review-moderation.types";

interface TripRow {
	tripId: string;
	tripTitle: string;
}

interface RouteRow {
	routeId: string;
	routeName: string;
}

interface ReviewCountsRow {
	entityId: string;
	eligibleCount: string;
	analyzedCount: string;
	reportedCount: string;
}

interface AspectSentimentRow {
	tripId: string;
	aspect: AspectType;
	sentiment: SentimentType;
	distinctReviews: string;
}

interface IncidentSignalRow {
	routeId: string;
	incidentType: IncidentType;
	occurred: IncidentOccurred;
	severity: IncidentSeverity;
	quote: string;
	reviewId: string;
}

@Injectable()
export class TripReviewAnalyticsHostService {
	private readonly logger = new Logger(TripReviewAnalyticsHostService.name);

	constructor(private readonly dataSource: DataSource) {}

	/**
	 * Aggregates aspect feedback for trips owned by the authenticated host (target = 'trip' only).
	 * Enforces DASHBOARD_TRIP_MIN_SAMPLE_SIZE = 5 threshold before rankings/scores are calculated.
	 */
	async getTripsFeedbackOverview(
		hostId: string,
		query: GetTripFeedbackOverviewQueryDto
	): Promise<TripFeedbackOverviewResponseDto> {
		const page = query.page ?? 1;
		const limit = query.limit ?? 10;
		const offset = (page - 1) * limit;

		const tripFilter = query.tripId ? "AND t.id = $2" : "";
		const params: unknown[] = [hostId];
		if (query.tripId) params.push(query.tripId);

		const countResult: Array<{ count: string }> = await this.dataSource.query(
			`SELECT count(t.id)::text AS count
			 FROM trips t
			 WHERE t.host_id = $1 ${tripFilter}`,
			params
		);
		const total = Number.parseInt(countResult[0]?.count ?? "0", 10);

		if (total === 0) {
			return {
				items: [],
				total: 0,
				page,
				limit,
				sampleThreshold: DASHBOARD_TRIP_MIN_SAMPLE_SIZE,
			};
		}

		const queryParams = [...params, limit, offset];
		const limitPlaceholder = `$${params.length + 1}`;
		const offsetPlaceholder = `$${params.length + 2}`;

		const trips: TripRow[] = await this.dataSource.query(
			`SELECT t.id AS "tripId", t.title AS "tripTitle"
			 FROM trips t
			 WHERE t.host_id = $1 ${tripFilter}
			 ORDER BY t.created_at DESC, t.id ASC
			 LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
			queryParams
		);

		const tripIds = trips.map((t) => t.tripId);

		// Aggregate review counts and reported exclusions per trip
		const reviewCountRows: ReviewCountsRow[] = await this.dataSource.query(
			`SELECT r.trip_id AS "entityId",
			        COUNT(DISTINCT CASE 
			            WHEN NOT EXISTS (SELECT 1 FROM content_reports cr WHERE cr.target_id = r.id AND cr.target_type IN ('trip_review', 'review') AND cr.status <> 'rejected')
			            THEN r.id END)::text AS "eligibleCount",
			        COUNT(DISTINCT CASE 
			            WHEN NOT EXISTS (SELECT 1 FROM content_reports cr WHERE cr.target_id = r.id AND cr.target_type IN ('trip_review', 'review') AND cr.status <> 'rejected')
			                 AND EXISTS (SELECT 1 FROM trip_review_moderation_runs run WHERE run.review_id = r.id AND run.source_revision = r.revision AND run.aspects_status = 'completed')
			            THEN r.id END)::text AS "analyzedCount",
			        COUNT(DISTINCT CASE 
			            WHEN EXISTS (SELECT 1 FROM content_reports cr WHERE cr.target_id = r.id AND cr.target_type IN ('trip_review', 'review') AND cr.status <> 'rejected')
			            THEN r.id END)::text AS "reportedCount"
			 FROM trip_reviews r
			 WHERE r.trip_id = ANY($1)
			   AND r.target = 'trip'
			   AND r.moderation_status = 'visible'
			 GROUP BY r.trip_id`,
			[tripIds]
		);

		const countMap = new Map<
			string,
			{ eligible: number; analyzed: number; reportedExcluded: number }
		>();
		for (const row of reviewCountRows) {
			countMap.set(row.entityId, {
				eligible: Number.parseInt(row.eligibleCount, 10),
				analyzed: Number.parseInt(row.analyzedCount, 10),
				reportedExcluded: Number.parseInt(row.reportedCount, 10),
			});
		}

		// Query aspect sentiments from the latest completed run per review revision
		const aspectRows: AspectSentimentRow[] = await this.dataSource.query(
			`WITH latest_runs AS (
				SELECT DISTINCT ON (run.review_id) run.id AS run_id, run.review_id
				FROM trip_review_moderation_runs run
				JOIN trip_reviews r ON r.id = run.review_id AND r.revision = run.source_revision
				WHERE r.trip_id = ANY($1)
				  AND r.target = 'trip'
				  AND r.moderation_status = 'visible'
				  AND NOT EXISTS (
				      SELECT 1 FROM content_reports cr 
				      WHERE cr.target_id = r.id AND cr.target_type IN ('trip_review', 'review') AND cr.status <> 'rejected'
				  )
				  AND run.aspects_status = 'completed'
				ORDER BY run.review_id, run.completed_at DESC NULLS LAST, run.created_at DESC, run.id DESC
			)
			SELECT r.trip_id AS "tripId", a.aspect, a.sentiment,
			       COUNT(DISTINCT a.review_id)::text AS "distinctReviews"
			FROM latest_runs lr
			JOIN trip_reviews r ON r.id = lr.review_id
			JOIN trip_review_aspect_sentiments a ON a.run_id = lr.run_id
			GROUP BY r.trip_id, a.aspect, a.sentiment`,
			[tripIds]
		);

		// Group sentiments by trip and aspect
		const sentimentsByTrip = new Map<
			string,
			Map<AspectType, { positive: number; neutral: number; negative: number }>
		>();
		for (const row of aspectRows) {
			let tripMap = sentimentsByTrip.get(row.tripId);
			if (!tripMap) {
				tripMap = new Map();
				sentimentsByTrip.set(row.tripId, tripMap);
			}

			let counts = tripMap.get(row.aspect);
			if (!counts) {
				counts = { positive: 0, neutral: 0, negative: 0 };
				tripMap.set(row.aspect, counts);
			}

			const count = Number.parseInt(row.distinctReviews, 10);
			if (row.sentiment === "positive") counts.positive += count;
			else if (row.sentiment === "neutral") counts.neutral += count;
			else if (row.sentiment === "negative") counts.negative += count;
		}

		const items: TripFeedbackItemDto[] = trips.map((trip) => {
			const counts = countMap.get(trip.tripId) ?? {
				eligible: 0,
				analyzed: 0,
				reportedExcluded: 0,
			};
			const totalReviews = counts.eligible;
			const analyzedReviewsCount = counts.analyzed;
			const coverageRate =
				totalReviews > 0 ? Math.round((analyzedReviewsCount / totalReviews) * 100) / 100 : 1;
			const hasSufficientSample = totalReviews >= DASHBOARD_TRIP_MIN_SAMPLE_SIZE;

			const tripAspectMap = sentimentsByTrip.get(trip.tripId);
			const aspectsRecord = {} as Record<AspectType, AspectSentimentSummaryDto>;

			for (const aspect of ALL_ASPECT_TYPES) {
				const sentimentCounts = tripAspectMap?.get(aspect) ?? {
					positive: 0,
					neutral: 0,
					negative: 0,
				};
				const totalMentions =
					sentimentCounts.positive + sentimentCounts.neutral + sentimentCounts.negative;

				let netScore: number | null = null;
				if (hasSufficientSample && totalMentions > 0) {
					netScore = Math.round((sentimentCounts.positive / totalMentions) * 100);
				}

				aspectsRecord[aspect] = {
					positive: sentimentCounts.positive,
					neutral: sentimentCounts.neutral,
					negative: sentimentCounts.negative,
					netScore,
				};
			}

			return {
				tripId: trip.tripId,
				tripTitle: trip.tripTitle,
				totalReviews,
				analyzedReviewsCount,
				coverageRate,
				reportedReviewsExcludedCount: counts.reportedExcluded,
				hasSufficientSample,
				aspects: aspectsRecord,
			};
		});

		return {
			items,
			total,
			page,
			limit,
			sampleThreshold: DASHBOARD_TRIP_MIN_SAMPLE_SIZE,
		};
	}

	/**
	 * Aggregates route safety signals across trips organized by the authenticated host (target = 'trip' only).
	 * Enforces DASHBOARD_SAFETY_MIN_SAMPLE_SIZE = 10 threshold before ranking.
	 * Explicitly asserts that category counts cannot be summed together and are not safety hotspots.
	 */
	async getRoutesSafetyOverview(
		hostId: string,
		query: GetRouteSafetyOverviewQueryDto
	): Promise<RouteSafetyOverviewResponseDto> {
		const page = query.page ?? 1;
		const limit = query.limit ?? 10;
		const offset = (page - 1) * limit;

		const routeFilter = query.routeId ? "AND tr.id = $2" : "";
		const params: unknown[] = [hostId];
		if (query.routeId) params.push(query.routeId);

		// Distinct routes on which trips organized by hostId operate
		const countResult: Array<{ count: string }> = await this.dataSource.query(
			`SELECT count(DISTINCT tr.id)::text AS count
			 FROM trekking_routes tr
			 JOIN trips t ON t.route_id = tr.id
			 WHERE t.host_id = $1 ${routeFilter}`,
			params
		);
		const total = Number.parseInt(countResult[0]?.count ?? "0", 10);

		if (total === 0) {
			return {
				items: [],
				total: 0,
				page,
				limit,
				sampleThreshold: DASHBOARD_SAFETY_MIN_SAMPLE_SIZE,
				categoryCountsCannotBeSummed: true,
				notSafetyHotspots: true,
			};
		}

		const queryParams = [...params, limit, offset];
		const limitPlaceholder = `$${params.length + 1}`;
		const offsetPlaceholder = `$${params.length + 2}`;

		const routes: RouteRow[] = await this.dataSource.query(
			`SELECT tr.id AS "routeId", tr.name AS "routeName"
			 FROM trekking_routes tr
			 JOIN trips t ON t.route_id = tr.id
			 WHERE t.host_id = $1 ${routeFilter}
			 GROUP BY tr.id, tr.name
			 ORDER BY tr.name ASC, tr.id ASC
			 LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
			queryParams
		);

		const routeIds = routes.map((r) => r.routeId);

		// Aggregate review counts and reported exclusions per route
		const reviewCountRows: ReviewCountsRow[] = await this.dataSource.query(
			`SELECT t.route_id AS "entityId",
			        COUNT(DISTINCT CASE 
			            WHEN NOT EXISTS (SELECT 1 FROM content_reports cr WHERE cr.target_id = r.id AND cr.target_type IN ('trip_review', 'review') AND cr.status <> 'rejected')
			            THEN r.id END)::text AS "eligibleCount",
			        COUNT(DISTINCT CASE 
			            WHEN NOT EXISTS (SELECT 1 FROM content_reports cr WHERE cr.target_id = r.id AND cr.target_type IN ('trip_review', 'review') AND cr.status <> 'rejected')
			                 AND EXISTS (SELECT 1 FROM trip_review_moderation_runs run WHERE run.review_id = r.id AND run.source_revision = r.revision AND run.incidents_status = 'completed')
			            THEN r.id END)::text AS "analyzedCount",
			        COUNT(DISTINCT CASE 
			            WHEN EXISTS (SELECT 1 FROM content_reports cr WHERE cr.target_id = r.id AND cr.target_type IN ('trip_review', 'review') AND cr.status <> 'rejected')
			            THEN r.id END)::text AS "reportedCount"
			 FROM trip_reviews r
			 JOIN trips t ON t.id = r.trip_id
			 WHERE t.route_id = ANY($1)
			   AND t.host_id = $2
			   AND r.target = 'trip'
			   AND r.moderation_status = 'visible'
			 GROUP BY t.route_id`,
			[routeIds, hostId]
		);

		const countMap = new Map<
			string,
			{ eligible: number; analyzed: number; reportedExcluded: number }
		>();
		for (const row of reviewCountRows) {
			countMap.set(row.entityId, {
				eligible: Number.parseInt(row.eligibleCount, 10),
				analyzed: Number.parseInt(row.analyzedCount, 10),
				reportedExcluded: Number.parseInt(row.reportedCount, 10),
			});
		}

		// Query incident signals from the latest completed run per review revision
		const signalRows: IncidentSignalRow[] = await this.dataSource.query(
			`WITH latest_runs AS (
				SELECT DISTINCT ON (run.review_id) run.id AS run_id, run.review_id
				FROM trip_review_moderation_runs run
				JOIN trip_reviews r ON r.id = run.review_id AND r.revision = run.source_revision
				JOIN trips t ON t.id = r.trip_id
				WHERE t.route_id = ANY($1)
				  AND t.host_id = $2
				  AND r.target = 'trip'
				  AND r.moderation_status = 'visible'
				  AND NOT EXISTS (
				      SELECT 1 FROM content_reports cr 
				      WHERE cr.target_id = r.id AND cr.target_type IN ('trip_review', 'review') AND cr.status <> 'rejected'
				  )
				  AND run.incidents_status = 'completed'
				ORDER BY run.review_id, run.completed_at DESC NULLS LAST, run.created_at DESC, run.id DESC
			)
			SELECT t.route_id AS "routeId", s.incident_type AS "incidentType",
			       s.occurred, s.severity, s.quote, s.review_id AS "reviewId"
			FROM latest_runs lr
			JOIN trip_reviews r ON r.id = lr.review_id
			JOIN trips t ON t.id = r.trip_id
			JOIN trip_review_incident_signals s ON s.run_id = lr.run_id`,
			[routeIds, hostId]
		);

		// Group signals by route
		const signalsByRoute = new Map<string, IncidentSignalRow[]>();
		for (const row of signalRows) {
			const list = signalsByRoute.get(row.routeId) ?? [];
			list.push(row);
			signalsByRoute.set(row.routeId, list);
		}

		const items: RouteSafetyItemDto[] = routes.map((route) => {
			const counts = countMap.get(route.routeId) ?? {
				eligible: 0,
				analyzed: 0,
				reportedExcluded: 0,
			};
			const totalReviews = counts.eligible;
			const analyzedReviewsCount = counts.analyzed;
			const coverageRate =
				totalReviews > 0 ? Math.round((analyzedReviewsCount / totalReviews) * 100) / 100 : 1;
			const hasSufficientSample = totalReviews >= DASHBOARD_SAFETY_MIN_SAMPLE_SIZE;

			const routeSignals = signalsByRoute.get(route.routeId) ?? [];

			// Overall distinct review counts
			const reviewsWithIncidents = new Set<string>();
			const reviewsWithWarnings = new Set<string>();

			for (const sig of routeSignals) {
				if (sig.occurred === "yes") reviewsWithIncidents.add(sig.reviewId);
				else if (sig.occurred === "warning") reviewsWithWarnings.add(sig.reviewId);
			}

			// Group by category
			const categorySignals: IncidentSignalSummaryDto[] = ALL_INCIDENT_TYPES.map((category) => {
				const catRows = routeSignals.filter((s) => s.incidentType === category);

				const occurredReviews = new Set<string>();
				const warningReviews = new Set<string>();
				const unknownReviews = new Set<string>();

				const severityReviews: Record<IncidentSeverity, Set<string>> = {
					minor: new Set(),
					moderate: new Set(),
					severe: new Set(),
					unknown: new Set(),
				};

				const quotes: string[] = [];

				for (const row of catRows) {
					if (row.occurred === "yes") {
						occurredReviews.add(row.reviewId);
						if (severityReviews[row.severity]) {
							severityReviews[row.severity].add(row.reviewId);
						}
					} else if (row.occurred === "warning") {
						warningReviews.add(row.reviewId);
					} else if (row.occurred === "unknown") {
						unknownReviews.add(row.reviewId);
					}

					if (row.quote && quotes.length < 3 && !quotes.includes(row.quote)) {
						quotes.push(row.quote);
					}
				}

				const severityBreakdown: Record<IncidentSeverity, number> = {
					minor: severityReviews.minor.size,
					moderate: severityReviews.moderate.size,
					severe: severityReviews.severe.size,
					unknown: severityReviews.unknown.size,
				};

				return {
					category,
					occurredCount: occurredReviews.size,
					warningCount: warningReviews.size,
					unknownCount: unknownReviews.size,
					severityBreakdown,
					sampleQuotes: quotes,
				};
			});

			return {
				routeId: route.routeId,
				routeName: route.routeName,
				totalReviews,
				analyzedReviewsCount,
				coverageRate,
				reportedReviewsExcludedCount: counts.reportedExcluded,
				hasSufficientSample,
				totalDistinctReviewsWithIncidents: reviewsWithIncidents.size,
				totalDistinctReviewsWithWarnings: reviewsWithWarnings.size,
				incidentSignals: categorySignals,
			};
		});

		return {
			items,
			total,
			page,
			limit,
			sampleThreshold: DASHBOARD_SAFETY_MIN_SAMPLE_SIZE,
			categoryCountsCannotBeSummed: true,
			notSafetyHotspots: true,
		};
	}
}
