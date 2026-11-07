import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { CreateTripReviewModerationPipeline1794500000000 } from "../src/migrations/1794500000000-CreateTripReviewModerationPipeline";
import { AppModule } from "../src/modules/app.module";
import { TripReviewModerationOutboxService } from "../src/modules/trip-review-moderation/trip-review-moderation-outbox.service";
import {
	type ProviderModerationResponse,
	TripReviewModerationProvider,
} from "../src/modules/trip-review-moderation/trip-review-moderation.provider";
import { TripReviewModerationWorker } from "../src/modules/trip-review-moderation/trip-review-moderation.worker";
import { UploadsService } from "../src/modules/uploads/uploads.service";
import { User, UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("CTMS-387 Review Moderation & Intelligence Pipeline (real PostgreSQL)", () => {
	let app: INestApplication;
	let db: DataSource;
	let jwt: JwtService;
	let worker: TripReviewModerationWorker;
	let outboxService: TripReviewModerationOutboxService;

	let camper: User;
	let host: User;
	const routeId = randomUUID();
	const tripId = randomUUID();
	const bookingId = randomUUID();
	const memberId = randomUUID();
	const userIds: string[] = [];

	const mockProviderScan: jest.Mock<Promise<ProviderModerationResponse>> = jest.fn();

	const mockProvider = {
		configuration: () => ({
			provider: "gemini",
			model: "gemini-3.1-flash-lite",
			configVersion: "gemini-v1",
			promptVersion: "v1",
		}),
		scanReview: mockProviderScan,
	};

	beforeAll(async () => {
		const module = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(UploadsService)
			.useValue(new UploadsService(new ConfigService({ API_PUBLIC_URL: "http://localhost:3000" })))
			.overrideProvider(TripReviewModerationProvider)
			.useValue(mockProvider)
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
		worker = module.get(TripReviewModerationWorker);
		outboxService = module.get(TripReviewModerationOutboxService);

		await assertSafeTestDatabase(db);

		camper = await createAccount(UserRole.CAMPER);
		host = await createAccount(UserRole.HOST);

		await db.query(
			`INSERT INTO trekking_routes (id, host_id, name, route_geom, length_meters, difficulty, expected_duration_minutes, status)
			 VALUES ($1, $2, 'Moderation Route', ST_GeogFromText('LINESTRING(108.22 16.04, 108.25 16.07)'), 3500, 'moderate', 240, 'active')`,
			[routeId, host.id]
		);

		await db.query(
			`INSERT INTO trips (id, host_id, route_id, title, trip_type, duration_nights, starts_at, ends_at, meeting_point, booking_deadline, capacity_min, capacity_max, seats_taken, price_per_person, status)
			 VALUES ($1, $2, $3, 'Moderation Trip', 'day_trip', 0, now() - interval '2 days', now() - interval '1 day', ST_GeogFromText('POINT(108.22 16.04)'), now() - interval '3 days', 1, 20, 1, 0, 'completed')`,
			[tripId, host.id, routeId]
		);

		await db.query(
			`INSERT INTO bookings (id, trip_id, user_id, num_people, status, payment_status, completed_at)
			 VALUES ($1, $2, $3, 1, 'completed', 'not_required', now() - interval '1 hour')`,
			[bookingId, tripId, camper.id]
		);

		await db.query(
			`INSERT INTO booking_members (id, booking_id, user_id, is_primary, member_status, checked_in_at)
			 VALUES ($1, $2, $3, true, 'joined', now() - interval '2 days')`,
			[memberId, bookingId, camper.id]
		);
	}, 60000);

	beforeEach(async () => {
		await db.query(
			"UPDATE bookings SET status='completed', completed_at=now()-interval '1 hour' WHERE id=$1",
			[bookingId]
		);
		await db.query(
			"UPDATE booking_members SET member_status='joined',checked_in_at=now()-interval '2 days',left_at=NULL WHERE id=$1",
			[memberId]
		);
	});

	afterAll(async () => {
		if (!db?.isInitialized) return;

		try {
			await db.query("DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])", [userIds]);
			await db.query("DELETE FROM trip_review_uploads WHERE reviewer_id = ANY($1::uuid[])", [
				userIds,
			]);

			await db.query(
				"DELETE FROM trip_review_incident_signals WHERE review_id IN (SELECT id FROM trip_reviews WHERE booking_id = $1)",
				[bookingId]
			);
			await db.query(
				"DELETE FROM trip_review_aspect_sentiments WHERE review_id IN (SELECT id FROM trip_reviews WHERE booking_id = $1)",
				[bookingId]
			);
			await db.query(
				"DELETE FROM trip_review_moderation_flags WHERE review_id IN (SELECT id FROM trip_reviews WHERE booking_id = $1)",
				[bookingId]
			);
			await db.query(
				"DELETE FROM trip_review_moderation_image_items WHERE review_id IN (SELECT id FROM trip_reviews WHERE booking_id = $1)",
				[bookingId]
			);
			await db.query(
				"DELETE FROM trip_review_moderation_runs WHERE review_id IN (SELECT id FROM trip_reviews WHERE booking_id = $1)",
				[bookingId]
			);
			await db.query(
				"DELETE FROM trip_review_moderation_outbox WHERE review_id IN (SELECT id FROM trip_reviews WHERE booking_id = $1)",
				[bookingId]
			);
			await db.query(
				"DELETE FROM trip_review_revisions WHERE review_id IN (SELECT id FROM trip_reviews WHERE booking_id = $1)",
				[bookingId]
			);
			await db.query("DELETE FROM trip_reviews WHERE booking_id = $1", [bookingId]);

			await db.query("DELETE FROM booking_members WHERE booking_id = $1", [bookingId]);
			await db.query("DELETE FROM bookings WHERE id = $1", [bookingId]);
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
				email: `moderation-${randomUUID()}@example.test`,
				passwordHash: "unused-test-hash",
				role,
				status: UserStatus.ACTIVE,
			})
		);
		userIds.push(user.id);
		await db.query("INSERT INTO user_roles (user_id, role) VALUES ($1, $2)", [user.id, role]);
		return user;
	}

	const auth = (user: User) => `Bearer ${jwt.sign({ sub: user.id, roles: [user.role] })}`;

	describe("Database Schema & Constraints", () => {
		let testReviewId: string;
		let testRunId1: string;
		let testRunId2: string;

		beforeAll(async () => {
			testReviewId = randomUUID();
			testRunId1 = randomUUID();
			testRunId2 = randomUUID();

			// Insert a test review and 2 revisions
			await db.query(
				`INSERT INTO trip_reviews (id, booking_id, member_id, reviewer_id, trip_id, host_id, target, target_id, rating, revision, comment, images)
				 VALUES ($1, $2, $3, $4, $5, $6, 'trip', $5, 4, 1, 'Initial test review', '["https://example.test/img1.jpg"]'::jsonb)`,
				[testReviewId, bookingId, memberId, camper.id, tripId, host.id]
			);

			await db.query(
				`INSERT INTO trip_review_revisions (review_id, revision, rating, comment, images)
				 VALUES ($1, 1, 4, 'Initial test review', '["https://example.test/img1.jpg"]'::jsonb)`,
				[testReviewId]
			);

			await db.query(
				`INSERT INTO trip_review_revisions (review_id, revision, rating, comment, images)
				 VALUES ($1, 2, 5, 'Second test review revision', '["https://example.test/img1.jpg"]'::jsonb)`,
				[testReviewId]
			);

			// Insert test moderation run 1
			await db.query(
				`INSERT INTO trip_review_moderation_runs (
					id, review_id, source_revision, provider, model, config_version, prompt_version,
					text_scan_status, image_scan_status, aspects_status, incidents_status
				 ) VALUES (
					$1, $2, 1, 'gemini', 'gemini-3.1-flash-lite', 'gemini-v1', 'v1',
					'completed', 'unsupported', 'completed', 'completed'
				 )`,
				[testRunId1, testReviewId]
			);

			// Insert test moderation run 2
			await db.query(
				`INSERT INTO trip_review_moderation_runs (
					id, review_id, source_revision, provider, model, config_version, prompt_version,
					text_scan_status, image_scan_status, aspects_status, incidents_status
				 ) VALUES (
					$1, $2, 2, 'gemini', 'gemini-3.1-flash-lite', 'gemini-v1', 'v1',
					'completed', 'unsupported', 'completed', 'completed'
				 )`,
				[testRunId2, testReviewId]
			);
		});

		afterAll(async () => {
			await db.query("DELETE FROM trip_review_incident_signals WHERE run_id = ANY($1::uuid[])", [
				[testRunId1, testRunId2],
			]);
			await db.query("DELETE FROM trip_review_aspect_sentiments WHERE run_id = ANY($1::uuid[])", [
				[testRunId1, testRunId2],
			]);
			await db.query("DELETE FROM trip_review_moderation_flags WHERE run_id = ANY($1::uuid[])", [
				[testRunId1, testRunId2],
			]);
			await db.query(
				"DELETE FROM trip_review_moderation_image_items WHERE run_id = ANY($1::uuid[])",
				[[testRunId1, testRunId2]]
			);
			await db.query("DELETE FROM trip_review_moderation_runs WHERE id = ANY($1::uuid[])", [
				[testRunId1, testRunId2],
			]);
			await db.query("DELETE FROM trip_review_revisions WHERE review_id = $1", [testReviewId]);
			await db.query("DELETE FROM trip_reviews WHERE id = $1", [testReviewId]);
		});

		it("enforces CHK_flag_source_rules: rule detection requires confidence NULL and flag_type personal_data_leak", async () => {
			// SUT 1: Rule with confidence NOT NULL must fail
			await expect(
				db.query(
					`INSERT INTO trip_review_moderation_flags (
						run_id, review_id, source_revision, channel, target_image_index,
						flag_type, detection_source, confidence, evidence, quote, lifecycle_status
					 ) VALUES ($1, $2, 1, 'text', NULL, 'personal_data_leak', 'rule', 0.9, 'test evidence', 'quote', 'active')`,
					[testRunId1, testReviewId]
				)
			).rejects.toThrow(/chk_flag_source_rules/i);

			// SUT 2: Rule with flag_type <> personal_data_leak must fail
			await expect(
				db.query(
					`INSERT INTO trip_review_moderation_flags (
						run_id, review_id, source_revision, channel, target_image_index,
						flag_type, detection_source, confidence, evidence, quote, lifecycle_status
					 ) VALUES ($1, $2, 1, 'text', NULL, 'harassment', 'rule', NULL, 'test evidence', 'quote', 'active')`,
					[testRunId1, testReviewId]
				)
			).rejects.toThrow(/chk_flag_source_rules/i);

			// SUT 3: Model with confidence NULL must fail
			await expect(
				db.query(
					`INSERT INTO trip_review_moderation_flags (
						run_id, review_id, source_revision, channel, target_image_index,
						flag_type, detection_source, confidence, evidence, quote, lifecycle_status
					 ) VALUES ($1, $2, 1, 'text', NULL, 'harassment', 'model', NULL, 'test evidence', 'quote', 'active')`,
					[testRunId1, testReviewId]
				)
			).rejects.toThrow(/chk_flag_source_rules/i);

			// SUT 4: Model with flag_type = personal_data_leak must fail
			await expect(
				db.query(
					`INSERT INTO trip_review_moderation_flags (
						run_id, review_id, source_revision, channel, target_image_index,
						flag_type, detection_source, confidence, evidence, quote, lifecycle_status
					 ) VALUES ($1, $2, 1, 'text', NULL, 'personal_data_leak', 'model', 0.9, 'test evidence', 'quote', 'active')`,
					[testRunId1, testReviewId]
				)
			).rejects.toThrow(/chk_flag_source_rules/i);

			// SUT 5: Valid rule flag succeeds
			await expect(
				db.query(
					`INSERT INTO trip_review_moderation_flags (
						run_id, review_id, source_revision, channel, target_image_index,
						flag_type, detection_source, confidence, evidence, quote, lifecycle_status
					 ) VALUES ($1, $2, 1, 'text', NULL, 'personal_data_leak', 'rule', NULL, 'Server rule detected phone', '090***567', 'active')`,
					[testRunId1, testReviewId]
				)
			).resolves.toBeDefined();

			// SUT 6: Valid model flag succeeds
			await expect(
				db.query(
					`INSERT INTO trip_review_moderation_flags (
						run_id, review_id, source_revision, channel, target_image_index,
						flag_type, detection_source, confidence, evidence, quote, lifecycle_status
					 ) VALUES ($1, $2, 1, 'text', NULL, 'harassment', 'model', 0.95, 'Host yelled at camper', 'yelled', 'active')`,
					[testRunId1, testReviewId]
				)
			).resolves.toBeDefined();
		});

		it("enforces CHK_image_item_scan_violation on moderation image items", async () => {
			// SUT 1: scan_status = 'completed' with has_violation NULL must fail
			await expect(
				db.query(
					`INSERT INTO trip_review_moderation_image_items (
						run_id, review_id, source_revision, image_index, storage_key, scan_status, has_violation
					 ) VALUES ($1, $2, 1, 0, 'img1.jpg', 'completed', NULL)`,
					[testRunId1, testReviewId]
				)
			).rejects.toThrow(/chk_image_item_scan_violation/i);

			// SUT 2: scan_status = 'unsupported' with has_violation NOT NULL must fail
			await expect(
				db.query(
					`INSERT INTO trip_review_moderation_image_items (
						run_id, review_id, source_revision, image_index, storage_key, scan_status, has_violation
					 ) VALUES ($1, $2, 1, 0, 'img1.jpg', 'unsupported', true)`,
					[testRunId1, testReviewId]
				)
			).rejects.toThrow(/chk_image_item_scan_violation/i);

			// SUT 3: scan_status = 'unsupported' with has_violation NULL and flag_type NULL succeeds
			await expect(
				db.query(
					`INSERT INTO trip_review_moderation_image_items (
						run_id, review_id, source_revision, image_index, storage_key, scan_status, has_violation
					 ) VALUES ($1, $2, 1, 0, 'img1.jpg', 'unsupported', NULL)`,
					[testRunId1, testReviewId]
				)
			).resolves.toBeDefined();
		});

		it("enforces UQ_incident_signal_item expression index on md5(quote)", async () => {
			const quote = "Đường rất trơn trượt suýt ngã xuống vực";

			// First insert succeeds (incident_type must be fall_slip, injury, lost_path, weather_hazard, other)
			await db.query(
				`INSERT INTO trip_review_incident_signals (
					run_id, review_id, source_revision, incident_type, occurred, severity, quote
				 ) VALUES ($1, $2, 1, 'fall_slip', 'yes', 'severe', $3)`,
				[testRunId1, testReviewId, quote]
			);

			// Duplicate insert with same run_id, incident_type, and quote fails
			await expect(
				db.query(
					`INSERT INTO trip_review_incident_signals (
						run_id, review_id, source_revision, incident_type, occurred, severity, quote
					 ) VALUES ($1, $2, 1, 'fall_slip', 'warning', 'moderate', $3)`,
					[testRunId1, testReviewId, quote]
				)
			).rejects.toThrow(/duplicate key value|uq_incident_signal_item/i);

			// Different incident_type with same quote succeeds
			await expect(
				db.query(
					`INSERT INTO trip_review_incident_signals (
						run_id, review_id, source_revision, incident_type, occurred, severity, quote
					 ) VALUES ($1, $2, 1, 'weather_hazard', 'yes', 'severe', $3)`,
					[testRunId1, testReviewId, quote]
				)
			).resolves.toBeDefined();
		});

		it("enforces UQ_moderation_run_source on runs", async () => {
			// Inserting duplicate run identity for the same review, revision, provider, model, config_version, prompt_version fails
			await expect(
				db.query(
					`INSERT INTO trip_review_moderation_runs (
						review_id, source_revision, provider, model, config_version, prompt_version,
						text_scan_status, image_scan_status, aspects_status, incidents_status
					 ) VALUES (
						$1, 1, 'gemini', 'gemini-3.1-flash-lite', 'gemini-v1', 'v1',
						'running', 'running', 'running', 'running'
					 )`,
					[testReviewId]
				)
			).rejects.toThrow(/duplicate key value|uq_moderation_run_source/i);
		});

		it("enforces UQ_active_flag_per_review: at most one active flag per review and issue", async () => {
			// SUT: Second active flag on same review, channel, and flag_type fails (from testRunId2 on rev 2)
			await expect(
				db.query(
					`INSERT INTO trip_review_moderation_flags (
						run_id, review_id, source_revision, channel, target_image_index,
						flag_type, detection_source, confidence, evidence, quote, lifecycle_status
					 ) VALUES ($1, $2, 2, 'text', NULL, 'harassment', 'model', 0.88, 'Another harassment quote', 'shouting', 'active')`,
					[testRunId2, testReviewId]
				)
			).rejects.toThrow(/duplicate key value|uq_active_flag_per_review/i);

			// But inserting a superseded flag for the same issue from testRunId2 succeeds
			await expect(
				db.query(
					`INSERT INTO trip_review_moderation_flags (
						run_id, review_id, source_revision, channel, target_image_index,
						flag_type, detection_source, confidence, evidence, quote, lifecycle_status
					 ) VALUES ($1, $2, 2, 'text', NULL, 'harassment', 'model', 0.70, 'Old superseded harassment quote', 'shouting', 'superseded')`,
					[testRunId2, testReviewId]
				)
			).resolves.toBeDefined();
		});
	});

	describe("End-to-End Outbox & Worker Pipeline", () => {
		let reviewId: string;

		afterEach(async () => {
			if (reviewId) {
				await db.query("DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])", [userIds]);
				await db.query("DELETE FROM trip_review_incident_signals WHERE review_id = $1", [reviewId]);
				await db.query("DELETE FROM trip_review_aspect_sentiments WHERE review_id = $1", [
					reviewId,
				]);
				await db.query("DELETE FROM trip_review_moderation_flags WHERE review_id = $1", [reviewId]);
				await db.query("DELETE FROM trip_review_moderation_image_items WHERE review_id = $1", [
					reviewId,
				]);
				await db.query("DELETE FROM trip_review_moderation_runs WHERE review_id = $1", [reviewId]);
				await db.query("DELETE FROM trip_review_moderation_outbox WHERE review_id = $1", [
					reviewId,
				]);
				await db.query("DELETE FROM trip_review_revisions WHERE review_id = $1", [reviewId]);
				await db.query("DELETE FROM trip_reviews WHERE id = $1", [reviewId]);
				await db.query("DELETE FROM trip_review_uploads WHERE reviewer_id = ANY($1::uuid[])", [
					userIds,
				]);
				reviewId = "";
			}
		});

		it("enqueues outbox on review creation, masks PII, calls AI provider, and persists full structured results", async () => {
			const photoUrl = "https://example.test/trip-reviews/test-photo.jpg";
			mockProviderScan.mockResolvedValueOnce({
				text_scan_status: "completed",
				image_scan_status: "unsupported",
				aspects_status: "completed",
				incidents_status: "completed",
				flags: [],
				image_items: [
					{
						image_index: 0,
						storage_key: photoUrl,
						scan_status: "unsupported",
						has_violation: null,
					},
				],
				aspect_sentiments: [
					{
						aspect: "safety",
						sentiment: "positive",
						confidence: 0.98,
						quote: "Cảnh núi rừng Tây Bắc cực kỳ hùng vĩ",
					},
				],
				incident_signals: [
					{
						incident_type: "lost_path",
						occurred: "warning",
						severity: "moderate",
						quote: "Đoạn dốc trơn nhẹ cần chú ý",
					},
				],
			});

			// Register image upload so validation passes
			await db.query(
				`INSERT INTO trip_review_uploads (id, reviewer_id, url)
				 VALUES ($1, $2, $3)`,
				[randomUUID(), camper.id, photoUrl]
			);

			// 1. Camper creates a review via HTTP API
			const res = await request(app.getHttpServer())
				.post(`/api/bookings/${bookingId}/reviews`)
				.set("Authorization", auth(camper))
				.send({
					target: "trip",
					rating: 5,
					comment:
						"Cảnh núi rừng Tây Bắc cực kỳ hùng vĩ. Đoạn dốc trơn nhẹ cần chú ý. Liên hệ camper: 0987654321.",
					images: [photoUrl],
				});

			expect(res.status).toBe(201);
			reviewId = res.body.id;

			// 2. Verify outbox entry was written in the same transaction
			const outboxRows = await db.query(
				"SELECT * FROM trip_review_moderation_outbox WHERE review_id = $1 AND source_revision = 1",
				[reviewId]
			);
			expect(outboxRows).toHaveLength(1);
			expect(outboxRows[0].processed_at).toBeNull();

			// 3. Worker processes the pending outbox
			const processedCount = await worker.processPendingOutbox(10);
			expect(processedCount).toBe(1);

			// 4. Verify AI provider was called with MASKED comment (never raw phone number)
			expect(mockProviderScan).toHaveBeenCalledTimes(1);
			const [maskedCommentSent] = mockProviderScan.mock.calls[0];
			expect(maskedCommentSent).not.toContain("0987654321");
			expect(maskedCommentSent).toContain("[phone]");

			// 5. Verify outbox is marked processed
			const updatedOutbox = await db.query(
				"SELECT processed_at FROM trip_review_moderation_outbox WHERE review_id = $1",
				[reviewId]
			);
			expect(updatedOutbox[0].processed_at).not.toBeNull();

			// 6. Verify moderation run is marked completed
			const runRows = await db.query(
				"SELECT * FROM trip_review_moderation_runs WHERE review_id = $1",
				[reviewId]
			);
			expect(runRows).toHaveLength(1);
			expect(runRows[0].completed_at).not.toBeNull();
			expect(runRows[0].text_scan_status).toBe("completed");
			expect(runRows[0].image_scan_status).toBe("unsupported");

			// 7. Verify PII rule flag was saved with masked evidence and quote
			const flagRows = await db.query(
				`SELECT * FROM trip_review_moderation_flags WHERE review_id = $1 AND detection_source = 'rule'`,
				[reviewId]
			);
			expect(flagRows).toHaveLength(1);
			expect(flagRows[0].flag_type).toBe("personal_data_leak");
			expect(flagRows[0].confidence).toBeNull();
			expect(flagRows[0].lifecycle_status).toBe("active");
			expect(flagRows[0].quote).toBe("098***321");
			expect(flagRows[0].evidence).toContain("098***321");

			// 8. Verify aspect sentiments saved
			const aspectRows = await db.query(
				"SELECT * FROM trip_review_aspect_sentiments WHERE review_id = $1",
				[reviewId]
			);
			expect(aspectRows).toHaveLength(1);
			expect(aspectRows[0].aspect).toBe("safety");
			expect(aspectRows[0].sentiment).toBe("positive");

			// 9. Verify incident signals saved
			const incidentRows = await db.query(
				"SELECT * FROM trip_review_incident_signals WHERE review_id = $1",
				[reviewId]
			);
			expect(incidentRows).toHaveLength(1);
			expect(incidentRows[0].incident_type).toBe("lost_path");
			expect(incidentRows[0].occurred).toBe("warning");

			// 10. Verify image item recorded as unsupported (not passed)
			const imageItemRows = await db.query(
				"SELECT * FROM trip_review_moderation_image_items WHERE review_id = $1",
				[reviewId]
			);
			expect(imageItemRows).toHaveLength(1);
			expect(imageItemRows[0].scan_status).toBe("unsupported");
			expect(imageItemRows[0].has_violation).toBeNull();
		});

		it("enforces late-writing revision fence: worker marks flags as superseded if review was already updated to rev 2", async () => {
			mockProviderScan.mockResolvedValueOnce({
				text_scan_status: "completed",
				image_scan_status: "unsupported",
				aspects_status: "completed",
				incidents_status: "completed",
				flags: [
					{
						flag_type: "harassment",
						confidence: 0.9,
						evidence: "Host was rude",
						quote: "rude",
					},
				],
				image_items: [],
				aspect_sentiments: [],
				incident_signals: [],
			});

			// 1. Create review revision 1
			const res = await request(app.getHttpServer())
				.post(`/api/bookings/${bookingId}/reviews`)
				.set("Authorization", auth(camper))
				.send({
					target: "trip",
					rating: 2,
					comment: "Host was very rude to us",
				});

			expect(res.status).toBe(201);
			reviewId = res.body.id;

			const outboxRev1 = await db.query(
				"SELECT id FROM trip_review_moderation_outbox WHERE review_id = $1 AND source_revision = 1",
				[reviewId]
			);

			// 2. Camper edits the review to revision 2 BEFORE worker runs revision 1
			const patchRes = await request(app.getHttpServer())
				.patch(`/api/trip-reviews/${reviewId}`)
				.set("Authorization", auth(camper))
				.send({
					rating: 3,
					expectedRevision: 1,
					comment: "Chỉnh sửa đánh giá: chuyến đi tạm ổn",
				});
			expect(patchRes.status).toBe(200);

			const reviewRev2 = await db.query("SELECT revision FROM trip_reviews WHERE id = $1", [
				reviewId,
			]);
			expect(reviewRev2[0].revision).toBe(2);

			// 3. Worker now processes outbox of revision 1
			const success = await worker.processOutboxRecord(outboxRev1[0].id);
			expect(success).toBe(true);

			// 4. Because current revision (2) > source_revision (1), revision fence sets flag to 'superseded'
			const rev1Flags = await db.query(
				"SELECT * FROM trip_review_moderation_flags WHERE review_id = $1 AND source_revision = 1",
				[reviewId]
			);
			expect(rev1Flags).toHaveLength(1);
			expect(rev1Flags[0].flag_type).toBe("harassment");
			expect(rev1Flags[0].lifecycle_status).toBe("superseded"); // Fenced out from active!
		});

		it("handles concurrent claim with SKIP LOCKED: exactly one worker acquires outbox row", async () => {
			mockProviderScan.mockResolvedValue({
				text_scan_status: "completed",
				image_scan_status: "unsupported",
				aspects_status: "completed",
				incidents_status: "completed",
				flags: [],
				image_items: [],
				aspect_sentiments: [],
				incident_signals: [],
			});

			const res = await request(app.getHttpServer())
				.post(`/api/bookings/${bookingId}/reviews`)
				.set("Authorization", auth(camper))
				.send({
					target: "trip",
					rating: 4,
					comment: "Concurrent test review",
				});
			expect(res.status).toBe(201);
			reviewId = res.body.id;

			const outboxRows = await db.query(
				"SELECT id FROM trip_review_moderation_outbox WHERE review_id = $1",
				[reviewId]
			);
			const outboxId = outboxRows[0].id;

			// Run 2 workers simultaneously on the same outbox ID
			const results = await Promise.all([
				worker.processOutboxRecord(outboxId),
				worker.processOutboxRecord(outboxId),
			]);

			// Exactly one must succeed and one must return false (SKIP LOCKED)
			expect(results).toContain(true);
			expect(results).toContain(false);
		});

		it("marks text channels as not_applicable when review has image only (no comment)", async () => {
			const photoUrl = "https://example.test/trip-reviews/photo-only.jpg";
			mockProviderScan.mockResolvedValueOnce({
				text_scan_status: "not_applicable",
				image_scan_status: "unsupported",
				aspects_status: "not_applicable",
				incidents_status: "not_applicable",
				flags: [],
				image_items: [
					{
						image_index: 0,
						storage_key: photoUrl,
						scan_status: "unsupported",
						has_violation: null,
					},
				],
				aspect_sentiments: [],
				incident_signals: [],
			});

			await db.query("INSERT INTO trip_review_uploads (id, reviewer_id, url) VALUES ($1, $2, $3)", [
				randomUUID(),
				camper.id,
				photoUrl,
			]);

			const res = await request(app.getHttpServer())
				.post(`/api/bookings/${bookingId}/reviews`)
				.set("Authorization", auth(camper))
				.send({
					target: "trip",
					rating: 5,
					comment: null,
					images: [photoUrl],
				});
			expect(res.status).toBe(201);
			reviewId = res.body.id;

			const count = await worker.processPendingOutbox(5);
			expect(count).toBe(1);

			const runRows = await db.query(
				"SELECT * FROM trip_review_moderation_runs WHERE review_id = $1",
				[reviewId]
			);
			expect(runRows[0].text_scan_status).toBe("not_applicable");
			expect(runRows[0].aspects_status).toBe("not_applicable");
			expect(runRows[0].incidents_status).toBe("not_applicable");
			expect(runRows[0].image_scan_status).toBe("unsupported");
		});

		it("verifies review creation within transaction enqueues outbox, and rollback removes outbox", async () => {
			const rolledBackReviewId = randomUUID();
			try {
				await db.transaction(async (manager) => {
					await manager.query(
						`INSERT INTO trip_reviews (id, booking_id, member_id, reviewer_id, trip_id, host_id, target, target_id, rating, revision, comment, images)
						 VALUES ($1, $2, $3, $4, $5, $6, 'trip', $5, 4, 1, 'Rollback test', '[]'::jsonb)`,
						[rolledBackReviewId, bookingId, memberId, camper.id, tripId, host.id]
					);
					await outboxService.onReviewCreated(manager, {
						id: rolledBackReviewId,
						revision: 1,
						comment: "Rollback test",
						images: [],
					});
					throw new Error("INTENTIONAL_ROLLBACK");
				});
			} catch {
				// Expected rollback
			}

			const outboxCheck = await db.query(
				"SELECT * FROM trip_review_moderation_outbox WHERE review_id = $1",
				[rolledBackReviewId]
			);
			expect(outboxCheck).toHaveLength(0);
		});
	});

	describe("Migration Up/Down Lifecycle", () => {
		it("reverses and reapplies migration cleanly without foreign key deadlocks", async () => {
			const migration = new CreateTripReviewModerationPipeline1794500000000();
			const queryRunner = db.createQueryRunner();

			try {
				// 1. Run down
				await migration.down(queryRunner);

				// Verify tables dropped
				const checkDropped = await db.query(
					`SELECT to_regclass('trip_review_moderation_runs') AS runs,
					        to_regclass('trip_review_moderation_outbox') AS outbox`
				);
				expect(checkDropped[0].runs).toBeNull();
				expect(checkDropped[0].outbox).toBeNull();

				// 2. Re-apply up
				await migration.up(queryRunner);

				// Verify tables recreated
				const checkRestored = await db.query(
					`SELECT to_regclass('trip_review_moderation_runs') AS runs,
					        to_regclass('trip_review_moderation_outbox') AS outbox`
				);
				expect(checkRestored[0].runs).not.toBeNull();
				expect(checkRestored[0].outbox).not.toBeNull();
			} finally {
				await queryRunner.release();
			}
		});
	});
});
