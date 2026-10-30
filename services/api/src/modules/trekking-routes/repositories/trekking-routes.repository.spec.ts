import type { EntityManager } from "typeorm";
import { RouteReviewOutcome } from "../dto/list-route-reviews-query.dto";
import {
	TrekkingRoute,
	TrekkingRouteDifficulty,
	TrekkingRouteStatus,
} from "../entities/trekking-route.entity";
import { TrekkingRoutesRepository } from "./trekking-routes.repository";

describe("TrekkingRoutesRepository", () => {
	it.each(Object.values(RouteReviewOutcome))(
		"filters Admin review outcomes by %s with stable pagination",
		async (reviewOutcome) => {
			const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
			const query = jest
				.spyOn(repository, "query")
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([{ total: "0" }]);

			await expect(repository.findAdminReviews(reviewOutcome, 2, 10)).resolves.toEqual({
				items: [],
				total: 0,
			});
			expect(query.mock.calls[0][1]).toEqual([reviewOutcome, 10, 10]);
			expect(query.mock.calls[0][0]).toContain('route."id" ASC');
			expect(query.mock.calls[0][0]).toContain("trekking_route.approved");
			expect(query.mock.calls[0][0]).toContain("returned_for_revision");
			expect(query.mock.calls[0][0]).toContain(`route."status" = 'draft'`);
			expect(query.mock.calls[0][0]).toContain("trekking_route.submitted_for_approval");
		}
	);

	it("resolves one latest Route outcome without inferring from ambiguous lifecycle statuses", async () => {
		const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
		const query = jest
			.spyOn(repository, "query")
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ total: "0" }]);

		await repository.findAdminReviews(RouteReviewOutcome.ALL, 1, 20);
		const sql = query.mock.calls[0][0] as string;
		const pendingRule = sql.indexOf(`route."status" = 'pending_approval'`);
		const approvedRule = sql.indexOf(`latest_review."action" = 'trekking_route.approved'`);

		expect(pendingRule).toBeGreaterThan(-1);
		expect(pendingRule).toBeLessThan(approvedRule);
		expect(sql).toContain(`route."status" = 'draft'`);
		expect(sql).toContain(`latest_review."action" = 'trekking_route.declined'`);
		expect(sql).toContain("trekking_route.submitted_for_approval");
		expect(sql).toContain('ORDER BY audit."created_at" DESC, audit."id" DESC');
		expect(sql).toContain("LIMIT 1");
		expect(sql).not.toContain(`route."status" = 'active' THEN 'approved'`);
		expect(sql).not.toContain(`route."status" = 'closed' THEN 'approved'`);
	});
	it("loads one authoritative Route by id without a lifecycle lock", async () => {
		const rejectedAt = new Date("2026-08-24T01:00:00.000Z");
		const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
		const query = jest.spyOn(repository, "query").mockResolvedValue([
			{
				id: "route-id",
				hostId: "host-id",
				name: "Ridge Trail",
				description: null,
				geometry: {
					type: "LineString",
					coordinates: [
						[108.441, 11.941],
						[108.449, 11.946],
					],
				},
				lengthMeters: "1024.5",
				difficulty: TrekkingRouteDifficulty.HARD,
				expectedDurationMinutes: "90",
				status: TrekkingRouteStatus.DRAFT,
				latestRejectionReason: "Clarify the finish checkpoint",
				latestRejectionAt: rejectedAt,
				createdAt: new Date("2026-08-24T00:00:00.000Z"),
				updatedAt: new Date("2026-08-24T00:00:00.000Z"),
			},
		]);

		await expect(repository.findRouteById("route-id")).resolves.toEqual(
			expect.objectContaining({
				id: "route-id",
				hostId: "host-id",
				lengthMeters: 1024.5,
				expectedDurationMinutes: 90,
				latestRejectionReason: "Clarify the finish checkpoint",
				latestRejectionAt: rejectedAt,
			})
		);
		expect(query).toHaveBeenCalledWith(expect.not.stringContaining("FOR UPDATE"), ["route-id"]);
		expect(query.mock.calls[0][0]).toContain("LEFT JOIN LATERAL");
		expect(query.mock.calls[0][0]).toContain("trekking_route.declined");
		expect(query.mock.calls[0][0]).toContain('ORDER BY audit."created_at" DESC, audit."id" DESC');
		expect(query.mock.calls[0][0]).toContain(`route."status" = 'draft'`);
	});

	it("returns null when a Route detail does not exist", async () => {
		const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
		jest.spyOn(repository, "query").mockResolvedValue([]);

		await expect(repository.findRouteById("missing-route")).resolves.toBeNull();
	});

	it("rejects an invalid draft update without mutating legacy checkpoints", async () => {
		const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
		const query = jest.spyOn(repository, "query").mockResolvedValue([]);
		await expect(
			repository.updateDraft("route-id", {
				hostId: "host-id",
				name: "Ridge",
				description: null,
				difficulty: TrekkingRouteDifficulty.EASY,
				geometry: {
					type: "LineString",
					coordinates: [
						[108, 16],
						[108.1, 16.1],
					],
				},
				expectedDurationMinutes: 30,
			})
		).rejects.toMatchObject({ status: 422 });
		expect(query).toHaveBeenCalledTimes(1);
	});
	it("locks and maps the authoritative route for a lifecycle transition", async () => {
		const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
		const query = jest.spyOn(repository, "query").mockResolvedValue([
			{
				id: "route-id",
				hostId: "host-id",
				name: "Ridge Trail",
				description: null,
				geometry: {
					type: "LineString",
					coordinates: [
						[108.441, 11.941],
						[108.449, 11.946],
					],
				},
				lengthMeters: "1024.5",
				difficulty: TrekkingRouteDifficulty.HARD,
				expectedDurationMinutes: "90",
				status: TrekkingRouteStatus.ACTIVE,
				createdAt: new Date("2026-08-24T00:00:00.000Z"),
				updatedAt: new Date("2026-08-24T00:00:00.000Z"),
				integrityValid: true,
			},
		]);

		const locked = await repository.findOneForLifecycleUpdate("route-id");

		expect(query.mock.calls[0][0]).toContain("FOR UPDATE OF route");
		expect(query.mock.calls[0][0]).toContain("ST_IsValid");
		expect(query).toHaveBeenCalledWith(expect.any(String), ["route-id"]);
		expect(locked).toEqual({
			hostId: "host-id",
			integrityValid: true,
			route: expect.objectContaining({
				id: "route-id",
				lengthMeters: 1024.5,
				expectedDurationMinutes: 90,
				status: TrekkingRouteStatus.ACTIVE,
			}),
		});
	});

	it("returns null when the lifecycle route does not exist", async () => {
		const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
		jest.spyOn(repository, "query").mockResolvedValue([]);

		await expect(repository.findOneForLifecycleUpdate("missing-route")).resolves.toBeNull();
	});

	it("lists only pending review Routes with ordered checkpoint context", async () => {
		const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
		const query = jest.spyOn(repository, "query").mockResolvedValue([
			{
				id: "route-id",
				name: "Ridge Trail",
				description: null,
				geometry: {
					type: "LineString",
					coordinates: [
						[108, 11],
						[108.1, 11.1],
					],
				},
				lengthMeters: "100",
				difficulty: TrekkingRouteDifficulty.EASY,
				expectedDurationMinutes: "60",
				status: TrekkingRouteStatus.PENDING_APPROVAL,
				createdAt: new Date(),
				updatedAt: new Date(),
				checkpoints: [],
				dangerZones: [],
			},
		]);

		const routes = await repository.findPendingReview();

		expect(query.mock.calls[0][0]).toContain('route."status" = $1');
		expect(query.mock.calls[0][0]).toContain('ORDER BY checkpoint."route_position"');
		expect(query.mock.calls[0][0]).toContain('FROM "route_danger_zones" danger_zone');
		expect(query.mock.calls[0][1]).toEqual([TrekkingRouteStatus.PENDING_APPROVAL]);
		expect(routes[0]).toEqual(expect.objectContaining({ checkpoints: [], dangerZones: [] }));
	});

	it("locks the selected Route before review", async () => {
		const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
		const query = jest.spyOn(repository, "query").mockResolvedValue([]);

		await expect(repository.findReviewRouteByIdForUpdate("route-id")).resolves.toBeNull();
		expect(query.mock.calls[0][0]).toContain("FOR UPDATE OF route");
	});

	it("validates authoritative route geometry and difficulty without waypoint requirements", async () => {
		const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
		const query = jest.spyOn(repository, "query").mockResolvedValue([
			{
				geometryValid: true,
				difficultyValid: true,
			},
		]);

		await expect(repository.validateApprovalIntegrity("route-id")).resolves.toEqual({
			geometryValid: true,
			difficultyValid: true,
		});
		expect(query.mock.calls[0][0]).toContain("ST_NPoints");
		expect(query.mock.calls[0][0]).not.toContain('FROM "checkpoints"');
		expect(query.mock.calls[0][0]).not.toContain('checkpoint."radius_m"');
		expect(query.mock.calls[0][0]).not.toContain("checkpoint_type = 'start'");
	});

	it.each([TrekkingRouteStatus.ACTIVE, TrekkingRouteStatus.CLOSED])(
		"updates only the server-selected status to %s and returns authoritative geometry",
		async (status) => {
			const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
			const query = jest.spyOn(repository, "query").mockResolvedValue([
				{
					id: "route-id",
					hostId: "host-id",
					name: "Ridge Trail",
					description: null,
					geometry: {
						type: "LineString",
						coordinates: [
							[108, 11],
							[108.1, 11.1],
						],
					},
					lengthMeters: "100",
					difficulty: TrekkingRouteDifficulty.EASY,
					expectedDurationMinutes: "60",
					status,
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			]);

			const route = await repository.updateStatus("route-id", status);

			expect(query).toHaveBeenCalledWith(expect.stringContaining('SET "status" = $2'), [
				"route-id",
				status,
			]);
			expect(route.status).toBe(status);
		}
	);

	it("lists Host routes with GeoJSON geometry and numeric values", async () => {
		const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
		const query = jest.spyOn(repository, "query").mockResolvedValue([
			{
				id: "route-id",
				hostId: "host-id",
				name: "Ridge Trail",
				description: null,
				geometry: {
					type: "LineString",
					coordinates: [
						[108.441, 11.941],
						[108.449, 11.946],
					],
				},
				lengthMeters: "1024.5",
				difficulty: TrekkingRouteDifficulty.HARD,
				expectedDurationMinutes: "90",
				status: TrekkingRouteStatus.DRAFT,
				createdAt: new Date("2026-08-24T00:00:00.000Z"),
				updatedAt: new Date("2026-08-24T00:00:00.000Z"),
			},
		]);

		const routes = await repository.findByHost("host-id");

		expect(query).toHaveBeenCalledWith(
			expect.stringContaining('ST_AsGeoJSON(route."route_geom"::geometry)'),
			["host-id"]
		);
		expect(query.mock.calls[0][0]).toContain('WHERE route."host_id" = $1');
		expect(routes[0]).toEqual(
			expect.objectContaining({
				geometry: {
					type: "LineString",
					coordinates: [
						[108.441, 11.941],
						[108.449, 11.946],
					],
				},
				lengthMeters: 1024.5,
				expectedDurationMinutes: 90,
			})
		);
	});

	it("paginates only the Host's routes with stable ordering and a scoped total", async () => {
		const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
		const query = jest
			.spyOn(repository, "query")
			.mockResolvedValueOnce([
				{
					id: "route-id",
					hostId: "host-id",
					name: "Ridge Trail",
					description: null,
					geometry: {
						type: "LineString",
						coordinates: [
							[108.441, 11.941],
							[108.449, 11.946],
						],
					},
					lengthMeters: "1024.5",
					difficulty: TrekkingRouteDifficulty.HARD,
					expectedDurationMinutes: "90",
					status: TrekkingRouteStatus.DRAFT,
					createdAt: new Date("2026-08-24T00:00:00.000Z"),
					updatedAt: new Date("2026-08-24T00:00:00.000Z"),
					total: "41",
				},
			])
			.mockResolvedValueOnce([{ all: 41, draft: 41, pending_approval: 0, active: 0, closed: 0 }]);

		const result = await repository.findByHostPaginated(
			"host-id",
			3,
			20,
			TrekkingRouteStatus.DRAFT
		);

		expect(query).toHaveBeenNthCalledWith(
			1,
			expect.stringContaining('WHERE route."host_id" = $1'),
			["host-id", TrekkingRouteStatus.DRAFT, 20, 40, ""]
		);
		expect(query.mock.calls[0][0]).toContain('route."status" = $2::trekking_route_status');
		expect(query.mock.calls[0][0]).toContain('ORDER BY route."created_at" DESC, route."id" ASC');
		expect(query.mock.calls[0][0]).toContain("LIMIT $3 OFFSET $4");
		expect(query.mock.calls[1][0]).toContain("COUNT(*) FILTER");
		expect(query).toHaveBeenCalledTimes(2);
		expect(result).toEqual({
			items: [expect.objectContaining({ id: "route-id", lengthMeters: 1024.5 })],
			total: 41,
			statusCounts: { all: 41, draft: 41, pending_approval: 0, active: 0, closed: 0 },
		});
	});

	it("returns an accurate total for an empty page", async () => {
		const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
		const query = jest
			.spyOn(repository, "query")
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ all: 7, active: 7 }]);

		await expect(repository.findByHostPaginated("host-id", 4, 3, null)).resolves.toEqual({
			items: [],
			total: 7,
			statusCounts: { all: 7, draft: 0, pending_approval: 0, active: 7, closed: 0 },
		});
		expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining("host_id=$1"), [
			"host-id",
			"",
		]);
	});

	it("returns an accurate total for an empty page with a status filter", async () => {
		const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
		const query = jest
			.spyOn(repository, "query")
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ all: 0 }]);

		await expect(
			repository.findByHostPaginated("host-id", 1, 20, TrekkingRouteStatus.CLOSED)
		).resolves.toEqual({
			items: [],
			total: 0,
			statusCounts: { all: 0, draft: 0, pending_approval: 0, active: 0, closed: 0 },
		});
		expect(query).toHaveBeenNthCalledWith(
			1,
			expect.stringContaining('WHERE route."host_id" = $1'),
			["host-id", TrekkingRouteStatus.CLOSED, 20, 0, ""]
		);
		expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining("host_id=$1"), [
			"host-id",
			"",
		]);
	});

	it("uses PostGIS ST_Length and maps the authoritative database row", async () => {
		const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
		const query = jest.spyOn(repository, "query").mockResolvedValue([
			{
				id: "route-id",
				hostId: "host-id",
				name: "Ridge Trail",
				description: null,
				geometry: {
					type: "LineString",
					coordinates: [
						[108.441, 11.941],
						[108.449, 11.946],
					],
				},
				lengthMeters: "1024.5",
				difficulty: TrekkingRouteDifficulty.HARD,
				expectedDurationMinutes: "90",
				status: TrekkingRouteStatus.DRAFT,
				createdAt: new Date("2026-08-24T00:00:00.000Z"),
				updatedAt: new Date("2026-08-24T00:00:00.000Z"),
			},
		]);

		const route = await repository.createDraft({
			hostId: "host-id",
			name: "Ridge Trail",
			description: null,
			geometry: {
				type: "LineString",
				coordinates: [
					[108.441, 11.941],
					[108.449, 11.946],
				],
			},
			difficulty: TrekkingRouteDifficulty.HARD,
			expectedDurationMinutes: 90,
		});

		expect(query.mock.calls[0][0]).toContain("ST_Length(route_geom)");
		expect(route.lengthMeters).toBe(1024.5);
		expect(route.expectedDurationMinutes).toBe(90);
		expect(route.status).toBe(TrekkingRouteStatus.DRAFT);
	});

	it("returns 422 when PostGIS calculates zero length", async () => {
		const repository = new TrekkingRoutesRepository(TrekkingRoute, {} as EntityManager);
		jest.spyOn(repository, "query").mockResolvedValue([]);

		await expect(
			repository.createDraft({
				hostId: "host-id",
				name: "Zero route",
				description: null,
				geometry: {
					type: "LineString",
					coordinates: [
						[108, 11],
						[108, 11],
					],
				},
				difficulty: TrekkingRouteDifficulty.EASY,
				expectedDurationMinutes: 30,
			})
		).rejects.toMatchObject({ status: 422 });
	});
});
