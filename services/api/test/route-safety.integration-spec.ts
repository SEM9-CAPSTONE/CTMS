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
	const publishedZone = randomUUID();
	const publishedHotspot = randomUUID();
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
		await db.query(
			`INSERT INTO route_danger_zones(id,route_id,geom,radius_m,description,severity)
		 VALUES($1,$2,ST_SetSRID(ST_Point(105,20),4326)::geography,50,'Lối mòn sát mép vực, đi theo cọc tiêu đỏ.','high')`,
			[publishedZone, route]
		);
		await db.query(
			`INSERT INTO potential_safety_hotspots(id,route_id,route_version,status,status_changed_at,
		 analysis_version,config_version,criteria,window_start,window_end,center,radius_meters,anchor_event_id,
		 route_fraction_min,route_fraction_max,event_count,distinct_trip_count,distinct_member_count,evidence_event_ids,
		 evidence_hash,first_event_at,last_event_at,detected_at)
		 VALUES($1,$2,'route-version','CONFIRMED','2026-11-10T12:00:00Z','analysis','config','{}',
		 '2026-11-01','2026-11-10',ST_SetSRID(ST_Point(105,20),4326)::geography,50,$3,0,1,1,1,1,ARRAY[$3::uuid],$4,
		 '2026-11-02','2026-11-02','2026-11-10')`,
			[publishedHotspot, route, randomUUID(), "a".repeat(64)]
		);
		await db.query(
			`INSERT INTO hotspot_corrective_actions(hotspot_id,route_id,action_type,target_type,target_id,reason,
		 "after",hotspot_status_changed_at,hotspot_evidence_hash,hotspot_route_version,package_impact,actor_id)
		 SELECT $1,z.route_id,'ADD_HAZARD_AREA','trekking_route_danger_zone',z.id,'Vách đá sạt sau mưa, cần cảnh báo người đi bộ.',
		 jsonb_build_object('geometry',ST_AsGeoJSON(z.geom::geometry)::jsonb,'radiusMeters',z.radius_m,'description',z.description,'severity',z.severity),
		 '2026-11-10T12:00:00Z',$3,'route-version','NOT_AFFECTED',$4 FROM route_danger_zones z WHERE z.id=$2`,
			[publishedHotspot, publishedZone, "a".repeat(64), admin]
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
			await db.query("DELETE FROM hotspot_corrective_actions WHERE hotspot_id=$1", [
				publishedHotspot,
			]);
			await db.query("DELETE FROM potential_safety_hotspots WHERE id=$1", [publishedHotspot]);
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
	const publishedBounds = { west: 104.9, south: 19.9, east: 105.1, north: 20.1 };
	const readPublished = (user = other, role = "host", bounds = publishedBounds) =>
		request(app.getHttpServer())
			.get("/api/route-safety/verified-zones")
			.set("Authorization", `Bearer ${token(user, role)}`)
			.query(bounds);
	it("automatically exposes approved safety facts across Hosts and roles without a route or trip", async () => {
		for (const role of ["host", "admin", "camper", "porter"]) {
			const response = await readPublished(other, role).expect(200);
			expect(response.headers["cache-control"]).toBe("private, no-store");
			expect(response.body.features).toHaveLength(1);
			const feature = response.body.features[0];
			expect(feature.id).toBe(`host:${publishedZone}`);
			expect(feature.properties).toMatchObject({
				sourceType: "ADMIN_VERIFIED",
				verificationStatus: "VERIFIED",
				routeName: null,
				radiusMeters: 50,
				labelPoint: { type: "Point", coordinates: [105, 20] },
			});
			expect(JSON.stringify(feature)).not.toMatch(/actor_id|evidence_hash|Vách đá sạt|Safety test/);
		}
		expect(
			(
				await readPublished(other, "host", { west: 106, south: 21, east: 107, north: 22 }).expect(
					200
				)
			).body.features
		).toEqual([]);
	});
	it("requires authentication and validates every viewport bound", async () => {
		await request(app.getHttpServer())
			.get("/api/route-safety/verified-zones")
			.query(publishedBounds)
			.expect(401);
		await readPublished(other, "host", { ...publishedBounds, west: 106 }).expect(422);
		await readPublished(other, "host", { ...publishedBounds, north: 91 }).expect(422);
		await request(app.getHttpServer())
			.get("/api/route-safety/verified-zones")
			.set("Authorization", `Bearer ${token(other)}`)
			.query({ west: "invalid" })
			.expect(422);
	});
	it("withdraws unconfirmed, changed evidence and edits that were not published by Admin", async () => {
		try {
			for (const status of ["DETECTED", "UNDER_REVIEW", "DISMISSED"]) {
				await db.query("UPDATE potential_safety_hotspots SET status=$1 WHERE id=$2", [
					status,
					publishedHotspot,
				]);
				expect((await readPublished().expect(200)).body.features).toEqual([]);
			}
			await db.query(
				"UPDATE potential_safety_hotspots SET status='CONFIRMED',evidence_hash=$1 WHERE id=$2",
				["b".repeat(64), publishedHotspot]
			);
			expect((await readPublished().expect(200)).body.features).toEqual([]);
			await db.query("UPDATE potential_safety_hotspots SET evidence_hash=$1 WHERE id=$2", [
				"a".repeat(64),
				publishedHotspot,
			]);
			await db.query("UPDATE route_danger_zones SET radius_m=75 WHERE id=$1", [publishedZone]);
			expect((await readPublished().expect(200)).body.features).toEqual([]);
		} finally {
			await db.query(
				"UPDATE potential_safety_hotspots SET status='CONFIRMED',evidence_hash=$1 WHERE id=$2",
				["a".repeat(64), publishedHotspot]
			);
			await db.query("UPDATE route_danger_zones SET radius_m=50 WHERE id=$1", [publishedZone]);
		}
	});
	it("does not publish a confirmed candidate whose only decision is no data change", async () => {
		try {
			await db.query(
				"UPDATE hotspot_corrective_actions SET action_type='NO_DATA_CHANGE',target_type=NULL,target_id=NULL WHERE hotspot_id=$1",
				[publishedHotspot]
			);
			expect((await readPublished().expect(200)).body.features).toEqual([]);
		} finally {
			await db.query(
				"UPDATE hotspot_corrective_actions SET action_type='ADD_HAZARD_AREA',target_type='trekking_route_danger_zone',target_id=$2 WHERE hotspot_id=$1",
				[publishedHotspot, publishedZone]
			);
		}
	});
	it("includes the published zone once in analysis even for a different Host", async () => {
		for (const user of [host, other]) {
			const response = await request(app.getHttpServer())
				.post("/api/route-safety/analyze")
				.set("Authorization", `Bearer ${token(user)}`)
				.send({
					geometry: {
						type: "LineString",
						coordinates: [
							[104.999, 20],
							[105.001, 20],
						],
					},
				})
				.expect(201);
			const matches = response.body.features.features.filter(
				(feature: { id: string }) => feature.id === `host:${publishedZone}`
			);
			expect(matches).toHaveLength(1);
			expect(matches[0].properties.sourceType).toBe("ADMIN_VERIFIED");
		}
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
	it.each([false, true])(
		"reads nearby zones across own routes for saved=%s without changing source data",
		async (saved) => {
			const ownOrigin = randomUUID();
			const privateOrigin = randomUUID();
			const origins = [ownOrigin, privateOrigin];
			const nearPoint = randomUUID();
			const radiusOverlap = randomUUID();
			const nearPolygon = randomUUID();
			const farPoint = randomUUID();
			const farPolygon = randomUUID();
			const privatePoint = randomUUID();
			try {
				for (const [id, owner, name] of [
					[ownOrigin, host, "Đường rừng ven suối"],
					[privateOrigin, other, "Lối mòn phía tây"],
				]) {
					await db.query(
						`INSERT INTO trekking_routes(id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status)
				 VALUES($1,$2,$3,ST_GeomFromGeoJSON($4)::geography,1100,'easy',60,'draft')`,
						[id, owner, name, JSON.stringify(line)]
					);
				}
				await db.query(
					`INSERT INTO route_danger_zones(id,route_id,geom,radius_m,description,severity) VALUES
			 ($1,$7,ST_GeogFromText('SRID=4326;POINT(108.005 12.001)'),30,'Lối mòn trơn trượt sau mưa','high'),
			 ($2,$7,ST_GeogFromText('SRID=4326;POINT(108.005 12.003)'),80,'Vành đai đá có nguy cơ rơi','medium'),
			 ($3,$7,ST_GeogFromText('SRID=4326;POLYGON((108.004 12.001,108.006 12.001,108.006 12.002,108.004 12.001))'),NULL,'Sườn dốc dễ sạt lở','high'),
			 ($4,$7,ST_GeogFromText('SRID=4326;POINT(109 13)'),30,'Đá lở ở đoạn đường phía bắc','high'),
			 ($5,$7,ST_GeogFromText('SRID=4326;POLYGON((109 13,109.01 13,109.01 13.01,109 13))'),NULL,'Khu vực đất yếu ven suối','high'),
			 ($6,$8,ST_GeogFromText('SRID=4326;POINT(108.005 12)'),30,'Đường dốc có nhiều đá vụn','high')`,
					[
						nearPoint,
						radiusOverlap,
						nearPolygon,
						farPoint,
						farPolygon,
						privatePoint,
						ownOrigin,
						privateOrigin,
					]
				);
				const snapshot = () =>
					db.query("SELECT * FROM route_danger_zones WHERE route_id=ANY($1::uuid[]) ORDER BY id", [
						origins,
					]);
				const before = await snapshot();
				const response = await request(app.getHttpServer())
					.post("/api/route-safety/analyze")
					.set("Authorization", `Bearer ${token(host)}`)
					.send({ geometry: line, ...(saved ? { routeId: route } : {}), source: "NCHMF" })
					.expect(201);
				const features = response.body.features.features as Array<{
					id: string;
					properties: {
						routeName: string;
						verificationStatus: string;
						distanceMeters: number;
						intersects: boolean;
					};
				}>;
				for (const id of [nearPoint, radiusOverlap, nearPolygon]) {
					expect(features.find((feature) => feature.id === `host:${id}`)?.properties).toMatchObject(
						{
							routeName: "Đường rừng ven suối",
							verificationStatus: "UNVERIFIED",
							intersects: false,
						}
					);
				}
				expect(
					features.find((feature) => feature.id === `host:${radiusOverlap}`)?.properties
						.distanceMeters
				).toBeGreaterThan(300);
				for (const id of [farPoint, farPolygon, privatePoint])
					expect(features.map((feature) => feature.id)).not.toContain(`host:${id}`);
				expect(await snapshot()).toEqual(before);
				const moved = await request(app.getHttpServer())
					.post("/api/route-safety/analyze")
					.set("Authorization", `Bearer ${token(host)}`)
					.send({
						geometry: {
							type: "LineString",
							coordinates: [
								[110, 14],
								[110.01, 14],
							],
						},
						source: "NCHMF",
					})
					.expect(201);
				expect(
					moved.body.features.features.filter(
						(feature: { properties: { sourceType: string } }) =>
							feature.properties.sourceType === "HOST_DEFINED"
					)
				).toEqual([]);
			} finally {
				await db.query("DELETE FROM route_danger_zones WHERE route_id=ANY($1::uuid[])", [origins]);
				await db.query("DELETE FROM trekking_routes WHERE id=ANY($1::uuid[])", [origins]);
			}
		}
	);
});
