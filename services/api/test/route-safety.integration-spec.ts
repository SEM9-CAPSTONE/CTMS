import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { NchmfSafetyService } from "../src/modules/route-safety/nchmf-safety.service";
import { OsmWaterService } from "../src/modules/route-safety/osm-water.service";
import type { SafetyCandidate } from "../src/modules/route-safety/route-safety.types";
import { parseSafetyInput } from "../src/modules/route-safety/safety-input";
import { VndmsSafetyService } from "../src/modules/route-safety/vndms-safety.service";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("Route Safety v2 PostGIS and authorization", () => {
	let app: INestApplication;
	let db: DataSource;
	let jwt: JwtService;
	const host = randomUUID();
	const other = randomUUID();
	const admin = randomUUID();
	const route = randomUUID();
	const source = `TEST_${randomUUID().replaceAll("-", "").toUpperCase()}`;
	const tripIds: string[] = [];
	let liveCandidates: SafetyCandidate[] = [];
	const liveProvider = {
		collect: jest.fn(async () => ({
			source: {
				source: "NCHMF",
				status: "LIVE",
				checkedAt: new Date().toISOString(),
				dataTime: null,
				validUntil: null,
			},
			candidates: liveCandidates,
		})),
	};
	const line = {
		type: "LineString",
		coordinates: [
			[108, 12],
			[108.01, 12],
		],
	};
	const token = (id: string, role = "host") => jwt.sign({ sub: id, roles: [role] });
	beforeAll(async () => {
		process.env.ROUTE_SAFETY_APPROVED_SOURCES = source;
		const module = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(NchmfSafetyService)
			.useValue(liveProvider)
			.overrideProvider(VndmsSafetyService)
			.useValue({
				collect: async () => ({ source: { source: "VNDMS", status: "EMPTY" }, candidates: [] }),
			})
			.overrideProvider(OsmWaterService)
			.useValue({
				collect: async () => ({ source: { source: "OSM", status: "EMPTY" }, candidates: [] }),
			})
			.compile();
		app = module.createNestApplication();
		app.setGlobalPrefix("api");
		app.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
				exceptionFactory: validationExceptionFactory,
			})
		);
		await app.init();
		db = module.get(DataSource);
		jwt = module.get(JwtService);
		await assertSafeTestDatabase(db);
		for (const [id, role] of [
			[host, "host"],
			[other, "host"],
			[admin, "admin"],
		]) {
			await db.query(
				`INSERT INTO users (id,email,password_hash,role,status,full_name) VALUES ($1,$2,'unused',$3,'active','Safety test')`,
				[id, `${id}@example.com`, role]
			);
			await db.query("INSERT INTO user_roles(user_id,role) VALUES ($1,$2)", [id, role]);
		}
		await db.query(
			`INSERT INTO trekking_routes (id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status)
		 VALUES ($1,$2,'Safety test',ST_GeomFromGeoJSON($3)::geography,1100,'easy',60,'draft')`,
			[route, host, JSON.stringify(line)]
		);
	}, 60000);
	afterAll(async () => {
		if (db) {
			await db.query("DELETE FROM trip_incidents WHERE trip_id=ANY($1::uuid[])", [tripIds]);
			await db.query("DELETE FROM trips WHERE id=ANY($1::uuid[])", [tripIds]);
			await db.query("DELETE FROM audit_logs WHERE actor_id=ANY($1::uuid[])", [
				[host, other, admin],
			]);
			await db.query("DELETE FROM safety_import_rejections WHERE source=$1", [source]);
			await db.query("DELETE FROM external_safety_features WHERE source=$1", [source]);
			await db.query("DELETE FROM route_danger_zones WHERE route_id=$1", [route]);
			await db.query("DELETE FROM trekking_routes WHERE id=$1", [route]);
			await db.query("DELETE FROM user_roles WHERE user_id=ANY($1::uuid[])", [
				[host, other, admin],
			]);
			await db.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [[host, other, admin]]);
		}
		await app?.close();
		process.env.ROUTE_SAFETY_APPROVED_SOURCES = undefined;
	});
	const imported = (id: string, geometry: unknown, patch: Record<string, unknown> = {}) => ({
		externalId: id,
		sourceType: "OFFICIAL_CURRENT",
		sourceReference: "approved-test-feed",
		hazardType: "landslide",
		severity: "HIGH",
		geometry,
		geometryRole: "administrative_warning_area",
		description: "Test warning",
		issuedAt: new Date().toISOString(),
		validUntil: new Date(Date.now() + 3600000).toISOString(),
		lifecycleStatus: "ACTIVE",
		verificationStatus: "SOURCE_PROVIDED",
		...patch,
	});
	it("authorizes Host only and checks saved route ownership", async () => {
		await request(app.getHttpServer())
			.post("/api/route-safety/analyze")
			.send({ geometry: line })
			.expect(401);
		await request(app.getHttpServer())
			.post("/api/route-safety/analyze")
			.set("Authorization", `Bearer ${token(admin, "admin")}`)
			.send({ geometry: line })
			.expect(403);
		await request(app.getHttpServer())
			.post("/api/route-safety/analyze")
			.set("Authorization", `Bearer ${token(other)}`)
			.send({ routeId: route, geometry: line })
			.expect(403);
		await request(app.getHttpServer())
			.post("/api/route-safety/analyze")
			.set("Authorization", `Bearer ${token(host)}`)
			.send({ geometry: { type: "Point", coordinates: [108, 12] } })
			.expect(422);
	});
	it("allows the preview to request each source independently", async () => {
		for (const selected of ["NCHMF", "VNDMS", "OSM"]) {
			const response = await request(app.getHttpServer())
				.post("/api/route-safety/analyze")
				.set("Authorization", `Bearer ${token(host)}`)
				.send({ geometry: line, source: selected })
				.expect(201);
			expect(response.body.sources).toHaveLength(1);
			expect(response.body.sources[0].source).toBe(selected);
		}
	});
	it("imports idempotently, quarantines malformed geometry, and computes exact spatial results", async () => {
		const features = [
			imported("polygon", {
				type: "Polygon",
				coordinates: [
					[
						[108.004, 11.999],
						[108.006, 11.999],
						[108.006, 12.001],
						[108.004, 12.001],
						[108.004, 11.999],
					],
				],
			}),
			imported("near", { type: "Point", coordinates: [108.005, 12.001] }),
			imported("multi", {
				type: "MultiPolygon",
				coordinates: [
					[
						[
							[108.007, 11.999],
							[108.008, 11.999],
							[108.008, 12.001],
							[108.007, 12.001],
							[108.007, 11.999],
						],
					],
				],
			}),
			imported("far", { type: "Point", coordinates: [109, 13] }),
			imported(
				"expired",
				{ type: "Point", coordinates: [108.005, 12] },
				{ validUntil: new Date(Date.now() - 1000).toISOString() }
			),
			imported("line", {
				type: "LineString",
				coordinates: [
					[108.005, 11.99],
					[108.005, 12.01],
				],
			}),
			imported(
				"historical",
				{ type: "Point", coordinates: [108.005, 12] },
				{
					sourceType: "BASE_HISTORICAL",
					observedAt: "2020-01-01T00:00:00Z",
					issuedAt: null,
					validUntil: null,
				}
			),
			imported("invalid", { type: "Point", coordinates: [500, 12] }),
		];
		const body = { source, permissionReference: "test-fixture-approved", features };
		await request(app.getHttpServer())
			.post("/api/route-safety/import")
			.set("Authorization", `Bearer ${token(host)}`)
			.send(body)
			.expect(403);
		const imports = await Promise.all(
			[0, 1].map(() =>
				request(app.getHttpServer())
					.post("/api/route-safety/import")
					.set("Authorization", `Bearer ${token(admin, "admin")}`)
					.send(body)
					.expect(201)
			)
		);
		for (const response of imports) {
			expect(response.body).toMatchObject({ accepted: 7, rejected: 1 });
		}
		const count = await db.query(
			"SELECT count(*)::int AS count FROM external_safety_features WHERE source=$1",
			[source]
		);
		expect(count[0].count).toBe(7);
		const older = await request(app.getHttpServer())
			.post("/api/route-safety/import")
			.set("Authorization", `Bearer ${token(admin, "admin")}`)
			.send({
				...body,
				features: [
					imported(
						"near",
						{ type: "Point", coordinates: [108.005, 12.001] },
						{
							severity: "LOW",
							issuedAt: "2000-01-01T00:00:00Z",
							observedAt: "2000-01-01T00:00:00Z",
						}
					),
				],
			})
			.expect(201);
		expect(older.body).toMatchObject({ accepted: 0, unchanged: 1 });
		liveCandidates = features.flatMap((feature) => {
			const record = parseSafetyInput(feature);
			return record?.sourceType === "OFFICIAL_CURRENT"
				? [
						{
							...record,
							id: `live:${record.externalId}`,
							source,
							fetchedAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
							distanceMeters: 0,
							intersects: false,
							radiusMeters: null,
						},
					]
				: [];
		});
		const response = await request(app.getHttpServer())
			.post("/api/route-safety/analyze")
			.set("Authorization", `Bearer ${token(host)}`)
			.send({ routeId: route, geometry: line })
			.expect(201);
		expect(response.body.summary.activeWarnings).toBe(4);
		expect(response.body.summary.historicalFeatures).toBe(1);
		expect(response.body.features.features).toHaveLength(6);
		expect(
			response.body.features.features.map(
				(f: { properties: { lifecycleStatus: string } }) => f.properties.lifecycleStatus
			)
		).toContain("EXPIRED");
		expect(response.body.riskLevel).toBe("HIGH");
	});
	it("does not present stored current warnings after the live source fails", async () => {
		liveProvider.collect.mockResolvedValueOnce({
			source: {
				source: "NCHMF",
				status: "UNAVAILABLE",
				checkedAt: new Date().toISOString(),
				dataTime: null,
				validUntil: null,
			},
			candidates: [],
		});
		const response = await request(app.getHttpServer())
			.post("/api/route-safety/analyze")
			.set("Authorization", `Bearer ${token(host)}`)
			.send({ routeId: route, geometry: line })
			.expect(201);
		expect(response.body.liveSource.status).toBe("UNAVAILABLE");
		expect(response.body.summary.activeWarnings).toBe(0);
		expect(response.body.summary.historicalFeatures).toBe(1);
		expect(response.body.riskLevel).toBe("UNKNOWN");
	});
	it("filters live event points and water by distance to the full route, not exact intersection", async () => {
		const make = (id: string, geometry: unknown, resource = false): SafetyCandidate => {
			const record = parseSafetyInput(
				imported(id, geometry, { sourceType: resource ? "RESOURCE" : "OFFICIAL_CURRENT" })
			);
			if (!record) throw new Error("Invalid test record");
			return {
				...record,
				id,
				source: resource ? "OSM" : "VNDMS",
				fetchedAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				distanceMeters: 0,
				intersects: false,
				radiusMeters: null,
			};
		};
		const before = liveCandidates;
		liveCandidates = [
			make("near-event", { type: "Point", coordinates: [108.005, 12.001] }),
			make("far-event", { type: "Point", coordinates: [108.005, 12.01] }),
			make("near-water", { type: "Point", coordinates: [108.005, 12.0015] }, true),
			make(
				"near-surface",
				{
					type: "Polygon",
					coordinates: [
						[
							[108.003, 12],
							[108.006, 12],
							[108.006, 12.001],
							[108.003, 12],
						],
					],
				},
				true
			),
			make(
				"near-stream",
				{
					type: "LineString",
					coordinates: [
						[108.002, 12.002],
						[108.008, 12.002],
					],
				},
				true
			),
		];
		try {
			const response = await request(app.getHttpServer())
				.post("/api/route-safety/analyze")
				.set("Authorization", `Bearer ${token(host)}`)
				.send({ geometry: line })
				.expect(201);
			const features = response.body.features.features as Array<{
				id: string;
				properties: { distanceMeters: number; intersects: boolean };
			}>;
			expect(features.map((f) => f.id)).toEqual(
				expect.arrayContaining(["near-event", "near-water", "near-stream"])
			);
			expect(features.map((f) => f.id)).not.toContain("far-event");
			expect(features.map((f) => f.id)).not.toContain("near-surface");
			expect(features.find((f) => f.id === "near-water")?.properties).toMatchObject({
				intersects: false,
			});
			expect(
				features.find((f) => f.id === "near-water")?.properties.distanceMeters
			).toBeGreaterThan(100);
		} finally {
			liveCandidates = before;
		}
	});
	it("keeps Host-defined zones in the unified response", async () => {
		await db.query(
			`INSERT INTO route_danger_zones(route_id,geom,radius_m,description,severity)
		 VALUES ($1,ST_GeomFromGeoJSON('{"type":"Point","coordinates":[108.005,12]}')::geography,30,'Host warning','medium')`,
			[route]
		);
		const response = await request(app.getHttpServer())
			.post("/api/route-safety/analyze")
			.set("Authorization", `Bearer ${token(host)}`)
			.send({ routeId: route, geometry: line })
			.expect(201);
		expect(response.body.summary.hostDefinedDangerZones).toBe(1);
	});
	it("only exposes positioned incidents on Trips belonging to the requesting Host", async () => {
		for (const owner of [host, other]) {
			const trip = randomUUID();
			tripIds.push(trip);
			await db.query(
				`INSERT INTO trips (id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,
			 meeting_point,booking_deadline,capacity_min,capacity_max,seats_taken,price_per_person,status)
			 VALUES ($1,$2,$3,'Safety Trip','day_trip',0,now(),now()+interval '8 hours',
			 ST_SetSRID(ST_MakePoint(108,12),4326)::geography,now()-interval '1 day',1,20,0,0,'ongoing')`,
				[trip, owner, route]
			);
			await db.query(
				`INSERT INTO trip_incidents(id,trip_id,reporter_id,category,severity,description,occurred_at,location,location_status,location_accuracy_meters,location_captured_at)
			 VALUES ($1,$2,$3,'route_obstruction','high','Trail blocked',now(),ST_SetSRID(ST_MakePoint(108.005,12),4326)::geography,'fresh',5,now())`,
				[randomUUID(), trip, admin]
			);
			await db.query(
				`INSERT INTO trip_incidents(id,trip_id,reporter_id,category,severity,description,occurred_at,location_status)
			 VALUES ($1,$2,$3,'route_obstruction','high','No position',now(),'unavailable')`,
				[randomUUID(), trip, admin]
			);
		}
		const response = await request(app.getHttpServer())
			.post("/api/route-safety/analyze")
			.set("Authorization", `Bearer ${token(host)}`)
			.send({ routeId: route, geometry: line })
			.expect(201);
		expect(response.body.summary.nearbyIncidents).toBe(1);
		const fields = response.body.features.features.filter(
			(f: { properties: { sourceType: string } }) => f.properties.sourceType === "FIELD_OBSERVATION"
		);
		expect(fields).toHaveLength(1);
		expect(fields[0].properties.verificationStatus).toBe("UNVERIFIED");
	});
});
