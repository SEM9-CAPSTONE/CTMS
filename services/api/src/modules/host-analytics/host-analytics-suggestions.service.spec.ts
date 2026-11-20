import { ConflictException, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { TrekkingRouteStatus } from "../trekking-routes/entities/trekking-route.entity";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import { HostAnalyticsAiError } from "./host-analytics-ai.provider";
import {
	HostAnalyticsRateLimitException,
	HostAnalyticsSuggestionsService,
} from "./host-analytics-suggestions.service";

describe("HostAnalyticsSuggestionsService", () => {
	const hostA = { userId: "host-a", roles: [UserRole.HOST], status: UserStatus.ACTIVE };

	const mockFinancial = {
		kpis: {
			grossRevenue: 5000000,
			refundAmount: 0,
			platformFee: 250000,
			netRevenue: 4750000,
			postSettlementRefund: 0,
		},
	};

	function buildHarness() {
		const managerQuery = jest.fn();
		const dataSource = {
			query: jest.fn(),
			transaction: jest.fn(async (cb: (m: { query: jest.Mock }) => Promise<unknown>) =>
				cb({ query: managerQuery })
			),
		};
		const configService = {
			get: jest.fn((key: string) => {
				if (key === "HOST_ANALYTICS_COOLDOWN_SECONDS") return "60";
				if (key === "HOST_ANALYTICS_DAILY_QUOTA") return "5";
				return undefined;
			}),
		};
		const revenueService = {
			getRevenueAnalytics: jest.fn().mockResolvedValue(mockFinancial),
		};
		const repository = {
			areaExists: jest.fn().mockResolvedValue(true),
			isAreaActive: jest.fn().mockResolvedValue(true),
			getActiveRoutesWithLatestArea: jest.fn().mockResolvedValue([
				{
					routeId: "route-1",
					routeName: "Tuyến Sơn Trà",
					areaCode: "DNG-SON-TRA",
					areaName: "Sơn Trà",
					areaActive: true,
				},
			]),
			getCompletedTripsInWindow: jest.fn().mockResolvedValue([
				{
					id: "trip-1",
					title: "T1",
					routeId: "route-1",
					routeName: "Tuyến Sơn Trà",
					tripType: "day_trip",
					areaCode: "DNG-SON-TRA",
					areaName: "Sơn Trà",
					startsAt: new Date("2026-10-10T02:00:00Z"),
					capacityMin: 6,
					capacityMax: 10,
					seatsTaken: 8,
					pricePerPerson: 654000,
				},
			]),
			getHostTripFingerprintData: jest.fn().mockResolvedValue({
				tripIds: ["trip-1"],
				maxUpdatedAt: "2026-10-11T00:00:00.000Z",
				bookingCountsByStatus: { completed: 5 },
			}),
			getRouteStatusForHost: jest
				.fn()
				.mockResolvedValue({ hostId: "host-a", status: TrekkingRouteStatus.ACTIVE }),
		};
		const aiProvider = {
			generatePlanningSelections: jest.fn(),
		};

		const service = new HostAnalyticsSuggestionsService(
			dataSource as never,
			configService as never,
			revenueService as never,
			repository as never,
			aiProvider as never
		);
		return { service, dataSource, managerQuery, repository, aiProvider };
	}

	it("rejects createJob with 422 when host has no eligible active routes", async () => {
		const { service, repository } = buildHarness();
		repository.getActiveRoutesWithLatestArea.mockResolvedValue([]);
		await expect(service.createJob(hostA, {})).rejects.toBeInstanceOf(UnprocessableEntityException);
	});

	it("returns 409 active_job_different_params when an active job exists for different params", async () => {
		const { service, dataSource, managerQuery } = buildHarness();
		dataSource.query.mockResolvedValueOnce([]); // no reusable succeeded job
		managerQuery
			.mockResolvedValueOnce([]) // insert control
			.mockResolvedValueOnce([
				{
					host_id: "host-a",
					last_created_at: null,
					daily_date_vn: "2026-11-20",
					daily_count: 1,
				},
			]) // select control FOR UPDATE
			.mockResolvedValueOnce([
				{
					id: "job-active",
					host_id: "host-a",
					period_from: "2025-10-01T00:00:00.000Z",
					period_to: "2026-10-01T00:00:00.000Z",
					area_code: "DNG-SON-TRA",
					status: "running",
				},
			]);

		await expect(
			service.createJob(
				hostA,
				{ from: "2025-11-20T00:00:00.000Z", to: "2026-11-20T00:00:00.000Z" },
				new Date("2026-11-20T03:00:00.000Z")
			)
		).rejects.toBeInstanceOf(ConflictException);
	});

	it("enforces per-host 60s cooldown and 5/day daily quota with Retry-After", async () => {
		const { service, dataSource, managerQuery } = buildHarness();
		const now = new Date("2026-11-20T03:00:30.000Z");

		dataSource.query.mockResolvedValueOnce([]);
		managerQuery
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{
					host_id: "host-a",
					last_created_at: "2026-11-20T03:00:00.000Z",
					daily_date_vn: "2026-11-20",
					daily_count: 1,
				},
			])
			.mockResolvedValueOnce([]);

		await expect(service.createJob(hostA, {}, now)).rejects.toMatchObject({
			retryAfterSeconds: 30,
		});

		// Daily quota reached
		dataSource.query.mockResolvedValueOnce([]);
		managerQuery
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{
					host_id: "host-a",
					last_created_at: "2026-11-20T01:00:00.000Z",
					daily_date_vn: "2026-11-20",
					daily_count: 5,
				},
			])
			.mockResolvedValueOnce([]);

		await expect(service.createJob(hostA, {}, now)).rejects.toBeInstanceOf(
			HostAnalyticsRateLimitException
		);
	});

	it("returns 404 when reading another host's job and marks stale=true when source_hash changed", async () => {
		const { service, dataSource } = buildHarness();
		dataSource.query.mockResolvedValueOnce([]);
		await expect(service.getJobById(hostA, "other-job")).rejects.toBeInstanceOf(NotFoundException);

		dataSource.query
			.mockResolvedValueOnce([
				{
					id: "job-1",
					host_id: "host-a",
					period_from: "2025-11-20T00:00:00.000Z",
					period_to: "2026-11-20T00:00:00.000Z",
					area_code: null,
					status: "succeeded",
					source_hash: "outdated-hash",
					prompt_version: "host-planning-v1",
					attempts: 1,
					error_code: null,
					lease_token: null,
					created_at: "2026-11-20T00:00:00.000Z",
					started_at: "2026-11-20T00:00:01.000Z",
					finished_at: "2026-11-20T00:00:03.000Z",
				},
			])
			.mockResolvedValueOnce([]); // suggestions list

		const job = await service.getJobById(hostA, "job-1");
		expect(job.stale).toBe(true);
	});

	it("validates quick-create-context live and preserves null suggested price/capacity", async () => {
		const { service, dataSource, repository } = buildHarness();
		dataSource.query.mockResolvedValueOnce([
			{
				id: "sug-1",
				host_id: "host-a",
				route_id: "route-1",
				area_code: "DNG-SON-TRA",
				trip_type: "day_trip",
				month_hint: "2027-01",
				suggested_price_per_person: null,
				suggested_capacity_min: null,
			},
		]);

		const ctx = await service.getQuickCreateContext(hostA, "sug-1");
		expect(ctx).toEqual({
			valid: true,
			prefill: {
				routeId: "route-1",
				areaCode: "DNG-SON-TRA",
				tripType: "day_trip",
				pricePerPerson: null,
				capacityMin: null,
				suggestedMonth: "2027-01",
			},
		});

		// Route becomes closed -> 409
		dataSource.query.mockResolvedValueOnce([
			{
				id: "sug-1",
				host_id: "host-a",
				route_id: "route-1",
				area_code: "DNG-SON-TRA",
				trip_type: "day_trip",
				month_hint: "2027-01",
				suggested_price_per_person: 650000,
				suggested_capacity_min: 6,
			},
		]);
		repository.getRouteStatusForHost.mockResolvedValueOnce({
			hostId: "host-a",
			status: TrekkingRouteStatus.CLOSED,
		});
		await expect(service.getQuickCreateContext(hostA, "sug-1")).rejects.toBeInstanceOf(
			ConflictException
		);

		// Route no longer owned -> 409 route_not_owned
		dataSource.query.mockResolvedValueOnce([
			{
				id: "sug-1",
				host_id: "host-a",
				route_id: "route-1",
				area_code: "DNG-SON-TRA",
				trip_type: "day_trip",
				month_hint: "2027-01",
				suggested_price_per_person: 650000,
				suggested_capacity_min: 6,
			},
		]);
		repository.getRouteStatusForHost.mockResolvedValueOnce({
			hostId: "host-b",
			status: TrekkingRouteStatus.ACTIVE,
		});
		await expect(service.getQuickCreateContext(hostA, "sug-1")).rejects.toMatchObject({
			response: expect.objectContaining({ error: "route_not_owned" }),
		});

		// Area deactivated -> 409 area_inactive
		dataSource.query.mockResolvedValueOnce([
			{
				id: "sug-1",
				host_id: "host-a",
				route_id: "route-1",
				area_code: "DNG-SON-TRA",
				trip_type: "day_trip",
				month_hint: "2027-01",
				suggested_price_per_person: 650000,
				suggested_capacity_min: 6,
			},
		]);
		repository.getRouteStatusForHost.mockResolvedValueOnce({
			hostId: "host-a",
			status: TrekkingRouteStatus.ACTIVE,
		});
		repository.isAreaActive.mockResolvedValueOnce(false);
		await expect(service.getQuickCreateContext(hostA, "sug-1")).rejects.toMatchObject({
			response: expect.objectContaining({ error: "area_inactive" }),
		});
	});

	it("returns 202 reusing active job when params are identical and isolates cooldown per host", async () => {
		const { service, dataSource, managerQuery } = buildHarness();
		const hostB = { userId: "host-b", roles: [UserRole.HOST], status: UserStatus.ACTIVE };
		const from = "2025-11-20T00:00:00.000Z";
		const to = "2026-11-20T00:00:00.000Z";
		const now = new Date("2026-11-20T03:00:30.000Z");

		// Same params while active -> 202 returning active job
		dataSource.query
			.mockResolvedValueOnce([]) // no reusable succeeded job
			.mockResolvedValueOnce([]); // suggestions for presentJob
		managerQuery
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{
					host_id: "host-a",
					last_created_at: "2026-11-20T03:00:00.000Z",
					daily_date_vn: "2026-11-20",
					daily_count: 1,
				},
			])
			.mockResolvedValueOnce([
				{
					id: "job-same",
					host_id: "host-a",
					period_from: from,
					period_to: to,
					area_code: "DNG-SON-TRA",
					status: "queued",
					source_hash: "h",
					prompt_version: "host-planning-v1",
					attempts: 0,
					error_code: null,
					lease_token: null,
					created_at: "2026-11-20T03:00:00.000Z",
					started_at: null,
					finished_at: null,
				},
			]);

		const sameRes = await service.createJob(hostA, { from, to, areaCode: "DNG-SON-TRA" }, now);
		expect(sameRes.httpStatus).toBe(202);
		expect(sameRes.job.id).toBe("job-same");

		// Host B is not blocked by Host A's cooldown
		dataSource.query
			.mockResolvedValueOnce([]) // no reusable succeeded job
			.mockResolvedValueOnce([]); // suggestions for presentJob
		managerQuery
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{
					host_id: "host-b",
					last_created_at: null,
					daily_date_vn: "2026-11-20",
					daily_count: 0,
				},
			])
			.mockResolvedValueOnce([]) // no active job for hostB
			.mockResolvedValueOnce([]) // update host_analytics_control
			.mockResolvedValueOnce([
				{
					id: "job-host-b",
					host_id: "host-b",
					period_from: from,
					period_to: to,
					area_code: null,
					status: "queued",
					source_hash: "hb",
					prompt_version: "host-planning-v1",
					attempts: 0,
					error_code: null,
					lease_token: null,
					created_at: now.toISOString(),
					started_at: null,
					finished_at: null,
				},
			]);

		const hostBRes = await service.createJob(hostB, { from, to }, now);
		expect(hostBRes.httpStatus).toBe(202);
		expect(hostBRes.job.id).toBe("job-host-b");
	});

	it("refunds daily quota when AI fails terminally with analysis_unavailable", async () => {
		const { service, managerQuery, aiProvider } = buildHarness();
		const claimedJob = {
			id: "job-fail",
			host_id: "host-a",
			period_from: "2025-11-20T00:00:00.000Z",
			period_to: "2026-11-20T00:00:00.000Z",
			area_code: null,
			status: "running",
			source_hash: "h",
			prompt_version: "host-planning-v1",
			attempts: 3,
			error_code: null,
			lease_token: "lease",
			created_at: "2026-11-20T02:00:00.000Z",
			started_at: "2026-11-20T02:00:01.000Z",
			finished_at: null,
		};

		// Claim transaction
		managerQuery
			.mockResolvedValueOnce([claimedJob])
			.mockResolvedValueOnce([claimedJob])
			// Fail transaction: update job + refund daily_count
			.mockResolvedValueOnce([{ id: "job-fail" }])
			.mockResolvedValueOnce([]);

		aiProvider.generatePlanningSelections.mockRejectedValueOnce(
			new HostAnalyticsAiError("timeout", "analysis_unavailable", false)
		);

		const processed = await service.processNextJob(new Date("2026-11-20T02:01:00.000Z"));
		expect(processed).toBe(true);
		expect(managerQuery).toHaveBeenCalledWith(
			expect.stringContaining("daily_count = GREATEST(daily_count - 1, 0)"),
			["host-a", "2026-11-20"]
		);
	});
});
