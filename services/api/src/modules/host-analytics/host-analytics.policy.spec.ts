import {
	buildAllowedFutureMonths,
	buildLeadTime,
	buildOperationsMetrics,
	buildRouteCandidates,
	buildSeasonality,
	buildSuggestedTripTitle,
	computeSourceHash,
	computeSuggestedSchedule,
	monthKeyInVietnam,
	roundToTenThousandVnd,
	sanitizeAiNarrativeText,
	validateAiPlanningSelection,
	vietnamDateKey,
} from "./host-analytics.policy";

describe("host-analytics.policy", () => {
	it("classifies a late-night end-of-month Vietnam departure into the Vietnam month", () => {
		// 2026-08-31 23:30:00+07:00 == 2026-08-31T16:30:00.000Z
		expect(monthKeyInVietnam(new Date("2026-08-31T16:30:00.000Z"))).toBe("2026-08");
		// 2026-09-01 00:30:00+07:00 == 2026-08-31T17:30:00.000Z
		expect(monthKeyInVietnam(new Date("2026-08-31T17:30:00.000Z"))).toBe("2026-09");
	});

	it("computes fillRate from seatsTaken/capacityMax, excludes missing capacityMax/numPeople, and separates cancelled trips", () => {
		const trips = [
			{
				id: "t1",
				title: "Chuyến 1",
				routeId: "r1",
				routeName: "Tuyến Sơn Trà",
				tripType: "day_trip" as const,
				areaCode: "DNG-SON-TRA",
				areaName: "Sơn Trà",
				startsAt: new Date("2026-08-15T01:00:00Z"),
				capacityMin: 4,
				capacityMax: 10,
				seatsTaken: 8,
				pricePerPerson: 650000,
			},
			{
				id: "t2",
				title: "Chuyến thiếu sức chứa",
				routeId: "r1",
				routeName: "Tuyến Sơn Trà",
				tripType: "day_trip" as const,
				areaCode: "DNG-SON-TRA",
				areaName: "Sơn Trà",
				startsAt: new Date("2026-08-20T01:00:00Z"),
				capacityMin: 4,
				capacityMax: null,
				seatsTaken: 5,
				pricePerPerson: 650000,
			},
		];

		const bookings = [
			{
				id: "b1",
				tripId: "t1",
				status: "completed",
				numPeople: 8,
				createdAt: new Date("2026-08-05T01:00:00Z"),
				tripStartsAtSnapshot: new Date("2026-08-15T01:00:00Z"),
			},
			{
				id: "b2",
				tripId: "t1",
				status: "cancelled",
				numPeople: 2,
				createdAt: new Date("2026-08-06T01:00:00Z"),
				tripStartsAtSnapshot: new Date("2026-08-15T01:00:00Z"),
			},
			{
				id: "b3",
				tripId: "t2",
				status: "completed",
				numPeople: null,
				createdAt: new Date("2026-08-10T01:00:00Z"),
				tripStartsAtSnapshot: new Date("2026-08-20T01:00:00Z"),
			},
		];

		const ops = buildOperationsMetrics(trips, bookings, 1, 3);
		expect(ops.fillRate).toBe(80);
		expect(ops.totalGuests).toBe(8);
		expect(ops.cancellationRate).toBe(33.33);
		expect(ops.excludedTrips).toEqual([
			{ tripId: "t2", title: "Chuyến thiếu sức chứa", reason: "missing_capacity_max" },
			{ tripId: "t2", title: "Chuyến thiếu sức chứa", reason: "missing_num_people" },
		]);
		expect(ops.cancelledTrips).toEqual({
			count: 1,
			tripCancellationRate: 33.33,
			bookingsOnCancelledTrips: 3,
		});

		const lead = buildLeadTime(bookings);
		expect(lead).toEqual({ averageDays: 10, medianDays: 10, sampleSize: 2 });
	});

	it("returns null instead of 0 when no eligible data exists", () => {
		const ops = buildOperationsMetrics([], [], 0, 0);
		expect(ops.fillRate).toBeNull();
		expect(ops.totalGuests).toBeNull();
		expect(ops.cancellationRate).toBeNull();
		expect(ops.cancelledTrips.tripCancellationRate).toBeNull();
	});

	it("computes seasonality by >=12-month span filling off-season months with 0 trips", () => {
		// Earliest: 2025-12, Latest: 2026-11 => 12 months span even if off-season months have 0 trips
		const res = buildSeasonality([
			{ startsAt: new Date("2025-12-10T02:00:00Z"), capacityMax: 10, seatsTaken: 8, guests: 8 },
			{ startsAt: new Date("2026-04-10T02:00:00Z"), capacityMax: 10, seatsTaken: 10, guests: 10 },
			{ startsAt: new Date("2026-04-20T02:00:00Z"), capacityMax: 10, seatsTaken: 9, guests: 9 },
			{ startsAt: new Date("2026-11-10T02:00:00Z"), capacityMax: 10, seatsTaken: 7, guests: 7 },
		]);

		expect(res.status).toBe("ok");
		expect(res.basis).toBe("all_history");
		expect(res.historySpanMonths).toBe(12);
		expect(res.trend).toHaveLength(12);
		expect(res.trend[0].month).toBe("2025-12");
		expect(res.trend[11].month).toBe("2026-11");
		const jan = res.trend.find((m) => m.month === "2026-01");
		expect(jan).toEqual({ month: "2026-01", tripCount: 0, totalGuests: 0, fillRate: null });
		expect(res.highestMonths?.[0]).toBe("2026-04");
		expect(res.lowestMonths).toContain("2026-01");
	});

	it("marks seasonality insufficient_history when span < 12 months", () => {
		const res = buildSeasonality([
			{ startsAt: new Date("2026-06-10T02:00:00Z"), capacityMax: 10, seatsTaken: 6, guests: 6 },
			{ startsAt: new Date("2026-11-10T02:00:00Z"), capacityMax: 10, seatsTaken: 8, guests: 8 },
		]);
		expect(res.status).toBe("insufficient_history");
		expect(res.basis).toBe("all_history");
		expect(res.historySpanMonths).toBe(6);
		expect(res.highestMonths).toBeNull();
		expect(res.lowestMonths).toBeNull();
		expect(res.trend).toHaveLength(6);
	});

	it("rounds suggested_price_per_person to nearest 10,000 VND integer and validates AI selections strictly", () => {
		expect(roundToTenThousandVnd(654999)).toBe(650000);
		expect(roundToTenThousandVnd(655000)).toBe(660000);

		const candidates = buildRouteCandidates(
			[
				{
					routeId: "r-active",
					routeName: "Tuyến A",
					areaCode: "DNG-SON-TRA",
					areaName: "Sơn Trà",
					areaActive: true,
				},
				{
					routeId: "r-no-trip",
					routeName: "Tuyến mới chưa có chuyến",
					areaCode: null,
					areaName: null,
					areaActive: false,
				},
			],
			[
				{
					id: "t1",
					title: "T1",
					routeId: "r-active",
					routeName: "Tuyến A",
					tripType: "day_trip",
					areaCode: "DNG-SON-TRA",
					areaName: "Sơn Trà",
					startsAt: new Date("2026-10-01T02:00:00Z"),
					capacityMin: 6,
					capacityMax: 10,
					seatsTaken: 8,
					pricePerPerson: 654000,
				},
			],
			"DNG-SON-TRA",
			new Date("2026-11-20T02:00:00Z")
		);

		// Route with no trip (areaCode=null) is excluded when areaCode filter is active
		expect(candidates).toHaveLength(1);
		expect(candidates[0].suggestedPricePerPerson).toBe(650000);
		expect(candidates[0].suggestedCapacityMin).toBe(6);

		const selected = validateAiPlanningSelection(candidates, [
			{ candidateId: "cand-1", monthHint: "2026-12", rationaleCodes: ["high_fill_history"] },
			{ candidateId: "cand-999", monthHint: "2026-12", rationaleCodes: ["high_fill_history"] },
			{ candidateId: "cand-1", monthHint: "2030-01", rationaleCodes: ["high_fill_history"] },
		]);
		expect(selected).toEqual([
			{
				candidateId: "cand-1",
				monthHint: "2026-12",
				rationaleCodes: ["high_fill_history"],
				aiSeasonNote: null,
				aiRisks: null,
				aiConfidence: null,
			},
		]);
	});

	it("computes valid suggested schedule with 14-day buffer, avoids RED dates, and sanitizes URLs/invented numbers from AI notes", () => {
		const now = new Date("2026-11-20T02:00:00.000Z"); // 2026-11-20 09:00 VN; +14d = 2026-12-04
		expect(buildAllowedFutureMonths(now, 3)).toEqual(["2026-12", "2027-01", "2027-02"]);
		expect(buildSuggestedTripTitle("Leo núi Sơn Trà", "2026-12")).toBe(
			"Leo núi Sơn Trà (Tháng 12/2026)"
		);

		const latestTrip = {
			id: "t-old",
			title: "Leo núi Sơn Trà",
			routeId: "r-1",
			tripType: "day_trip" as const,
			areaCode: "DNG-SON-TRA",
			capacityMin: 4,
			capacityMax: 12,
			pricePerPerson: 650000,
			// Saturday 2026-10-17 06:00 VN == 2026-10-16T23:00:00Z
			startsAt: new Date("2026-10-16T23:00:00.000Z"),
			endsAt: new Date("2026-10-17T06:00:00.000Z"),
			meetingAt: new Date("2026-10-16T22:30:00.000Z"),
			bookingDeadline: new Date("2026-10-14T23:00:00.000Z"),
			meetingLongitude: 108.25,
			meetingLatitude: 16.1,
			routeLengthMeters: 6000,
		};

		const sched = computeSuggestedSchedule(latestTrip, "2026-12", now);
		expect(sched).not.toBeNull();
		if (!sched) {
			throw new Error("Expected sched not to be null");
		}
		expect(sched.bookingDeadline.getTime()).toBeGreaterThan(now.getTime());
		expect(sched.meetingAt.getTime()).toBeGreaterThan(sched.bookingDeadline.getTime());
		expect(sched.startsAt.getTime()).toBeGreaterThan(sched.meetingAt.getTime());
		expect(sched.endsAt.getTime()).toBeGreaterThan(sched.startsAt.getTime());

		// Avoid the first picked Saturday -> shifts to next valid date (Vietnam local date key)
		const firstDate = vietnamDateKey(sched.startsAt);
		const shifted = computeSuggestedSchedule(latestTrip, "2026-12", now, new Set([firstDate]));
		expect(shifted).not.toBeNull();
		if (!shifted) {
			throw new Error("Expected shifted not to be null");
		}
		expect(vietnamDateKey(shifted.startsAt)).not.toBe(firstDate);

		// Post-validation rejects URLs and invented numbers
		const allowed = new Set(["12", "2026"]);
		expect(
			sanitizeAiNarrativeText("Tháng 12 mát mẻ, xem https://example.com", 280, allowed)
		).toBeNull();
		expect(sanitizeAiNarrativeText("Tháng 12 có 999 khách đặt mỗi tuần", 280, allowed)).toBeNull();
		expect(
			sanitizeAiNarrativeText("Tháng 12 thời tiết mát, thuận lợi đi bộ đường dài.", 280, allowed)
		).toBe("Tháng 12 thời tiết mát, thuận lợi đi bộ đường dài.");
	});

	it("changes source_hash when underlying trip or financial totals change", () => {
		const base = {
			hostId: "host-1",
			periodFrom: "2025-11-20T00:00:00.000Z",
			periodTo: "2026-11-20T00:00:00.000Z",
			areaCode: null,
			tripIds: ["t1", "t2"],
			maxTripUpdatedAt: "2026-11-10T00:00:00.000Z",
			bookingCountsByStatus: { completed: 5, cancelled: 1 },
			financialTotals: {
				grossRevenue: 10000000,
				refundAmount: 0,
				platformFee: 500000,
				netRevenue: 9500000,
				postSettlementRefund: 0,
			},
			formulaVersion: "host-analytics-v1",
			promptVersion: "host-planning-v1",
		};

		const h1 = computeSourceHash(base);
		const h2 = computeSourceHash({ ...base, tripIds: ["t2", "t1"] });
		const h3 = computeSourceHash({
			...base,
			financialTotals: { ...base.financialTotals, grossRevenue: 11000000 },
		});

		expect(h1).toBe(h2);
		expect(h1).not.toBe(h3);
	});
});
