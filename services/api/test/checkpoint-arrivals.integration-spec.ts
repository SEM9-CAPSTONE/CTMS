import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigModule, type ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AuthModule } from "../src/modules/auth/auth.module";
import type { CheckpointArrivalInputDto } from "../src/modules/checkpoint-arrivals/checkpoint-arrivals.dto";
import { CheckpointArrivalsModule } from "../src/modules/checkpoint-arrivals/checkpoint-arrivals.module";
import { CheckpointArrivalsRepository } from "../src/modules/checkpoint-arrivals/checkpoint-arrivals.repository";
import { CheckpointArrivalsService } from "../src/modules/checkpoint-arrivals/checkpoint-arrivals.service";
import type { CheckpointArrivalContext } from "../src/modules/checkpoint-arrivals/checkpoint-arrivals.types";
import { DEMO_OFFLINE_BUFFER_TRIP_ID, seedCheckpointArrivalContexts } from "../src/seeds/main.seed";
import { DatabaseModule } from "../src/shared/database/database.module";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("CTMS-313 automatic checkpoint arrivals (real PostgreSQL)", () => {
	let app: INestApplication;
	let db: DataSource;
	let repository: CheckpointArrivalsRepository;
	let token: string;
	let outsiderToken: string;
	let porterToken: string;
	const userId = randomUUID();
	const outsiderId = randomUUID();
	const porterId = randomUUID();
	const routeId = randomUUID();
	const tripId = randomUUID();
	const checkpointId = randomUUID();
	const otherCheckpointId = randomUUID();
	const bookingId = randomUUID();
	const memberId = randomUUID();
	const context: CheckpointArrivalContext = {
		tripId,
		routeId,
		routeVersion: "route-v1",
		packageId: randomUUID(),
		packageVersion: "package-v1",
		checkpoints: [
			{ id: checkpointId, latitude: 16.04, longitude: 108.22 },
			{ id: otherCheckpointId, latitude: 16.04, longitude: 108.22 },
		],
	};
	const capturedAt = Date.now() - 60_000;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [
				ConfigModule.forRoot({ isGlobal: true }),
				DatabaseModule,
				AuthModule,
				CheckpointArrivalsModule,
			],
		}).compile();
		app = moduleRef.createNestApplication();
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
		db = moduleRef.get(DataSource);
		await assertSafeTestDatabase(db);
		await db.query(
			"ALTER TABLE checkpoint_arrival_contexts ADD COLUMN IF NOT EXISTS context_source varchar(32) NOT NULL DEFAULT 'authoritative'"
		);
		repository = moduleRef.get(CheckpointArrivalsRepository);
		const jwt = new JwtService({ secret: process.env.JWT_SECRET });
		for (const [id, role] of [
			[userId, "camper"],
			[outsiderId, "camper"],
			[porterId, "porter"],
		]) {
			await db.query(
				`INSERT INTO users (id,email,password_hash,role,status,full_name)
			 VALUES ($1,$2,'test-only',$3,'active','Checkpoint test')`,
				[id, `${id}@example.test`, role]
			);
			await db.query("INSERT INTO user_roles (user_id,role) VALUES ($1,$2)", [id, role]);
		}
		token = jwt.sign({ sub: userId, roles: ["camper"] });
		outsiderToken = jwt.sign({ sub: outsiderId, roles: ["camper"] });
		porterToken = jwt.sign({ sub: porterId, roles: ["porter"] });
		await db.query(
			`INSERT INTO trekking_routes (id,host_id,name,route_geom,length_meters,difficulty,
		 expected_duration_minutes,status) VALUES ($1,$2,'Arrival Route',
		 ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22,16.04),ST_MakePoint(108.25,16.07)),4326)::geography,
		 3500,'moderate',240,'active')`,
			[routeId, userId]
		);
		for (const id of [checkpointId, otherCheckpointId]) {
			await db.query(
				`INSERT INTO checkpoints (id,route_id,name,location,radius_m,type,
			 expected_arrival_offset,instructions,nearby_water_or_shelter,route_position)
			 VALUES ($1,$2,'Route rest checkpoint',ST_SetSRID(ST_MakePoint(108.22,16.04),4326)::geography,
			 50,'rest',0,'Rest',false,0)`,
				[id, routeId]
			);
		}
		await db.query(
			`INSERT INTO trips (id,host_id,route_id,title,trip_type,duration_nights,
		 starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,seats_taken,price_per_person,status)
		 VALUES ($1,$2,$3,'Checkpoint Trip','day_trip',0,now()-interval '1 hour',now()+interval '1 hour',
		 ST_SetSRID(ST_MakePoint(108.22,16.04),4326)::geography,now()-interval '1 day',1,20,1,0,'ongoing')`,
			[tripId, userId, routeId]
		);
		await db.query(
			`INSERT INTO bookings (id,trip_id,user_id,num_people,status,payment_status,
		 trip_starts_at_snapshot,trip_ends_at_snapshot,base_price,total_amount)
		 VALUES ($1,$2,$3,1,'confirmed','not_required',now()-interval '1 hour',now()+interval '1 hour',0,0)`,
			[bookingId, tripId, userId]
		);
		await db.query(
			`INSERT INTO booking_members (id,booking_id,user_id,is_primary,member_status,checked_in_at)
		 VALUES ($1,$2,$3,true,'joined',now()-interval '1 hour')`,
			[memberId, bookingId, userId]
		);
		await db.query(
			"INSERT INTO trip_porters (trip_id,porter_id,status) VALUES ($1,$2,'assigned')",
			[tripId, porterId]
		);
	}, 60_000);

	afterAll(async () => {
		if (db?.isInitialized) {
			await db.query("DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])", [
				[userId, outsiderId, porterId],
			]);
			await db.query(
				"DELETE FROM automatic_checkpoint_visits WHERE trip_id IN (SELECT id FROM trips WHERE route_id=$1)",
				[routeId]
			);
			await db.query(
				"DELETE FROM checkpoint_arrival_contexts WHERE trip_id IN (SELECT id FROM trips WHERE route_id=$1) OR trip_id = $2",
				[routeId, DEMO_OFFLINE_BUFFER_TRIP_ID]
			);
			await db.query(
				"DELETE FROM bookings WHERE trip_id IN (SELECT id FROM trips WHERE route_id=$1)",
				[routeId]
			);
			await db.query(
				"DELETE FROM trip_porters WHERE trip_id IN (SELECT id FROM trips WHERE route_id=$1)",
				[routeId]
			);
			await db.query("DELETE FROM trips WHERE route_id=$1 OR id = $2", [
				routeId,
				DEMO_OFFLINE_BUFFER_TRIP_ID,
			]);
			await db.query("DELETE FROM checkpoints WHERE route_id=$1", [routeId]);
			await db.query("DELETE FROM trekking_routes WHERE id=$1", [routeId]);
			await db.query("DELETE FROM user_roles WHERE user_id=ANY($1::uuid[])", [
				[userId, outsiderId, porterId],
			]);
			await db.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [
				[userId, outsiderId, porterId],
			]);
		}
		await app?.close();
	});

	function event(overrides: Partial<CheckpointArrivalInputDto> = {}): CheckpointArrivalInputDto {
		return {
			id: randomUUID(),
			checkpointId,
			routeId,
			routeVersion: context.routeVersion,
			packageId: context.packageId,
			packageVersion: context.packageVersion,
			detectedOffline: true,
			samples: [0, 1, 2].map((n) => ({
				eventTime: new Date(capturedAt + n * 1000).toISOString(),
				latitude: 16.04,
				longitude: 108.22,
				accuracyMeters: 5,
			})),
			...overrides,
		};
	}
	function post(arrivals: unknown[], accessToken = token) {
		return request(app.getHttpServer())
			.post(`/api/trips/${tripId}/automatic-checkpoint-arrivals`)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ arrivals });
	}

	it("fails closed without authoritative package context", async () => {
		await post([event()]).expect(409);
	});
	it("registers trusted package checkpoints once and refuses replacement or invented coordinates", async () => {
		await expect(
			repository.registerActivePackage({
				...context,
				checkpoints: [{ ...context.checkpoints[0], latitude: 0 }],
			})
		).rejects.toThrow();
		await repository.registerActivePackage(context);
		await repository.registerActivePackage({
			...context,
			checkpoints: [...context.checkpoints].reverse(),
		});
		await expect(
			repository.registerActivePackage({ ...context, packageVersion: "v2" })
		).rejects.toThrow();
	});
	it("rejects unauthenticated/foreign participants and malformed input", async () => {
		await request(app.getHttpServer())
			.post(`/api/trips/${tripId}/automatic-checkpoint-arrivals`)
			.send({ arrivals: [event()] })
			.expect(401);
		await post([event()], outsiderToken).expect(403);
		await post([{ ...event(), memberId }]).expect(422);
		await post([{ ...event(), samples: event().samples.slice(0, 2) }]).expect(422);
	});
	it("checks package, Route, checkpoint and actual distance with partial acceptance", async () => {
		const far = event();
		far.samples[1].latitude += 0.001;
		const response = await post([
			event({ packageVersion: "wrong" }),
			event({ routeId: randomUUID() }),
			event({ checkpointId: randomUUID() }),
			far,
		]).expect(200);
		expect(response.body.results.map((r: { reason: string }) => r.reason)).toEqual([
			"context_mismatch",
			"context_mismatch",
			"checkpoint_not_in_package",
			"threshold_not_met",
		]);
	});
	it("concurrent replay produces one immutable visit and one audit; changed UUID still cannot duplicate the visit", async () => {
		const input = event();
		const responses = await Promise.all([post([input]), post([input])]);
		expect(responses.map((r) => r.body.results[0].status).sort()).toEqual([
			"accepted",
			"duplicate",
		]);
		const duplicate = await post([{ ...input, id: randomUUID() }]).expect(200);
		expect(duplicate.body.results[0]).toMatchObject({ status: "duplicate", visitId: input.id });
		const changed = await post([{ ...input, detectedOffline: false }]).expect(200);
		expect(changed.body.results[0]).toMatchObject({ status: "rejected", reason: "id_conflict" });
		const rows = await db.query(
			"SELECT *, ST_X(location::geometry) AS longitude FROM automatic_checkpoint_visits WHERE id=$1",
			[input.id]
		);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			package_id: context.packageId,
			package_version: context.packageVersion,
			event_type: "CHECKPOINT_REACHED",
			detected_offline: true,
			longitude: 108.22,
		});
		expect(rows[0].event_time.toISOString()).toBe(input.samples[2].eventTime);
		const audit = await db.query("SELECT after FROM audit_logs WHERE target_id=$1", [input.id]);
		expect(audit).toHaveLength(1);
		expect(audit[0].after).not.toHaveProperty("samples");
	});
	it("records an assigned Porter's own visit without marking all Camper members reached", async () => {
		const response = await post([event()], porterToken).expect(200);
		expect(response.body.results[0].status).toBe("accepted");
		const manual = await db.query("SELECT id FROM checkpoint_visits WHERE trip_id=$1", [tripId]);
		expect(manual).toHaveLength(0);
	});

	it("rejects a UUID owned by another participant without leaking its acknowledgement", async () => {
		const input = event({ checkpointId: otherCheckpointId });
		await post([input], porterToken).expect(200);
		const response = await post([input]).expect(200);
		expect(response.body.results[0]).toMatchObject({
			status: "rejected",
			reason: "id_conflict",
			visitId: null,
			receivedAt: null,
		});
	});

	it("does not accept new arrival evidence on a published or cancelled Trip", async () => {
		for (const status of ["published", "cancelled"]) {
			await db.query("UPDATE trips SET status=$2 WHERE id=$1", [tripId, status]);
			const response = await post([event({ checkpointId: otherCheckpointId })]).expect(200);
			expect(response.body.results[0]).toMatchObject({
				status: "rejected",
				reason: "trip_not_trackable",
			});
		}
		await db.query("UPDATE trips SET status='ongoing' WHERE id=$1", [tripId]);
	});

	it("uses frozen package checkpoint coordinates after a live Route checkpoint edit", async () => {
		await db.query(
			"UPDATE checkpoints SET location=ST_SetSRID(ST_MakePoint(0,0),4326)::geography WHERE id=$1",
			[otherCheckpointId]
		);
		const response = await post([event({ checkpointId: otherCheckpointId })]).expect(200);
		expect(response.body.results[0].status).toBe("accepted");
		// Reset this participant's test visit to exercise late sync independently in the next test.
		const visitId = response.body.results[0].visitId as string;
		await db.query("DELETE FROM audit_logs WHERE target_id=$1", [visitId]);
		await db.query("DELETE FROM automatic_checkpoint_visits WHERE id=$1", [visitId]);
	});
	it("accepts historical arrival after completion, but rejects future or pre-check-in samples", async () => {
		await db.query("UPDATE trips SET status='completed' WHERE id=$1", [tripId]);
		const input = event({ checkpointId: otherCheckpointId });
		const future = event({ checkpointId: otherCheckpointId });
		future.samples = future.samples.map((sample, n) => ({
			...sample,
			eventTime: new Date(Date.now() + 60_000 + n * 1000).toISOString(),
		}));
		const before = event({ checkpointId: otherCheckpointId });
		before.samples = before.samples.map((sample, n) => ({
			...sample,
			eventTime: new Date(Date.now() - 7_200_000 + n * 1000).toISOString(),
		}));
		const response = await post([future, before, input]).expect(200);
		expect(response.body.results.map((r: { status: string }) => r.status)).toEqual([
			"rejected",
			"rejected",
			"accepted",
		]);
	});
	it("rejects sync when completed trip exceeds 7-day grace period", async () => {
		await db.query(
			"UPDATE trips SET status='completed', starts_at=now() - interval '10 days', booking_deadline=now() - interval '11 days', ends_at=now() - interval '8 days' WHERE id=$1",
			[tripId]
		);
		const response = await post([event({ checkpointId: otherCheckpointId })]).expect(200);
		expect(response.body.results[0]).toMatchObject({
			status: "rejected",
			reason: "trip_completed_window_expired",
			retryable: false,
		});
		await db.query(
			"UPDATE trips SET status='ongoing', starts_at=now() - interval '1 hour', booking_deadline=now() - interval '1 day', ends_at=now() + interval '1 hour' WHERE id=$1",
			[tripId]
		);
	});

	it("enforces first-write-wins when a new UUID is uploaded for an already visited checkpoint", async () => {
		await db.query(
			"DELETE FROM automatic_checkpoint_visits WHERE trip_id=$1 AND user_id=$2 AND checkpoint_id=$3",
			[tripId, userId, otherCheckpointId]
		);
		const first = event({ checkpointId: otherCheckpointId });
		const firstRes = await post([first]).expect(200);
		expect(firstRes.body.results[0].status).toBe("accepted");
		const firstVisitId = firstRes.body.results[0].visitId;

		const second = event({ id: randomUUID(), checkpointId: otherCheckpointId });
		const secondRes = await post([second]).expect(200);
		expect(secondRes.body.results[0]).toMatchObject({
			status: "duplicate",
			visitId: firstVisitId,
			clientId: second.id,
			retryable: false,
		});
	});

	it("isolates unexpected database errors on individual records using savepoints, returning retryable processing_error while other batch records commit", async () => {
		await db.query("DELETE FROM automatic_checkpoint_visits WHERE trip_id=$1 AND user_id=$2", [
			tripId,
			userId,
		]);

		const valid1 = event({ id: randomUUID(), checkpointId });
		const errorRecord = event({ id: randomUUID(), checkpointId: otherCheckpointId });

		const originalInsert = repository.insertVisit.bind(repository);
		const spy = jest
			.spyOn(repository, "insertVisit")
			.mockImplementation(async (mgr, ev, tId, uId, fp) => {
				if (ev.id === errorRecord.id) {
					throw new Error("simulated pool timeout or deadlock");
				}
				return originalInsert(mgr, ev, tId, uId, fp);
			});

		try {
			const response = await post([valid1, errorRecord]).expect(200);
			expect(
				response.body.results.map(
					(r: { status: string; reason: string | null; retryable: boolean }) => [
						r.status,
						r.reason,
						r.retryable,
					]
				)
			).toEqual([
				["accepted", null, false],
				["rejected", "processing_error", true],
			]);

			const saved = await db.query(
				"SELECT id FROM automatic_checkpoint_visits WHERE id = ANY($1::uuid[])",
				[[valid1.id, errorRecord.id]]
			);
			expect(saved.map((s: { id: string }) => s.id)).toEqual([valid1.id]);
		} finally {
			spy.mockRestore();
		}
	});

	it("isolates non-retryable database errors on individual records, returning terminal processing_error (retryable: false) while other batch records commit", async () => {
		await db.query("DELETE FROM automatic_checkpoint_visits WHERE trip_id=$1 AND user_id=$2", [
			tripId,
			userId,
		]);

		const valid1 = event({ id: randomUUID(), checkpointId });
		const failRecord = event({ id: randomUUID(), checkpointId: otherCheckpointId });
		const valid2 = event({ id: randomUUID(), checkpointId });

		const originalInsert = repository.insertVisit.bind(repository);
		const spy = jest
			.spyOn(repository, "insertVisit")
			.mockImplementation(async (mgr, ev, tId, uId, fp) => {
				if (ev.id === failRecord.id) {
					const fkError = new Error("foreign key constraint violation") as Error & { code: string };
					fkError.code = "23503";
					throw fkError;
				}
				return originalInsert(mgr, ev, tId, uId, fp);
			});

		try {
			const response = await post([valid1, failRecord, valid2]).expect(200);
			expect(
				response.body.results.map(
					(r: { status: string; reason: string | null; retryable: boolean }) => [
						r.status,
						r.reason,
						r.retryable,
					]
				)
			).toEqual([
				["accepted", null, false],
				["rejected", "processing_error", false],
				["duplicate", null, false],
			]);

			const saved = await db.query(
				"SELECT id FROM automatic_checkpoint_visits WHERE id = ANY($1::uuid[])",
				[[valid1.id, failRecord.id]]
			);
			expect(saved.map((s: { id: string }) => s.id)).toEqual([valid1.id]);
		} finally {
			spy.mockRestore();
		}
	});

	it("rolls back visit within record savepoint if audit log insert fails, without rolling back other batch records", async () => {
		await db.query("DELETE FROM automatic_checkpoint_visits WHERE trip_id=$1 AND user_id=$2", [
			tripId,
			userId,
		]);

		const failRecord = event({ id: randomUUID(), checkpointId });
		const validRecord = event({ id: randomUUID(), checkpointId: otherCheckpointId });

		const originalAudit = repository.insertAuditLog.bind(repository);
		const spy = jest
			.spyOn(repository, "insertAuditLog")
			.mockImplementation(async (mgr, uId, ev, tId) => {
				if (ev.id === failRecord.id) {
					throw new Error("simulated audit insert failure");
				}
				return originalAudit(mgr, uId, ev, tId);
			});

		try {
			const response = await post([failRecord, validRecord]).expect(200);
			expect(
				response.body.results.map(
					(r: { status: string; reason: string | null; retryable: boolean }) => [
						r.status,
						r.reason,
						r.retryable,
					]
				)
			).toEqual([
				["rejected", "processing_error", false],
				["accepted", null, false],
			]);

			const visits = await db.query(
				"SELECT id FROM automatic_checkpoint_visits WHERE id = ANY($1::uuid[])",
				[[failRecord.id, validRecord.id]]
			);
			expect(visits.map((v: { id: string }) => v.id)).toEqual([validRecord.id]);

			const audits = await db.query(
				"SELECT target_id FROM audit_logs WHERE target_id = ANY($1::uuid[])",
				[[failRecord.id, validRecord.id]]
			);
			expect(audits.map((a: { target_id: string }) => a.target_id)).toEqual([validRecord.id]);
		} finally {
			spy.mockRestore();
		}
	});

	describe("fallback context behaviors", () => {
		const fbTripId = randomUUID();
		const fbBookingId = randomUUID();
		const fbMemberId = randomUUID();

		beforeAll(async () => {
			await db.query(
				`INSERT INTO trips (id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,seats_taken,price_per_person,status)
				 VALUES ($1,$2,$3,'Fallback Trip','day_trip',0,now()-interval '1 hour',now()+interval '1 hour',
				 ST_SetSRID(ST_MakePoint(108.22,16.04),4326)::geography,now()-interval '1 day',1,20,1,0,'ongoing')`,
				[fbTripId, userId, routeId]
			);
			await db.query(
				`INSERT INTO bookings (id,trip_id,user_id,num_people,status,payment_status,trip_starts_at_snapshot,trip_ends_at_snapshot,base_price,total_amount)
				 VALUES ($1,$2,$3,1,'confirmed','not_required',now()-interval '1 hour',now()+interval '1 hour',0,0)`,
				[fbBookingId, fbTripId, userId]
			);
			await db.query(
				`INSERT INTO booking_members (id,booking_id,user_id,is_primary,member_status,checked_in_at)
				 VALUES ($1,$2,$3,true,'joined',now()-interval '1 hour')`,
				[fbMemberId, fbBookingId, userId]
			);
		});

		afterAll(async () => {
			await db.query("DELETE FROM automatic_checkpoint_visits WHERE trip_id=$1", [fbTripId]);
			await db.query("DELETE FROM checkpoint_arrival_contexts WHERE trip_id=$1", [fbTripId]);
			await db.query("DELETE FROM bookings WHERE id=$1", [fbBookingId]);
			await db.query("DELETE FROM trips WHERE id=$1", [fbTripId]);
		});

		it("fails with 409 Conflict when active package context is absent and fallback flag is disabled", async () => {
			const fbEvent = {
				...event({ checkpointId }),
				routeVersion: "v1",
				packageId: fbTripId,
				packageVersion: "v1-dev",
			};
			await request(app.getHttpServer())
				.post(`/api/trips/${fbTripId}/automatic-checkpoint-arrivals`)
				.set("Authorization", `Bearer ${token}`)
				.send({ arrivals: [fbEvent] })
				.expect(409);
		});

		it("provisions fallback context from Route/checkpoints PostGIS when ALLOW_CHECKPOINT_ARRIVAL_FALLBACK is enabled in non-prod", async () => {
			const fbEvent = {
				...event({ checkpointId }),
				routeVersion: "v1",
				packageId: fbTripId,
				packageVersion: "v1-dev",
			};
			process.env.ALLOW_CHECKPOINT_ARRIVAL_FALLBACK = "true";
			try {
				const successRes = await request(app.getHttpServer())
					.post(`/api/trips/${fbTripId}/automatic-checkpoint-arrivals`)
					.set("Authorization", `Bearer ${token}`)
					.send({ arrivals: [fbEvent] })
					.expect(200);
				expect(successRes.body.results[0].status).toBe("accepted");

				const fbContext = await db.query(
					"SELECT context_source FROM checkpoint_arrival_contexts WHERE trip_id = $1",
					[fbTripId]
				);
				expect(fbContext).toHaveLength(1);
				expect(fbContext[0].context_source).toBe("fallback");
			} finally {
				// biome-ignore lint/performance/noDelete: test environment variable cleanup
				delete process.env.ALLOW_CHECKPOINT_ARRIVAL_FALLBACK;
			}
		});

		it("never overwrites an existing authoritative package context with a fallback context", async () => {
			const authContext = await db.query(
				"SELECT context_source FROM checkpoint_arrival_contexts WHERE trip_id = $1",
				[tripId]
			);
			expect(authContext[0].context_source).toBe("authoritative");

			const ctx = await repository.findOrCreateFallbackContext(db.manager, tripId);
			expect(ctx?.contextSource).toBe("authoritative");
		});

		it("throws an error at startup if ALLOW_CHECKPOINT_ARRIVAL_FALLBACK is enabled in production", () => {
			const mockConfigService = {
				get: (key: string) => {
					if (key === "NODE_ENV") return "production";
					if (key === "ALLOW_CHECKPOINT_ARRIVAL_FALLBACK") return "true";
					return undefined;
				},
			} as unknown as ConfigService;
			expect(
				() => new CheckpointArrivalsService({} as CheckpointArrivalsRepository, mockConfigService)
			).toThrow("ALLOW_CHECKPOINT_ARRIVAL_FALLBACK is strictly forbidden in production");
		});
	});

	it("verifies seedCheckpointArrivalContexts executes and provisions demo trip", async () => {
		await db.query(
			`INSERT INTO trips (id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,seats_taken,price_per_person,status)
			 VALUES ($1,$2,$3,'Demo Trip','day_trip',0,now()-interval '1 hour',now()+interval '1 hour',
			 ST_SetSRID(ST_MakePoint(108.22,16.04),4326)::geography,now()-interval '1 day',1,20,1,0,'ongoing')
			 ON CONFLICT (id) DO UPDATE SET route_id = EXCLUDED.route_id`,
			[DEMO_OFFLINE_BUFFER_TRIP_ID, userId, routeId]
		);

		await seedCheckpointArrivalContexts(db);

		const demoContext = await db.query(
			"SELECT trip_id, context_source FROM checkpoint_arrival_contexts WHERE trip_id = $1",
			[DEMO_OFFLINE_BUFFER_TRIP_ID]
		);
		expect(demoContext).toHaveLength(1);
		expect(demoContext[0].context_source).toBe("demo");

		await db.query("DELETE FROM checkpoint_arrival_contexts WHERE trip_id = $1", [
			DEMO_OFFLINE_BUFFER_TRIP_ID,
		]);
		await db.query("DELETE FROM trips WHERE id = $1", [DEMO_OFFLINE_BUFFER_TRIP_ID]);
	});
});
