import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { ModerationDecisionAction } from "../src/modules/trip-review-moderation/dtos/create-moderation-decision.dto";
import { ModerationQueueStatusFilter } from "../src/modules/trip-review-moderation/dtos/get-host-moderation-queue-query.dto";
import { UploadsService } from "../src/modules/uploads/uploads.service";
import { User, UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { getUploadRoot } from "../src/shared/uploads/upload-paths";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("CTMS-387 Host Moderation & Quarantine (real PostgreSQL)", () => {
	let app: INestApplication;
	let db: DataSource;
	let jwt: JwtService;

	let hostA: User;
	let hostB: User;
	const routeId = randomUUID();
	const tripId = randomUUID();
	const userIds: string[] = [];
	const bookingIds: string[] = [];

	const testImageFilename = `test-host-mod-${randomUUID()}.jpg`;
	const uploadRoot = getUploadRoot();
	const liveImageDir = join(uploadRoot, "trip-reviews");
	const quarantineImageDir = join(uploadRoot, "quarantine", "trip-reviews");
	const liveImagePath = join(liveImageDir, testImageFilename);
	const quarantineImagePath = join(quarantineImageDir, testImageFilename);

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

		// Seed route and trip owned by hostA
		await db.query(
			`INSERT INTO trekking_routes (id, host_id, name, route_geom, length_meters, difficulty, expected_duration_minutes, status)
			 VALUES ($1, $2, 'Host Moderation Route', ST_GeogFromText('LINESTRING(108.22 16.04, 108.25 16.07)'), 3500, 'moderate', 240, 'active')`,
			[routeId, hostA.id]
		);

		await db.query(
			`INSERT INTO trips (id, host_id, route_id, title, trip_type, duration_nights, starts_at, ends_at, meeting_point, booking_deadline, capacity_min, capacity_max, seats_taken, price_per_person, status)
			 VALUES ($1, $2, $3, 'Host Moderation Trip', 'day_trip', 0, now() - interval '2 days', now() - interval '1 day', ST_GeogFromText('POINT(108.22 16.04)'), now() - interval '3 days', 1, 20, 1, 0, 'completed')`,
			[tripId, hostA.id, routeId]
		);

		// Create physical test image file for quarantine testing
		mkdirSync(liveImageDir, { recursive: true });
		mkdirSync(quarantineImageDir, { recursive: true });
		writeFileSync(liveImagePath, "dummy jpeg content for moderation integration test");
	}, 60000);

	afterAll(async () => {
		if (!db?.isInitialized) return;

		try {
			// Clean up physical test files
			try {
				if (existsSync(liveImagePath)) rmSync(liveImagePath, { force: true });
				if (existsSync(quarantineImagePath)) rmSync(quarantineImagePath, { force: true });
			} catch {
				// ignore
			}

			await db.query("DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])", [userIds]);

			if (bookingIds.length) {
				await db.query(
					"DELETE FROM content_reports WHERE target_id IN (SELECT id FROM trip_reviews WHERE booking_id = ANY($1::uuid[]))",
					[bookingIds]
				);
				await db.query(
					"DELETE FROM trip_review_moderation_decisions WHERE review_id IN (SELECT id FROM trip_reviews WHERE booking_id = ANY($1::uuid[]))",
					[bookingIds]
				);
				await db.query(
					"DELETE FROM trip_review_moderation_flags WHERE review_id IN (SELECT id FROM trip_reviews WHERE booking_id = ANY($1::uuid[]))",
					[bookingIds]
				);
				await db.query(
					"DELETE FROM trip_review_moderation_runs WHERE review_id IN (SELECT id FROM trip_reviews WHERE booking_id = ANY($1::uuid[]))",
					[bookingIds]
				);
				await db.query(
					"DELETE FROM trip_review_moderation_outbox WHERE review_id IN (SELECT id FROM trip_reviews WHERE booking_id = ANY($1::uuid[]))",
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

			await db.query("DELETE FROM trips WHERE id = $1", [tripId]);
			await db.query("DELETE FROM trekking_routes WHERE id = $1", [routeId]);

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
				email: `host-mod-${randomUUID()}@example.test`,
				passwordHash: "unused-test-hash",
				role,
				status: UserStatus.ACTIVE,
			})
		);
		userIds.push(user.id);
		await db.query("INSERT INTO user_roles (user_id, role) VALUES ($1, $2)", [user.id, role]);
		return user;
	}

	async function createParticipation(customCamper?: User): Promise<{
		bookingId: string;
		memberId: string;
		camper: User;
	}> {
		const camperUser = customCamper ?? (await createAccount(UserRole.CAMPER));
		const bId = randomUUID();
		const mId = randomUUID();

		await db.query(
			`INSERT INTO bookings (id, trip_id, user_id, num_people, status, payment_status, completed_at)
			 VALUES ($1, $2, $3, 1, 'completed', 'not_required', now() - interval '1 hour')`,
			[bId, tripId, camperUser.id]
		);

		await db.query(
			`INSERT INTO booking_members (id, booking_id, user_id, is_primary, member_status, checked_in_at)
			 VALUES ($1, $2, $3, true, 'joined', now() - interval '2 days')`,
			[mId, bId, camperUser.id]
		);

		bookingIds.push(bId);
		return { bookingId: bId, memberId: mId, camper: camperUser };
	}

	async function createRun(reviewId: string, revision = 1): Promise<string> {
		const runId = randomUUID();
		await db.query(
			`INSERT INTO trip_review_moderation_runs (id, review_id, source_revision, provider, model, config_version, prompt_version, text_scan_status, image_scan_status, aspects_status, incidents_status)
			 VALUES ($1, $2, $3, 'gemini', 'gemini-3.1-flash-lite', 'gemini-v1', 'v1', 'completed', 'completed', 'completed', 'completed')`,
			[runId, reviewId, revision]
		);
		return runId;
	}

	const auth = (user: User) => `Bearer ${jwt.sign({ sub: user.id, roles: [user.role] })}`;

	describe("Host Moderation Queue & Scoping", () => {
		const reviewId1 = randomUUID();
		const imageUrl = `/uploads/trip-reviews/${testImageFilename}`;
		let p: { bookingId: string; memberId: string; camper: User };

		beforeAll(async () => {
			p = await createParticipation();

			// Insert review with active flag for hostA's trip
			await db.query(
				`INSERT INTO trip_reviews (id, booking_id, member_id, reviewer_id, trip_id, host_id, target, target_id, rating, revision, comment, images, moderation_status, image_storage_state)
				 VALUES ($1, $2, $3, $4, $5, $6, 'trip', $5, 2, 1, 'Chuyến đi tệ, hướng dẫn viên bất cẩn', $7::jsonb, 'visible', 'live')`,
				[
					reviewId1,
					p.bookingId,
					p.memberId,
					p.camper.id,
					tripId,
					hostA.id,
					JSON.stringify([imageUrl]),
				]
			);

			await db.query(
				`INSERT INTO trip_review_revisions (review_id, revision, rating, comment, images)
				 VALUES ($1, 1, 2, 'Chuyến đi tệ, hướng dẫn viên bất cẩn', $2::jsonb)`,
				[reviewId1, JSON.stringify([imageUrl])]
			);

			const runId = await createRun(reviewId1, 1);

			// Add active violation flag
			await db.query(
				`INSERT INTO trip_review_moderation_flags (id, run_id, review_id, source_revision, flag_type, channel, detection_source, confidence, evidence, quote, lifecycle_status)
				 VALUES ($1, $2, $3, 1, 'profanity_or_insult', 'text', 'model', 0.92, 'Chứa từ ngữ công kích', 'bất cẩn', 'active')`,
				[randomUUID(), runId, reviewId1]
			);
		});

		it("allows Host A to see the flagged review in pending_review queue", async () => {
			const res = await request(app.getHttpServer())
				.get("/api/host/trip-reviews/moderation-queue")
				.query({ status: ModerationQueueStatusFilter.PENDING_REVIEW })
				.set("Authorization", auth(hostA))
				.expect(200);

			expect(res.body.total).toBeGreaterThanOrEqual(1);
			const found = res.body.items.find(
				(item: { reviewId: string }) => item.reviewId === reviewId1
			);
			expect(found).toBeDefined();
			expect(found.tripTitle).toBe("Host Moderation Trip");
			expect(found.activeFlags.length).toBe(1);
			expect(found.activeFlags[0].flagType).toBe("profanity_or_insult");
			expect(found.activeFlags[0].quote).toBe("bất cẩn");
		});

		it("isolates queue so Host B sees 0 items for Host A trips", async () => {
			const res = await request(app.getHttpServer())
				.get("/api/host/trip-reviews/moderation-queue")
				.set("Authorization", auth(hostB))
				.expect(200);

			expect(res.body.total).toBe(0);
			expect(res.body.items).toEqual([]);
		});

		it("filters queue by tripId", async () => {
			const res = await request(app.getHttpServer())
				.get("/api/host/trip-reviews/moderation-queue")
				.query({ tripId })
				.set("Authorization", auth(hostA))
				.expect(200);

			expect(res.body.items.length).toBeGreaterThanOrEqual(1);
			expect(res.body.items.every((i: { tripId: string }) => i.tripId === tripId)).toBe(true);
		});
	});

	describe("Host Moderation Decision: HIDE & Physical Image Quarantine", () => {
		const reviewId = randomUUID();
		const imageUrl = `/uploads/trip-reviews/${testImageFilename}`;
		let p: { bookingId: string; memberId: string; camper: User };

		beforeAll(async () => {
			p = await createParticipation();

			await db.query(
				`INSERT INTO trip_reviews (id, booking_id, member_id, reviewer_id, trip_id, host_id, target, target_id, rating, revision, comment, images, moderation_status, image_storage_state)
				 VALUES ($1, $2, $3, $4, $5, $6, 'trip', $5, 1, 1, 'Ảnh bậy bạ và chửi bới', $7::jsonb, 'visible', 'live')`,
				[
					reviewId,
					p.bookingId,
					p.memberId,
					p.camper.id,
					tripId,
					hostA.id,
					JSON.stringify([imageUrl]),
				]
			);

			await db.query(
				`INSERT INTO trip_review_revisions (review_id, revision, rating, comment, images)
				 VALUES ($1, 1, 1, 'Ảnh bậy bạ và chửi bới', $2::jsonb)`,
				[reviewId, JSON.stringify([imageUrl])]
			);

			const runId = await createRun(reviewId, 1);

			// Active flag: inappropriate_image
			await db.query(
				`INSERT INTO trip_review_moderation_flags (id, run_id, review_id, source_revision, flag_type, channel, detection_source, confidence, evidence, target_image_index, lifecycle_status)
				 VALUES ($1, $2, $3, 1, 'inappropriate_image', 'image', 'model', 0.88, 'Hình ảnh vi phạm thuần phong mỹ tục', 0, 'active')`,
				[randomUUID(), runId, reviewId]
			);
		});

		it("rejects hide decision if reason does not match an active flag (HTTP 400)", async () => {
			const res = await request(app.getHttpServer())
				.post(`/api/host/trip-reviews/${reviewId}/decisions`)
				.set("Authorization", auth(hostA))
				.send({
					expectedRevision: 1,
					decision: ModerationDecisionAction.HIDE,
					reason: "personal_data_leak", // Active flag is inappropriate_image
				})
				.expect(400);

			expect(res.body.message).toContain("must match an active violation flag");
		});

		it("rejects hide decision if non-owner host attempts to moderate (HTTP 403)", async () => {
			await request(app.getHttpServer())
				.post(`/api/host/trip-reviews/${reviewId}/decisions`)
				.set("Authorization", auth(hostB))
				.send({
					expectedRevision: 1,
					decision: ModerationDecisionAction.HIDE,
					reason: "inappropriate_image",
				})
				.expect(403);
		});

		it("successfully hides review, moves image to quarantine, and marks status as hidden", async () => {
			// Ensure test image is live before test
			if (!existsSync(liveImagePath)) {
				writeFileSync(liveImagePath, "dummy jpeg content");
			}

			const res = await request(app.getHttpServer())
				.post(`/api/host/trip-reviews/${reviewId}/decisions`)
				.set("Authorization", auth(hostA))
				.send({
					expectedRevision: 1,
					decision: ModerationDecisionAction.HIDE,
					reason: "inappropriate_image",
					note: "Ẩn vì hình ảnh nhạy cảm",
				})
				.expect(201);

			expect(res.body.decision).toBe("hide");
			expect(res.body.moderationStatus).toBe("hidden");
			expect(res.body.imageStorageState).toBe("quarantined");

			// Verify DB state
			const [dbReview] = await db.query(
				`SELECT moderation_status, hidden_reason, hidden_by, hidden_revision, image_storage_state 
				 FROM trip_reviews WHERE id = $1`,
				[reviewId]
			);
			expect(dbReview.moderation_status).toBe("hidden");
			expect(dbReview.hidden_reason).toBe("inappropriate_image");
			expect(dbReview.hidden_by).toBe(hostA.id);
			expect(dbReview.hidden_revision).toBe(1);
			expect(dbReview.image_storage_state).toBe("quarantined");

			// Verify active flags are resolved
			const activeFlags = await db.query(
				`SELECT count(*)::int AS count FROM trip_review_moderation_flags 
				 WHERE review_id = $1 AND lifecycle_status = 'active'`,
				[reviewId]
			);
			expect(activeFlags[0].count).toBe(0);

			// Verify physical file was quarantined on disk
			expect(existsSync(liveImagePath)).toBe(false);
			expect(existsSync(quarantineImagePath)).toBe(true);
		});

		it("allows Host to view quarantined image evidence and logs audit record", async () => {
			const res = await request(app.getHttpServer())
				.get(`/api/host/trip-reviews/${reviewId}/quarantined-images/0`)
				.set("Authorization", auth(hostA))
				.expect(200);

			expect(res.headers["content-type"]).toBeDefined();

			// Verify audit log entry
			const logs = await db.query(
				`SELECT action, actor_id, target_id FROM audit_logs 
				 WHERE target_id = $1 AND action = 'trip_review_image.view_quarantined'`,
				[reviewId]
			);
			expect(logs.length).toBeGreaterThanOrEqual(1);
			expect(logs[0].actor_id).toBe(hostA.id);
		});

		it("forbids Host B from viewing quarantined images of Host A review (HTTP 403)", async () => {
			await request(app.getHttpServer())
				.get(`/api/host/trip-reviews/${reviewId}/quarantined-images/0`)
				.set("Authorization", auth(hostB))
				.expect(403);
		});

		it("includes locked warning message in Camper review context when review is hidden", async () => {
			const res = await request(app.getHttpServer())
				.get(`/api/bookings/${p.bookingId}/reviews/context`)
				.set("Authorization", auth(p.camper))
				.expect(200);

			const hiddenItem = res.body.reviews.find((r: { id: string }) => r.id === reviewId);
			expect(hiddenItem).toBeDefined();
			expect(hiddenItem.moderationStatus).toBe("hidden");
			expect(hiddenItem.moderationNotice).toContain(
				"Chủ chuyến đã ẩn đánh giá này vì cho rằng nội dung vi phạm tiêu chuẩn cộng đồng"
			);
			expect(hiddenItem.moderationNotice).toContain("inappropriate_image");
		});
	});

	describe("Host Moderation Decision: RESTORE & Physical File Restoration", () => {
		const reviewId = randomUUID();
		const imageUrl = `/uploads/trip-reviews/${testImageFilename}`;
		let p: { bookingId: string; memberId: string; camper: User };

		beforeAll(async () => {
			p = await createParticipation();

			// Ensure image is in quarantine initially
			mkdirSync(quarantineImageDir, { recursive: true });
			writeFileSync(quarantineImagePath, "dummy quarantined file");

			await db.query(
				`INSERT INTO trip_reviews (id, booking_id, member_id, reviewer_id, trip_id, host_id, target, target_id, rating, revision, comment, images, moderation_status, image_storage_state, hidden_reason, hidden_by, hidden_revision, hidden_at)
				 VALUES ($1, $2, $3, $4, $5, $6, 'trip', $5, 3, 1, 'Đánh giá đã được chỉnh sửa hợp lệ', $7::jsonb, 'hidden', 'quarantined', 'profanity_or_insult', $6, 1, now())`,
				[
					reviewId,
					p.bookingId,
					p.memberId,
					p.camper.id,
					tripId,
					hostA.id,
					JSON.stringify([imageUrl]),
				]
			);

			await db.query(
				`INSERT INTO trip_review_revisions (review_id, revision, rating, comment, images)
				 VALUES ($1, 1, 3, 'Đánh giá đã được chỉnh sửa hợp lệ', $2::jsonb)`,
				[reviewId, JSON.stringify([imageUrl])]
			);
		});

		it("successfully restores review to visible and moves files back to live directory", async () => {
			const res = await request(app.getHttpServer())
				.post(`/api/host/trip-reviews/${reviewId}/decisions`)
				.set("Authorization", auth(hostA))
				.send({
					expectedRevision: 1,
					decision: ModerationDecisionAction.RESTORE,
					note: "Khôi phục lại đánh giá",
				})
				.expect(201);

			expect(res.body.decision).toBe("restore");
			expect(res.body.moderationStatus).toBe("visible");
			expect(res.body.imageStorageState).toBe("live");
			expect(res.body.adminActionedOverride).toBe(false);

			// Verify DB state
			const [dbReview] = await db.query(
				`SELECT moderation_status, hidden_reason, hidden_by, hidden_revision, image_storage_state 
				 FROM trip_reviews WHERE id = $1`,
				[reviewId]
			);
			expect(dbReview.moderation_status).toBe("visible");
			expect(dbReview.hidden_reason).toBeNull();
			expect(dbReview.hidden_by).toBeNull();
			expect(dbReview.image_storage_state).toBe("live");

			// Physical file restored back to live directory
			expect(existsSync(liveImagePath)).toBe(true);
			expect(existsSync(quarantineImagePath)).toBe(false);
		});
	});

	describe("Admin Actioned Override Precedence", () => {
		const reviewId = randomUUID();
		let p: { bookingId: string; memberId: string; camper: User };

		beforeAll(async () => {
			p = await createParticipation();

			await db.query(
				`INSERT INTO trip_reviews (id, booking_id, member_id, reviewer_id, trip_id, host_id, target, target_id, rating, revision, comment, images, moderation_status, image_storage_state)
				 VALUES ($1, $2, $3, $4, $5, $6, 'trip', $5, 1, 1, 'Review bị Admin khóa', '[]'::jsonb, 'hidden', 'live')`,
				[reviewId, p.bookingId, p.memberId, p.camper.id, tripId, hostA.id]
			);

			await db.query(
				`INSERT INTO trip_review_revisions (review_id, revision, rating, comment, images)
				 VALUES ($1, 1, 1, 'Review bị Admin khóa', '[]'::jsonb)`,
				[reviewId]
			);

			// Admin actioned content report
			await db.query(
				`INSERT INTO content_reports (id, reporter_id, target_type, target_id, reason, status, created_at)
				 VALUES ($1, $2, 'trip_review', $3, 'harassment', 'actioned', now())`,
				[randomUUID(), p.camper.id, reviewId]
			);
		});

		it("records host restore decision but preserves review hidden state when Admin has actioned the report", async () => {
			const res = await request(app.getHttpServer())
				.post(`/api/host/trip-reviews/${reviewId}/decisions`)
				.set("Authorization", auth(hostA))
				.send({
					expectedRevision: 1,
					decision: ModerationDecisionAction.RESTORE,
					note: "Host xin mở lại",
				})
				.expect(201);

			expect(res.body.decision).toBe("restore");
			expect(res.body.adminActionedOverride).toBe(true);
			expect(res.body.moderationStatus).toBe("hidden");
			expect(res.body.message).toContain("prior Admin moderation action");

			// Verify DB remains hidden
			const [dbReview] = await db.query(
				"SELECT moderation_status FROM trip_reviews WHERE id = $1",
				[reviewId]
			);
			expect(dbReview.moderation_status).toBe("hidden");
		});
	});

	describe("Concurrency Control (409 Stale Revision)", () => {
		const reviewId = randomUUID();
		let p: { bookingId: string; memberId: string; camper: User };

		beforeAll(async () => {
			p = await createParticipation();

			await db.query(
				`INSERT INTO trip_reviews (id, booking_id, member_id, reviewer_id, trip_id, host_id, target, target_id, rating, revision, comment, images, moderation_status, image_storage_state)
				 VALUES ($1, $2, $3, $4, $5, $6, 'trip', $5, 2, 2, 'Đã sửa sang rev 2', '[]'::jsonb, 'visible', 'live')`,
				[reviewId, p.bookingId, p.memberId, p.camper.id, tripId, hostA.id]
			);

			await db.query(
				`INSERT INTO trip_review_revisions (review_id, revision, rating, comment, images)
				 VALUES ($1, 1, 2, 'Rev 1', '[]'::jsonb)`,
				[reviewId]
			);

			await db.query(
				`INSERT INTO trip_review_revisions (review_id, revision, rating, comment, images)
				 VALUES ($1, 2, 2, 'Đã sửa sang rev 2', '[]'::jsonb)`,
				[reviewId]
			);
		});

		it("returns HTTP 409 Conflict when Host sends expectedRevision that is stale", async () => {
			const res = await request(app.getHttpServer())
				.post(`/api/host/trip-reviews/${reviewId}/decisions`)
				.set("Authorization", auth(hostA))
				.send({
					expectedRevision: 1, // Stale! Current is 2
					decision: ModerationDecisionAction.KEEP,
				})
				.expect(409);

			expect(res.body.message).toContain("edited by camper");
		});
	});
});
