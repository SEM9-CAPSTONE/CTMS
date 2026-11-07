import type { DataSource } from "typeorm";
import { TripReviewAnalyticsHostService } from "./trip-review-analytics-host.service";

describe("TripReviewAnalyticsHostService", () => {
	let service: TripReviewAnalyticsHostService;
	let mockDataSource: jest.Mocked<DataSource>;

	beforeEach(() => {
		mockDataSource = {
			query: jest.fn(),
		} as unknown as jest.Mocked<DataSource>;

		service = new TripReviewAnalyticsHostService(mockDataSource);
	});

	describe("getTripsFeedbackOverview", () => {
		it("returns empty items when host has no trips", async () => {
			mockDataSource.query.mockResolvedValueOnce([{ count: "0" }]);

			const result = await service.getTripsFeedbackOverview("host-1", {});
			expect(result.total).toBe(0);
			expect(result.items).toEqual([]);
			expect(result.sampleThreshold).toBe(5);
		});

		it("aggregates aspect sentiments and calculates netScore only when sample is sufficient (>= 5)", async () => {
			// 1. Total count
			mockDataSource.query.mockResolvedValueOnce([{ count: "2" }]);
			// 2. Trips
			mockDataSource.query.mockResolvedValueOnce([
				{ tripId: "trip-1", tripTitle: "Trip One" },
				{ tripId: "trip-2", tripTitle: "Trip Two" },
			]);
			// 3. Review counts
			mockDataSource.query.mockResolvedValueOnce([
				{ entityId: "trip-1", eligibleCount: "6", analyzedCount: "6", reportedCount: "1" },
				{ entityId: "trip-2", eligibleCount: "3", analyzedCount: "3", reportedCount: "0" },
			]);
			// 4. Aspect sentiments
			mockDataSource.query.mockResolvedValueOnce([
				{ tripId: "trip-1", aspect: "safety", sentiment: "positive", distinctReviews: "5" },
				{ tripId: "trip-1", aspect: "safety", sentiment: "negative", distinctReviews: "1" },
				{ tripId: "trip-2", aspect: "safety", sentiment: "positive", distinctReviews: "3" },
			]);

			const result = await service.getTripsFeedbackOverview("host-1", {});

			expect(result.total).toBe(2);
			expect(result.items.length).toBe(2);

			// Trip 1 (totalReviews = 6 >= 5 -> hasSufficientSample = true)
			const trip1 = result.items.find((t) => t.tripId === "trip-1");
			expect(trip1).toBeDefined();
			expect(trip1?.hasSufficientSample).toBe(true);
			expect(trip1?.reportedReviewsExcludedCount).toBe(1);
			expect(trip1?.coverageRate).toBe(1);
			expect(trip1?.aspects.safety.positive).toBe(5);
			expect(trip1?.aspects.safety.negative).toBe(1);
			// 5 positive out of 6 mentions = 83%
			expect(trip1?.aspects.safety.netScore).toBe(83);

			// Trip 2 (totalReviews = 3 < 5 -> hasSufficientSample = false)
			const trip2 = result.items.find((t) => t.tripId === "trip-2");
			expect(trip2).toBeDefined();
			expect(trip2?.hasSufficientSample).toBe(false);
			expect(trip2?.aspects.safety.positive).toBe(3);
			// Sample insufficient -> netScore must be null
			expect(trip2?.aspects.safety.netScore).toBeNull();
		});
	});

	describe("getRoutesSafetyOverview", () => {
		it("returns empty items when host has no routes/trips", async () => {
			mockDataSource.query.mockResolvedValueOnce([{ count: "0" }]);

			const result = await service.getRoutesSafetyOverview("host-1", {});
			expect(result.total).toBe(0);
			expect(result.items).toEqual([]);
			expect(result.sampleThreshold).toBe(10);
			expect(result.categoryCountsCannotBeSummed).toBe(true);
			expect(result.notSafetyHotspots).toBe(true);
		});

		it("aggregates incident signals using distinct review counting and separates occurred vs warning", async () => {
			// 1. Total routes count
			mockDataSource.query.mockResolvedValueOnce([{ count: "1" }]);
			// 2. Routes
			mockDataSource.query.mockResolvedValueOnce([
				{ routeId: "route-1", routeName: "Fansipan Summit Route" },
			]);
			// 3. Review counts
			mockDataSource.query.mockResolvedValueOnce([
				{ entityId: "route-1", eligibleCount: "12", analyzedCount: "12", reportedCount: "2" },
			]);
			// 4. Incident signals
			mockDataSource.query.mockResolvedValueOnce([
				{
					routeId: "route-1",
					incidentType: "fall_slip",
					occurred: "yes",
					severity: "minor",
					quote: "Đoạn dốc trơn trượt",
					reviewId: "rev-1",
				},
				{
					routeId: "route-1",
					incidentType: "injury",
					occurred: "yes",
					severity: "moderate",
					quote: "Tôi bị trật chân",
					reviewId: "rev-1", // Same review triggers fall_slip AND injury!
				},
				{
					routeId: "route-1",
					incidentType: "weather_hazard",
					occurred: "warning",
					severity: "unknown",
					quote: "Nên mang áo mưa nếu đi mùa này",
					reviewId: "rev-2",
				},
			]);

			const result = await service.getRoutesSafetyOverview("host-1", {});

			expect(result.total).toBe(1);
			expect(result.categoryCountsCannotBeSummed).toBe(true);
			expect(result.notSafetyHotspots).toBe(true);
			expect(result.sampleThreshold).toBe(10);

			const route = result.items[0];
			expect(route.routeId).toBe("route-1");
			expect(route.totalReviews).toBe(12);
			expect(route.hasSufficientSample).toBe(true); // 12 >= 10
			expect(route.reportedReviewsExcludedCount).toBe(2);

			// Distinct reviews check: rev-1 has both fall_slip and injury, but distinct count is 1!
			expect(route.totalDistinctReviewsWithIncidents).toBe(1);
			expect(route.totalDistinctReviewsWithWarnings).toBe(1);

			// fall_slip check
			const fallSlip = route.incidentSignals.find((s) => s.category === "fall_slip");
			expect(fallSlip?.occurredCount).toBe(1);
			expect(fallSlip?.severityBreakdown.minor).toBe(1);
			expect(fallSlip?.sampleQuotes).toContain("Đoạn dốc trơn trượt");

			// injury check
			const injury = route.incidentSignals.find((s) => s.category === "injury");
			expect(injury?.occurredCount).toBe(1);
			expect(injury?.severityBreakdown.moderate).toBe(1);
			expect(injury?.sampleQuotes).toContain("Tôi bị trật chân");

			// weather_hazard check (warning)
			const weather = route.incidentSignals.find((s) => s.category === "weather_hazard");
			expect(weather?.warningCount).toBe(1);
			expect(weather?.occurredCount).toBe(0);
			expect(weather?.sampleQuotes).toContain("Nên mang áo mưa nếu đi mùa này");
		});
	});
});
