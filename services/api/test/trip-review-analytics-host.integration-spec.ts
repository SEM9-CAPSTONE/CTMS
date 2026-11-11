import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { UploadsService } from "../src/modules/uploads/uploads.service";
import { User, UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("CTMS-387 Host Review Intelligence & Analytics Dashboards (real PostgreSQL)", () => {
	let app: INestApplication;
	let db: DataSource;
	let jwt: JwtService;

	let hostA: User;
	let hostB: User;
	const routeId1 = randomUUID();
	const routeId2 = randomUUID();
	const tripId1 = randomUUID();
	const tripId2 = randomUUID();
	const userIds: string[] = [];
	const bookingIds: string[] = [];

	beforeAll(async () => {
		const module = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(UploadsService)
			.useValue(new UploadsService(new ConfigService({ API_PUBLIC_URL: "http://localhost:3000" })))
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

		hostA = await createAccount(UserRole.HOST);
		hostB = await createAccount(UserRole.HOST);

		// Route 1 (owned by hostA)
		await db.query(
			`INSERT INTO trekking_routes (id, host_id, name, route_geom, length_meters, difficulty, expected_duration_minutes, status)
			 VALUES ($1, $2, 'Analytics Fansipan Trail', ST_GeogFromText('LINESTRING(108.22 16.04, 108.25 16.07)'), 4200, 'hard', 360, 'active')`,
			[routeId1, hostA.id]
		);

		// Route 2 (owned by hostA)
		await db.query(
			`INSERT INTO trekking_routes (id, host_id, name, route_geom, length_meters, difficulty, expected_duration_minutes, status)
			 VALUES ($1, $2, 'Analytics Bach Ma Trail', ST_GeogFromText('LINESTRING(107.85 16.18, 107.88 16.20)'), 3000, 'moderate', 180, 'active')`,
			[routeId2, hostA.id]
		);

		// Trip 1 (on Route 1)
		await db.query(
			`INSERT INTO trips (id, host_id, route_id, title, trip_type, duration_nights, starts_at, ends_at, meeting_point, booking_deadline, capacity_min, capacity_max, seats_taken, price_per_person, status)
			 VALUES ($1, $2, $3, 'Fansipan Summit Adventure', 'overnight', 2, now() - interval '5 days', now() - interval '2 days', ST_GeogFromText('POINT(108.22 16.04)'), now() - interval '6 days', 1, 20, 10, 2000000, 'completed')`,
			[tripId1, hostA.id, routeId1]
		);

		// Trip 2 (on Route 2)
		await db.query(
			`INSERT INTO trips (id, host_id, route_id, title, trip_type, duration_nights, starts_at, ends_at, meeting_point, booking_deadline, capacity_min, capacity_max, seats_taken, price_per_person, status)
			 VALUES ($1, $2, $3, 'Bach Ma Day Trek', 'day_trip', 0, now() - interval '3 days', now() - interval '2 days', ST_GeogFromText('POINT(107.85 16.18)'), now() - interval '4 days', 1, 15, 3, 500000, 'completed')`,
			[tripId2, hostA.id, routeId2]
		);
	}, 60000);

	afterAll(async () => {
		if (!db?.isInitialized) return;

		try {
			await db.query("DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])", [userIds]);

			if (bookingIds.length) {
				await db.query(
					"DELETE FROM content_reports WHERE target_id IN (SELECT id FROM trip_reviews WHERE booking_id = ANY($1::uuid[]))",
					[bookingIds]
				);
				await db.query(
					"DELETE FROM trip_review_aspect_sentiments WHERE review_id IN (SELECT id FROM trip_reviews WHERE booking_id = ANY($1::uuid[]))",
					[bookingIds]
				);
				await db.query(
					"DELETE FROM trip_review_incident_signals WHERE review_id IN (SELECT id FROM trip_reviews WHERE booking_id = ANY($1::uuid[]))",
					[bookingIds]
				);
				await db.query(
					"DELETE FROM trip_review_moderation_runs WHERE review_id IN (SELECT id FROM trip_reviews WHERE booking_id = ANY($1::uuid[]))",
					[bookingIds]
				);
				await db.query(
					"DELETE FROM trip_review_revisions WHERE review_id IN (SELECT id FROM trip_reviews WHERE booking_id = ANY($1::uuid[]))",
					[bookingIds]
				);
				await db.query("DELETE FROM trip_reviews WHERE booking_id = ANY($1::uuid[])", [bookingIds]);
				await db.query("DELETE FROM booking_members WHERE booking_id = ANY($1::uuid[])", [
					bookingIds,
				]);
				await db.query("DELETE FROM bookings WHERE id = ANY($1::uuid[])", [bookingIds]);
			}

			await db.query("DELETE FROM trips WHERE id IN ($1, $2)", [tripId1, tripId2]);
			await db.query("DELETE FROM trekking_routes WHERE id IN ($1, $2)", [routeId1, routeId2]);

			if (userIds.length) {
				await db.query("DELETE FROM user_roles WHERE user_id = ANY($1)", [userIds]);
				await db.query("DELETE FROM users WHERE id = ANY($1)", [userIds]);
			}
		} finally {
			await app.close();
		}
	});

	async function createAccount(role: UserRole): Promise<User> {
		const user = await db.getRepository(User).save(
			db.getRepository(User).create({
				email: `analytics-${randomUUID()}@example.test`,
				passwordHash: "unused-test-hash",
				role,
				status: UserStatus.ACTIVE,
			})
		);
		userIds.push(user.id);
		await db.query("INSERT INTO user_roles (user_id, role) VALUES ($1, $2)", [user.id, role]);
		return user;
	}

	async function createReviewWithRun(options: {
		tripId: string;
		hostId: string;
		target?: "trip" | "host";
		moderationStatus?: "visible" | "hidden";
		rating?: number;
		comment?: string;
		aspects?: Array<{
			aspect: "safety" | "guide_support" | "equipment" | "value";
			sentiment: "positive" | "neutral" | "negative";
		}>;
		incidents?: Array<{
			type: "fall_slip" | "injury" | "lost_path" | "weather_hazard" | "other";
			occurred: "yes" | "warning" | "unknown";
			severity: "minor" | "moderate" | "severe" | "unknown";
			quote: string;
		}>;
		hasReport?: boolean;
	}): Promise<string> {
		const camper = await createAccount(UserRole.CAMPER);
		const bId = randomUUID();
		const mId = randomUUID();
		const rId = randomUUID();
		const runId = randomUUID();

		await db.query(
			`INSERT INTO bookings (id, trip_id, user_id, num_people, status, payment_status, completed_at)
			 VALUES ($1, $2, $3, 1, 'completed', 'not_required', now() - interval '2 days')`,
			[bId, options.tripId, camper.id]
		);
		bookingIds.push(bId);

		await db.query(
			`INSERT INTO booking_members (id, booking_id, user_id, is_primary, member_status, checked_in_at)
			 VALUES ($1, $2, $3, true, 'joined', now() - interval '3 days')`,
			[mId, bId, camper.id]
		);

		const target = options.target ?? "trip";
		const targetId = target === "trip" ? options.tripId : options.hostId;
		const moderationStatus = options.moderationStatus ?? "visible";

		await db.query(
			`INSERT INTO trip_reviews (id, booking_id, member_id, reviewer_id, trip_id, host_id, target, target_id, rating, revision, comment, moderation_status, image_storage_state)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $10, $11, 'live')`,
			[
				rId,
				bId,
				mId,
				camper.id,
				options.tripId,
				options.hostId,
				target,
				targetId,
				options.rating ?? 4,
				options.comment ?? "Đánh giá tuyệt vời",
				moderationStatus,
			]
		);

		await db.query(
			`INSERT INTO trip_review_revisions (review_id, revision, rating, comment, images)
			 VALUES ($1, 1, $2, $3, '[]'::jsonb)`,
			[rId, options.rating ?? 4, options.comment ?? "Đánh giá tuyệt vời"]
		);

		await db.query(
			`INSERT INTO trip_review_moderation_runs (id, review_id, source_revision, provider, model, config_version, prompt_version, text_scan_status, image_scan_status, aspects_status, incidents_status, completed_at)
			 VALUES ($1, $2, 1, 'gemini', 'gemini-3.1-flash-lite', 'gemini-v1', 'v1', 'completed', 'not_applicable', 'completed', 'completed', clock_timestamp())`,
			[runId, rId]
		);

		if (options.aspects && options.aspects.length > 0) {
			for (const asp of options.aspects) {
				await db.query(
					`INSERT INTO trip_review_aspect_sentiments (id, run_id, review_id, source_revision, aspect, sentiment, confidence)
					 VALUES ($1, $2, $3, 1, $4, $5, 0.95)`,
					[randomUUID(), runId, rId, asp.aspect, asp.sentiment]
				);
			}
		}

		if (options.incidents && options.incidents.length > 0) {
			for (const inc of options.incidents) {
				await db.query(
					`INSERT INTO trip_review_incident_signals (id, run_id, review_id, source_revision, incident_type, occurred, severity, quote)
					 VALUES ($1, $2, $3, 1, $4, $5, $6, $7)`,
					[randomUUID(), runId, rId, inc.type, inc.occurred, inc.severity, inc.quote]
				);
			}
		}

		if (options.hasReport) {
			await db.query(
				`INSERT INTO content_reports (id, reporter_id, target_type, target_id, reason, status, created_at)
				 VALUES ($1, $2, 'trip_review', $3, 'spam_or_irrelevant', 'pending', now())`,
				[randomUUID(), camper.id, rId]
			);
		}

		return rId;
	}

	const auth = (user: User) => `Bearer ${jwt.sign({ sub: user.id, roles: [user.role] })}`;

	describe("GET /api/host/review-analytics/trips-overview", () => {
		beforeAll(async () => {
			// Trip 1: Create 5 eligible reviews (>= 5 threshold -> hasSufficientSample = true)
			for (let i = 0; i < 4; i++) {
				await createReviewWithRun({
					tripId: tripId1,
					hostId: hostA.id,
					aspects: [
						{ aspect: "safety", sentiment: "positive" },
						{ aspect: "guide_support", sentiment: "positive" },
					],
				});
			}

			// 5th review on Trip 1 has negative safety
			await createReviewWithRun({
				tripId: tripId1,
				hostId: hostA.id,
				aspects: [
					{ aspect: "safety", sentiment: "negative" },
					{ aspect: "guide_support", sentiment: "positive" },
				],
			});

			// 6th review on Trip 1 has report pending (must be excluded from analytics)
			await createReviewWithRun({
				tripId: tripId1,
				hostId: hostA.id,
				hasReport: true,
			});

			// 7th review on Trip 1 has target = 'host' (must be strictly excluded!)
			await createReviewWithRun({
				tripId: tripId1,
				hostId: hostA.id,
				target: "host",
				aspects: [{ aspect: "guide_support", sentiment: "positive" }],
			});

			// 8th review on Trip 1 is hidden (must be strictly excluded!)
			await createReviewWithRun({
				tripId: tripId1,
				hostId: hostA.id,
				moderationStatus: "hidden",
			});

			// Trip 2: Create only 2 eligible reviews (< 5 threshold -> hasSufficientSample = false)
			for (let i = 0; i < 2; i++) {
				await createReviewWithRun({
					tripId: tripId2,
					hostId: hostA.id,
					aspects: [{ aspect: "safety", sentiment: "positive" }],
				});
			}
		});

		it("isolates data: Host B sees 0 trips for Host A", async () => {
			const res = await request(app.getHttpServer())
				.get("/api/host/review-analytics/trips-overview")
				.set("Authorization", auth(hostB))
				.expect(200);

			expect(res.body.total).toBe(0);
			expect(res.body.items).toEqual([]);
		});

		it("filters by tripId parameter", async () => {
			const res = await request(app.getHttpServer())
				.get("/api/host/review-analytics/trips-overview")
				.query({ tripId: tripId1 })
				.set("Authorization", auth(hostA))
				.expect(200);

			expect(res.body.total).toBe(1);
			expect(res.body.items[0].tripId).toBe(tripId1);
		});

		it("correctly calculates sample threshold, aspect counts, and netScore for Trip 1 (>= 5)", async () => {
			const res = await request(app.getHttpServer())
				.get("/api/host/review-analytics/trips-overview")
				.query({ tripId: tripId1 })
				.set("Authorization", auth(hostA))
				.expect(200);

			const item = res.body.items[0];
			expect(item.tripTitle).toBe("Fansipan Summit Adventure");
			// Total eligible reviews: exactly 5 (excludes host target, hidden review, and reported review)
			expect(item.totalReviews).toBe(5);
			expect(item.hasSufficientSample).toBe(true);
			// Reported review counted in excluded count
			expect(item.reportedReviewsExcludedCount).toBe(1);
			expect(item.coverageRate).toBe(1);

			// Safety: 4 positive, 1 negative (total 5) -> netScore = (4 / 5) * 100 = 80
			expect(item.aspects.safety.positive).toBe(4);
			expect(item.aspects.safety.negative).toBe(1);
			expect(item.aspects.safety.netScore).toBe(80);

			// Guide support: 5 positive, 0 negative -> netScore = 100
			expect(item.aspects.guide_support.positive).toBe(5);
			expect(item.aspects.guide_support.negative).toBe(0);
			expect(item.aspects.guide_support.netScore).toBe(100);
		});

		it("deactivates netScore (null) when sample size is below threshold (< 5) for Trip 2", async () => {
			const res = await request(app.getHttpServer())
				.get("/api/host/review-analytics/trips-overview")
				.query({ tripId: tripId2 })
				.set("Authorization", auth(hostA))
				.expect(200);

			const item = res.body.items[0];
			expect(item.tripTitle).toBe("Bach Ma Day Trek");
			expect(item.totalReviews).toBe(2);
			expect(item.hasSufficientSample).toBe(false);
			expect(item.aspects.safety.positive).toBe(2);
			// Under threshold -> netScore MUST be null
			expect(item.aspects.safety.netScore).toBeNull();
		});
	});

	describe("GET /api/host/review-analytics/routes-safety-overview", () => {
		beforeAll(async () => {
			// Seed incident signals on Route 1
			// Review 1 on Route 1 has BOTH fall_slip AND injury (tests COUNT(DISTINCT review_id) invariant)
			await createReviewWithRun({
				tripId: tripId1,
				hostId: hostA.id,
				incidents: [
					{
						type: "fall_slip",
						occurred: "yes",
						severity: "minor",
						quote: "Trượt chân dốc đá",
					},
					{
						type: "injury",
						occurred: "yes",
						severity: "moderate",
						quote: "Trầy xước chảy máu",
					},
				],
			});

			// Review 2 on Route 1 has weather warning (occurred = 'warning')
			await createReviewWithRun({
				tripId: tripId1,
				hostId: hostA.id,
				incidents: [
					{
						type: "weather_hazard",
						occurred: "warning",
						severity: "unknown",
						quote: "Cần đề phòng mưa to",
					},
				],
			});

			// Review 3 on Route 1 has lost_path ambiguous (occurred = 'unknown')
			await createReviewWithRun({
				tripId: tripId1,
				hostId: hostA.id,
				incidents: [
					{
						type: "lost_path",
						occurred: "unknown",
						severity: "unknown",
						quote: "Lối mòn hơi khó tìm",
					},
				],
			});
		});

		it("enforces distinct review counting, separates occurred vs warning, and sets safety assertions", async () => {
			const res = await request(app.getHttpServer())
				.get("/api/host/review-analytics/routes-safety-overview")
				.query({ routeId: routeId1 })
				.set("Authorization", auth(hostA))
				.expect(200);

			expect(res.body.sampleThreshold).toBe(10);
			expect(res.body.categoryCountsCannotBeSummed).toBe(true);
			expect(res.body.notSafetyHotspots).toBe(true);

			const route = res.body.items[0];
			expect(route.routeName).toBe("Analytics Fansipan Trail");
			// Total reviews on Route 1 is under 10 threshold
			expect(route.hasSufficientSample).toBe(false);

			// Review 1 had both fall_slip and injury, so distinct incident reviews count is 1!
			expect(route.totalDistinctReviewsWithIncidents).toBe(1);
			// Review 2 had warning
			expect(route.totalDistinctReviewsWithWarnings).toBe(1);

			// Verify fall_slip signal
			const fallSlip = route.incidentSignals.find(
				(s: { category: string }) => s.category === "fall_slip"
			);
			expect(fallSlip.occurredCount).toBe(1);
			expect(fallSlip.warningCount).toBe(0);
			expect(fallSlip.severityBreakdown.minor).toBe(1);
			expect(fallSlip.sampleQuotes).toContain("Trượt chân dốc đá");

			// Verify injury signal
			const injury = route.incidentSignals.find(
				(s: { category: string }) => s.category === "injury"
			);
			expect(injury.occurredCount).toBe(1);
			expect(injury.warningCount).toBe(0);
			expect(injury.severityBreakdown.moderate).toBe(1);
			expect(injury.sampleQuotes).toContain("Trầy xước chảy máu");

			// Verify weather_hazard signal (occurred = 'warning')
			const weather = route.incidentSignals.find(
				(s: { category: string }) => s.category === "weather_hazard"
			);
			expect(weather.occurredCount).toBe(0);
			expect(weather.warningCount).toBe(1);
			expect(weather.sampleQuotes).toContain("Cần đề phòng mưa to");

			// Verify lost_path signal (occurred = 'unknown')
			const lostPath = route.incidentSignals.find(
				(s: { category: string }) => s.category === "lost_path"
			);
			expect(lostPath.occurredCount).toBe(0);
			expect(lostPath.unknownCount).toBe(1);
		});
	});
});
