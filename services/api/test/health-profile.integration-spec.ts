import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { AuthService } from "../src/modules/auth/auth.service";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

describe("Camper Health Profile (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let authService: AuthService;
	let cleanupUserIds: string[];
	let cleanupEmails: string[];
	let cleanupPhones: string[];
	let cleanupTripIds: string[];
	let phoneSeq = 0;

	const PASSWORD = "S3curePass!";

	beforeAll(async () => {
		jest.setTimeout(30000);
		const moduleRef = await Test.createTestingModule({
			imports: [AppModule],
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

		const server = app.getHttpServer();
		const router = server._events.request._router;
		if (router) {
			const routes = router.stack
				.map((layer: { route?: { methods: Record<string, boolean>; path: string } }) =>
					layer.route
						? `${Object.keys(layer.route.methods).join(",").toUpperCase()} ${layer.route.path}`
						: ""
				)
				.filter(Boolean);
			console.log("NEST REGISTERED ROUTES:", routes);
		}

		dataSource = moduleRef.get(DataSource);
		await dataSource.query(
			'TRUNCATE TABLE "bookings", "trip_porters", "trips", "audit_logs", "health_profiles", "refresh_tokens", "verification_otps", "users" CASCADE'
		);
		authService = moduleRef.get(AuthService);
		expect(dataSource.isInitialized).toBe(true);
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		cleanupUserIds = [];
		cleanupEmails = [];
		cleanupPhones = [];
		cleanupTripIds = [];
	});

	afterEach(async () => {
		// Clean up junction and mock tables first
		if (cleanupTripIds.length > 0) {
			await dataSource.query('DELETE FROM "bookings" WHERE "trip_id" = ANY($1)', [cleanupTripIds]);
			await dataSource.query('DELETE FROM "trip_porters" WHERE "trip_id" = ANY($1)', [
				cleanupTripIds,
			]);
			await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [cleanupTripIds]);
		}
		if (cleanupEmails.length > 0) {
			await dataSource.query(
				'DELETE FROM "bookings" WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "email" = ANY($1))',
				[cleanupEmails]
			);
			await dataSource.query(
				'DELETE FROM "trip_porters" WHERE "porter_id" IN (SELECT "id" FROM "users" WHERE "email" = ANY($1))',
				[cleanupEmails]
			);
			await dataSource.query(
				'DELETE FROM "audit_logs" WHERE "actor_id" IN (SELECT "id" FROM "users" WHERE "email" = ANY($1)) OR "target_id" IN (SELECT "id" FROM "users" WHERE "email" = ANY($1))',
				[cleanupEmails]
			);
			await dataSource.query(
				'DELETE FROM "health_profiles" WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "email" = ANY($1))',
				[cleanupEmails]
			);
			await dataSource.query(
				'DELETE FROM "refresh_tokens" WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "email" = ANY($1))',
				[cleanupEmails]
			);
			await dataSource.query(
				'DELETE FROM "verification_otps" WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "email" = ANY($1))',
				[cleanupEmails]
			);
			await dataSource.query('DELETE FROM "users" WHERE "email" = ANY($1)', [cleanupEmails]);
		}
	});

	function uniqueEmail(tag: string): string {
		return `e2e-health-${tag}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
	}

	function uniqueLocalPhone(): string {
		phoneSeq += 1;
		const rand = Math.floor(Math.random() * 10000000);
		const combined = (30000000 + phoneSeq + rand) % 100000000;
		return `09${String(combined).padStart(8, "0")}`;
	}

	async function registerAndActivateUser(
		tag: string,
		role: UserRole = UserRole.CAMPER
	): Promise<{
		userId: string;
		email: string;
		accessToken: string;
	}> {
		const email = uniqueEmail(tag);
		const local = uniqueLocalPhone();
		cleanupEmails.push(email);
		cleanupPhones.push(`+84${local.slice(1)}`);

		const registerResponse = await request(app.getHttpServer())
			.post("/api/auth/register")
			.send({ email, phone: local, password: PASSWORD, role })
			.expect(201);

		const userId: string = registerResponse.body.id;
		cleanupUserIds.push(userId);

		// Activate account via seed-like OTP verify flow
		const code = await authService.issueOtp(userId);
		await request(app.getHttpServer()).post("/api/auth/verify").send({ userId, code }).expect(200);

		// Also update the full name in profile so that camperName is populated
		const loginResponse = await request(app.getHttpServer())
			.post("/api/auth/login")
			.send({ identifier: email, password: PASSWORD })
			.expect(200);

		await request(app.getHttpServer())
			.patch("/api/profiles/me")
			.set("Authorization", `Bearer ${loginResponse.body.accessToken}`)
			.send({ fullName: `User ${tag}` })
			.expect(200);

		return { userId, email, accessToken: loginResponse.body.accessToken };
	}

	it("gets a default health profile on first get request", async () => {
		const { userId, accessToken } = await registerAndActivateUser("get-default");

		const response = await request(app.getHttpServer())
			.get("/api/camper/health-profile")
			.set("Authorization", `Bearer ${accessToken}`)
			.expect(200);

		expect(response.body).toMatchObject({
			camperId: userId,
			camperName: "User get-default",
			bloodType: "UNKNOWN",
			physicalFitnessLevel: "BEGINNER",
			dietaryRestrictions: "",
			emergencyNotes: "",
			allergies: [],
			medicalConditions: [],
			consent: {
				isConsentGranted: false,
				allowedRoles: ["HOST", "PORTER"],
			},
			accountStatus: "ACTIVE",
			version: 1,
		});
	});

	it("updates health profile and writes audit log", async () => {
		const { userId, accessToken } = await registerAndActivateUser("update-success");

		// Fetch default to verify it is version 1
		const initial = await request(app.getHttpServer())
			.get("/api/camper/health-profile")
			.set("Authorization", `Bearer ${accessToken}`)
			.expect(200);

		const updatePayload = {
			bloodType: "O+",
			physicalFitnessLevel: "INTERMEDIATE",
			dietaryRestrictions: "No seafood",
			emergencyNotes: "EpiPen required",
			allergies: [{ id: "alg-1", name: "Peanuts", severity: "HIGH", reaction: "Hives" }],
			medicalConditions: [
				{ id: "med-1", name: "Mild Asthma", medication: "Inhaler", notes: "Use during climb" },
			],
			isConsentGranted: true,
		};

		const response = await request(app.getHttpServer())
			.put("/api/camper/health-profile")
			.query({ version: initial.body.version })
			.set("Authorization", `Bearer ${accessToken}`)
			.send(updatePayload)
			.expect(200);

		expect(response.body).toMatchObject({
			camperId: userId,
			bloodType: "O+",
			physicalFitnessLevel: "INTERMEDIATE",
			dietaryRestrictions: "No seafood",
			emergencyNotes: "EpiPen required",
			allergies: [{ id: "alg-1", name: "Peanuts", severity: "HIGH", reaction: "Hives" }],
			medicalConditions: [
				{ id: "med-1", name: "Mild Asthma", medication: "Inhaler", notes: "Use during climb" },
			],
			consent: {
				isConsentGranted: true,
			},
			version: 2,
		});

		// Check audit log
		const audits = await dataSource.query(
			'SELECT * FROM "audit_logs" WHERE "target_id" = $1 AND "action" = $2',
			[userId, "health_profile.updated"]
		);
		expect(audits).toHaveLength(1);
		expect(audits[0].before).toMatchObject({ version: 1 });
		expect(audits[0].after).toMatchObject({ version: 2, bloodType: "O+" });
	});

	it("rejects concurrent updates with stale version (BR-242)", async () => {
		const { accessToken } = await registerAndActivateUser("update-conflict");

		// Fetch initial (version 1)
		const initial = await request(app.getHttpServer())
			.get("/api/camper/health-profile")
			.set("Authorization", `Bearer ${accessToken}`)
			.expect(200);

		const payload1 = {
			bloodType: "A+",
			physicalFitnessLevel: "ADVANCED",
			allergies: [],
			medicalConditions: [],
			isConsentGranted: false,
		};

		// First update succeeds, increments version to 2
		await request(app.getHttpServer())
			.put("/api/camper/health-profile")
			.query({ version: initial.body.version })
			.set("Authorization", `Bearer ${accessToken}`)
			.send(payload1)
			.expect(200);

		// Second update using version 1 fails with 409 Conflict
		const payload2 = {
			bloodType: "B-",
			physicalFitnessLevel: "EXPERT",
			allergies: [],
			medicalConditions: [],
			isConsentGranted: false,
		};

		await request(app.getHttpServer())
			.put("/api/camper/health-profile")
			.query({ version: initial.body.version }) // stale version 1
			.set("Authorization", `Bearer ${accessToken}`)
			.send(payload2)
			.expect(409);
	});

	it("rejects invalid input data format and constraints (BR-205)", async () => {
		const { accessToken } = await registerAndActivateUser("update-invalid");

		// Invalid bloodType and too long dietaryRestrictions
		const invalidPayload = {
			bloodType: "XYZ", // Invalid enum
			physicalFitnessLevel: "BEGINNER",
			dietaryRestrictions: "a".repeat(301), // Max 300
			emergencyNotes: "EpiPen",
			allergies: [],
			medicalConditions: [],
			isConsentGranted: false,
		};

		await request(app.getHttpServer())
			.put("/api/camper/health-profile")
			.query({ version: 1 })
			.set("Authorization", `Bearer ${accessToken}`)
			.send(invalidPayload)
			.expect(422);
	});

	it("enforces active account status guard (BR-202)", async () => {
		const { userId, accessToken } = await registerAndActivateUser("status-guard");

		// Suspend user
		await dataSource.query('UPDATE "users" SET "status" = $1 WHERE "id" = $2', [
			UserStatus.SUSPENDED,
			userId,
		]);

		await request(app.getHttpServer())
			.get("/api/camper/health-profile")
			.set("Authorization", `Bearer ${accessToken}`)
			.expect(401);
	});

	it("toggles sharing consent correctly and logs audit event", async () => {
		const { userId, accessToken } = await registerAndActivateUser("consent-toggle");

		// Grant consent
		const resGrant = await request(app.getHttpServer())
			.post("/api/camper/health-profile/consent/grant")
			.set("Authorization", `Bearer ${accessToken}`)
			.expect(200);

		expect(resGrant.body.consent.isConsentGranted).toBe(true);

		// Revoke consent
		const resRevoke = await request(app.getHttpServer())
			.post("/api/camper/health-profile/consent/revoke")
			.set("Authorization", `Bearer ${accessToken}`)
			.expect(200);

		expect(resRevoke.body.consent.isConsentGranted).toBe(false);

		// Check audit log for consent changes
		const auditsGrant = await dataSource.query(
			'SELECT * FROM "audit_logs" WHERE "target_id" = $1 AND "action" = $2',
			[userId, "health_profile.consent_granted"]
		);
		expect(auditsGrant).toHaveLength(1);

		const auditsRevoke = await dataSource.query(
			'SELECT * FROM "audit_logs" WHERE "target_id" = $1 AND "action" = $2',
			[userId, "health_profile.consent_revoked"]
		);
		expect(auditsRevoke).toHaveLength(1);
	});

	describe("Access Control by Host or Porter (AC1 / BR-025 / BR-204)", () => {
		let camperId: string;
		let camperToken: string;
		let hostId: string;
		let hostToken: string;
		let porterId: string;
		let porterToken: string;
		let otherToken: string;
		let tripId: string;

		beforeEach(async () => {
			const camper = await registerAndActivateUser("camper-ac", UserRole.CAMPER);
			camperId = camper.userId;
			camperToken = camper.accessToken;

			const host = await registerAndActivateUser("host-ac", UserRole.HOST);
			hostId = host.userId;
			hostToken = host.accessToken;

			const porter = await registerAndActivateUser("porter-ac", UserRole.PORTER);
			porterId = porter.userId;
			porterToken = porter.accessToken;

			const other = await registerAndActivateUser("other-ac", UserRole.CAMPER);
			otherToken = other.accessToken;

			// Setup a mock trip owned by the host
			tripId = "11111111-1111-1111-1111-111111111111";
			cleanupTripIds.push(tripId);

			await dataSource.query(`INSERT INTO "trips" ("id", "title", "host_id") VALUES ($1, $2, $3)`, [
				tripId,
				"Mount Fansipan Expedition",
				hostId,
			]);

			// Link porter to trip
			await dataSource.query(
				`INSERT INTO "trip_porters" ("trip_id", "porter_id") VALUES ($1, $2)`,
				[tripId, porterId]
			);

			// Initialize the camper's health profile (so it exists)
			await request(app.getHttpServer())
				.get("/api/camper/health-profile")
				.set("Authorization", `Bearer ${camperToken}`)
				.expect(200);
		});

		it("rejects access when consent is not granted, even if linked to a trip", async () => {
			// Link camper to trip (booking exists)
			await dataSource.query(
				`INSERT INTO "bookings" ("id", "trip_id", "user_id") VALUES (gen_random_uuid(), $1, $2)`,
				[tripId, camperId]
			);

			// Consent is default false. Host and Porter should receive 403.
			await request(app.getHttpServer())
				.get(`/api/camper/health-profile/${camperId}`)
				.set("Authorization", `Bearer ${hostToken}`)
				.expect(403);

			await request(app.getHttpServer())
				.get(`/api/camper/health-profile/${camperId}`)
				.set("Authorization", `Bearer ${porterToken}`)
				.expect(403);
		});

		it("allows access to associated Host or Porter when consent is granted", async () => {
			// Link camper to trip
			await dataSource.query(
				`INSERT INTO "bookings" ("id", "trip_id", "user_id") VALUES (gen_random_uuid(), $1, $2)`,
				[tripId, camperId]
			);

			// Grant consent
			await request(app.getHttpServer())
				.post("/api/camper/health-profile/consent/grant")
				.set("Authorization", `Bearer ${camperToken}`)
				.expect(200);

			// Host should be able to view and get activeTripScope returned
			const resHost = await request(app.getHttpServer())
				.get(`/api/camper/health-profile/${camperId}`)
				.set("Authorization", `Bearer ${hostToken}`)
				.expect(200);

			expect(resHost.body.consent.activeTripScope).toBe("Mount Fansipan Expedition");

			// Porter should be able to view
			const resPorter = await request(app.getHttpServer())
				.get(`/api/camper/health-profile/${camperId}`)
				.set("Authorization", `Bearer ${porterToken}`)
				.expect(200);

			expect(resPorter.body.consent.activeTripScope).toBe("Mount Fansipan Expedition");
		});

		it("rejects unrelated hosts, porters, or other campers", async () => {
			// Grant consent
			await request(app.getHttpServer())
				.post("/api/camper/health-profile/consent/grant")
				.set("Authorization", `Bearer ${camperToken}`)
				.expect(200);

			// Host is NOT linked to camper (no booking on host's trip)
			await request(app.getHttpServer())
				.get(`/api/camper/health-profile/${camperId}`)
				.set("Authorization", `Bearer ${hostToken}`)
				.expect(403);

			// Porter is NOT linked to camper (no booking on porter's trip)
			await request(app.getHttpServer())
				.get(`/api/camper/health-profile/${camperId}`)
				.set("Authorization", `Bearer ${porterToken}`)
				.expect(403);

			// Unrelated camper is rejected
			await request(app.getHttpServer())
				.get(`/api/camper/health-profile/${camperId}`)
				.set("Authorization", `Bearer ${otherToken}`)
				.expect(403);
		});
	});
});
