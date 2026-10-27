import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { TrekkingRouteStatus } from "../src/modules/trekking-routes/entities/trekking-route.entity";
import { TripStatus, TripType } from "../src/modules/trips/entities/trip.entity";
import { TripImageCleanupWorker } from "../src/modules/trips/services/trip-image-cleanup.worker";
import { UploadsService } from "../src/modules/uploads/uploads.service";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface TestAccount {
	id: string;
	accessToken: string;
}

interface CreateTripPayload {
	routeId: string;
	title: string;
	description?: string;
	tripType: TripType;
	startsAt: string;
	endsAt: string;
	meetingPoint: {
		type: "Point";
		coordinates: [number, number];
	};
	meetingAt?: string;
	bookingDeadline: string;
	capacityMin: number;
	capacityMax: number | null;
	pricePerPerson: number;
	waypoints: Array<{
		type: string;
		name: string;
		location: {
			type: "Point";
			coordinates: [number, number];
		};
		dayNumber: number;
		sequenceOrder: number;
		plannedAt?: string;
	}>;
}

describe("CTMS-028 Manage Trip Images (HTTP E2E, real Postgres and local storage)", () => {
	let app: INestApplication;
	let cleanup: TripImageCleanupWorker;
	let uploadRoot: string;
	const previousUploadRoot = process.env.UPLOAD_ROOT;
	const storageOrigin = `http://${randomUUID()}.trip-images-e2e.test`;
	const png = Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
		"base64"
	);
	const image = (seed = "first") => Buffer.concat([png, Buffer.from(seed)]);
	const filePath = (url: string) => join(uploadRoot, "trips", basename(new URL(url).pathname));
	const files = () =>
		existsSync(join(uploadRoot, "trips")) ? readdirSync(join(uploadRoot, "trips")) : [];

	let dataSource: DataSource;
	let jwtService: JwtService;
	let cleanupUserIds: string[] = [];
	let cleanupRouteIds: string[] = [];
	let cleanupTripIds: string[] = [];

	beforeAll(async () => {
		jest.setTimeout(60000);
		uploadRoot = mkdtempSync(join(tmpdir(), "ctms-trip-images-e2e-"));
		process.env.UPLOAD_ROOT = uploadRoot;
		// Use the real storage implementation with an isolated local configuration; never call a live CDN.
		const storageConfig = new ConfigService();
		jest
			.spyOn(storageConfig, "get")
			.mockImplementation((key: string) => (key === "API_PUBLIC_URL" ? storageOrigin : undefined));
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(UploadsService)
			.useValue(new UploadsService(storageConfig))
			.compile();
		cleanup = moduleRef.get(TripImageCleanupWorker);
		// Drive the real cleanup worker explicitly so assertions do not race a timer.
		jest.spyOn(cleanup, "onApplicationBootstrap").mockImplementation(() => undefined);
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

		dataSource = moduleRef.get(DataSource);
		jwtService = moduleRef.get(JwtService);
		await assertSafeTestDatabase(dataSource);
	}, 60000);

	afterAll(async () => {
		await app?.close();
		if (previousUploadRoot === undefined) Reflect.deleteProperty(process.env, "UPLOAD_ROOT");
		else process.env.UPLOAD_ROOT = previousUploadRoot;
		if (uploadRoot) {
			if (
				dirname(resolve(uploadRoot)) !== resolve(tmpdir()) ||
				!basename(uploadRoot).startsWith("ctms-trip-images-e2e-")
			)
				throw new Error("Unsafe E2E upload cleanup path");
			rmSync(uploadRoot, { recursive: true, force: true });
		}
	});

	beforeEach(() => {
		cleanupUserIds = [];
		cleanupRouteIds = [];
		cleanupTripIds = [];
	});

	afterEach(async () => {
		if (!dataSource?.isInitialized) return;
		await dataSource.query("DELETE FROM trip_form_drafts WHERE host_id=ANY($1::uuid[])", [
			cleanupUserIds,
		]);
		if (cleanupTripIds.length > 0) {
			await dataSource.query('DELETE FROM "audit_logs" WHERE "target_id" = ANY($1)', [
				cleanupTripIds,
			]);
			await dataSource.query('DELETE FROM "trip_waypoints" WHERE "trip_id" = ANY($1)', [
				cleanupTripIds,
			]);
			await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [cleanupTripIds]);
		}
		await dataSource.query("DELETE FROM trip_image_cleanup WHERE url LIKE $1", [
			`${storageOrigin}/%`,
		]);
		for (const name of files()) {
			// `name` comes directly from the isolated directory listing.
			rmSync(join(uploadRoot, "trips", name));
		}

		if (cleanupRouteIds.length > 0) {
			await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [
				cleanupRouteIds,
			]);
		}
		if (cleanupUserIds.length > 0) {
			await dataSource.query(
				'DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1) OR "target_id" = ANY($1)',
				[cleanupUserIds]
			);
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [
				cleanupUserIds,
			]);
			await dataSource.query('DELETE FROM "refresh_tokens" WHERE "user_id" = ANY($1)', [
				cleanupUserIds,
			]);
			await dataSource.query('DELETE FROM "verification_otps" WHERE "user_id" = ANY($1)', [
				cleanupUserIds,
			]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [cleanupUserIds]);
		}
	});

	async function createAccount(role: UserRole): Promise<TestAccount> {
		const id = randomUUID();
		const sequence = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
		const passwordHash = await hash("S3curePass!", 10);
		await dataSource.query(
			`
			INSERT INTO "users" (
				"id",
				"email",
				"password_hash",
				"role",
				"status",
				"full_name"
			)
			VALUES ($1, $2, $3, $4, $5, $6)
			`,
			[
				id,
				`e2e-trip-${role}-${sequence}@example.com`,
				passwordHash,
				role,
				UserStatus.ACTIVE,
				`Trip ${role}`,
			]
		);
		await dataSource.query(
			`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)
			 ON CONFLICT ("user_id", "role") DO NOTHING`,
			[id, role]
		);
		cleanupUserIds.push(id);

		return {
			id,
			accessToken: jwtService.sign({ sub: id, roles: [role] }),
		};
	}

	async function createRoute(hostId: string, status = TrekkingRouteStatus.ACTIVE): Promise<string> {
		const routeId = randomUUID();
		await dataSource.query(
			`
			INSERT INTO "trekking_routes" (
				"id",
				"host_id",
				"name",
				"description",
				"route_geom",
				"length_meters",
				"difficulty",
				"expected_duration_minutes",
				"status"
			)
			VALUES (
				$1,
				$2,
				$3,
				$4,
				ST_SetSRID(ST_MakeLine(
					ST_MakePoint(108.2208, 16.0471),
					ST_MakePoint(108.2508, 16.0671)
				), 4326)::geography,
				3500,
				'moderate',
				240,
				$5
			)
			`,
			[routeId, hostId, `Trip route ${routeId}`, "Route for Create Trip tests", status]
		);
		cleanupRouteIds.push(routeId);
		return routeId;
	}

	function createPayload(routeId: string): CreateTripPayload {
		return {
			routeId,
			title: "Da Nang overnight ridge trek",
			description: "Create Trip integration coverage",
			tripType: TripType.OVERNIGHT,
			startsAt: "2026-10-01T12:00:00.000Z",
			endsAt: "2026-10-03T10:00:00.000Z",
			meetingPoint: {
				type: "Point",
				coordinates: [108.2208, 16.0471],
			},
			meetingAt: "2026-10-01T11:30:00.000Z",
			bookingDeadline: "2026-09-30T12:00:00.000Z",
			capacityMin: 2,
			capacityMax: 12,
			pricePerPerson: 0,
			waypoints: [
				{
					type: "start",
					name: "Trailhead",
					location: { type: "Point", coordinates: [108.2208, 16.0471] },
					dayNumber: 1,
					sequenceOrder: 1,
					plannedAt: "2026-10-01T12:00:00.000Z",
				},
				{
					type: "finish",
					name: "Summit exit",
					location: { type: "Point", coordinates: [108.2508, 16.0671] },
					dayNumber: 2,
					sequenceOrder: 2,
					plannedAt: "2026-10-03T10:00:00.000Z",
				},
			],
		};
	}

	async function fixture() {
		const host = await createAccount(UserRole.HOST);
		const route = await createRoute(host.id);
		const response = await request(app.getHttpServer())
			.post("/api/trips")
			.auth(host.accessToken, { type: "bearer" })
			.send(createPayload(route))
			.expect(201);
		const tripId: string = response.body.id;
		cleanupTripIds.push(tripId);
		return { host, tripId, path: `/api/trips/${tripId}/images` };
	}
	function upload(path: string, account: TestAccount, bytes = image()) {
		return request(app.getHttpServer())
			.post(path)
			.auth(account.accessToken, { type: "bearer" })
			.attach("file", bytes, { filename: "trip.png", contentType: "image/png" });
	}
	async function cover(tripId: string): Promise<string | null> {
		const [row]: { cover_image_url: string | null }[] = await dataSource.query(
			"SELECT cover_image_url FROM trips WHERE id=$1",
			[tripId]
		);
		return row.cover_image_url;
	}

	it("uploads, lists and persists images while keeping the first thumbnail", async () => {
		const { host, tripId, path } = await fixture();
		const first = await upload(path, host).expect(201);
		expect(first.body).toHaveLength(1);
		expect(first.body[0]).toMatchObject({ sortOrder: 0 });
		expect(existsSync(filePath(first.body[0].url))).toBe(true);
		const second = await upload(path, host, image("second")).expect(201);
		expect(second.body).toHaveLength(2);
		expect(second.body.map((item: { sortOrder: number }) => item.sortOrder)).toEqual([0, 1]);
		expect(await cover(tripId)).toBe(first.body[0].url);
		const listed = await request(app.getHttpServer())
			.get(path)
			.auth(host.accessToken, { type: "bearer" })
			.expect(200);
		expect(listed.body).toEqual(second.body);
		expect(files()).toHaveLength(2);
	});

	it("caps concurrent HTTP uploads at five without replacing the first thumbnail", async () => {
		const { host, tripId, path } = await fixture();
		const first = await upload(path, host).expect(201);
		const results = await Promise.all(
			Array.from({ length: 7 }, (_, i) => upload(path, host, image(`image-${i}`)))
		);
		expect(results.filter((r) => r.status === 201)).toHaveLength(4);
		expect(results.filter((r) => r.status === 409)).toHaveLength(3);
		const list = await request(app.getHttpServer())
			.get(path)
			.auth(host.accessToken, { type: "bearer" })
			.expect(200);
		expect(list.body).toHaveLength(5);
		expect(files()).toHaveLength(5);
		expect(await cover(tripId)).toBe(first.body[0].url);
	});

	it("processes concurrent duplicate uploads exactly once", async () => {
		const { host, tripId, path } = await fixture();
		const results = await Promise.all(Array.from({ length: 4 }, () => upload(path, host)));
		for (const result of results) {
			expect(result.status).toBe(201);
			expect(result.body).toEqual(results[0].body);
		}
		expect(files()).toHaveLength(1);
		const [audit]: { count: number }[] = await dataSource.query(
			"SELECT count(*)::int AS count FROM audit_logs WHERE target_id=$1 AND action='trip.image_added'",
			[tripId]
		);
		expect(audit.count).toBe(1);
	});

	it("removes metadata, promotes the next thumbnail, cleans the file and safely retries deletion", async () => {
		const { host, tripId, path } = await fixture();
		const first = await upload(path, host).expect(201);
		const second = await upload(path, host, image("second")).expect(201);
		const removed = first.body[0] as { id: string; url: string };
		const response = await request(app.getHttpServer())
			.delete(`${path}/${removed.id}`)
			.auth(host.accessToken, { type: "bearer" })
			.expect(200);
		expect(response.body).toMatchObject({ images: [second.body[1]], storageCleanup: "queued" });
		expect(await cover(tripId)).toBe(second.body[1].url);
		expect(await dataSource.query("SELECT id FROM trip_images WHERE id=$1", [removed.id])).toEqual(
			[]
		);
		await cleanup.tick();
		expect(existsSync(filePath(removed.url))).toBe(false);
		expect(existsSync(filePath(second.body[1].url))).toBe(true);
		await request(app.getHttpServer())
			.delete(`${path}/${removed.id}`)
			.auth(host.accessToken, { type: "bearer" })
			.expect(200);
		const [audit]: { count: number }[] = await dataSource.query(
			"SELECT count(*)::int AS count FROM audit_logs WHERE target_id=$1 AND action='trip.image_removed'",
			[tripId]
		);
		expect(audit.count).toBe(1);
		await request(app.getHttpServer())
			.delete(`${path}/${second.body[1].id}`)
			.auth(host.accessToken, { type: "bearer" })
			.expect(200);
		expect(await cover(tripId)).toBeNull();
		await cleanup.tick();
		expect(files()).toEqual([]);
	});

	it("physically cascades image records and cleans files when the Trip is deleted", async () => {
		const { host, tripId, path } = await fixture();
		await upload(path, host).expect(201);
		// Trip deletion has no HTTP endpoint; exercise its database cascade and the real cleanup worker.
		await dataSource.query("DELETE FROM trip_waypoints WHERE trip_id=$1", [tripId]);
		await dataSource.query("DELETE FROM trips WHERE id=$1", [tripId]);
		expect(await dataSource.query("SELECT id FROM trip_images WHERE trip_id=$1", [tripId])).toEqual(
			[]
		);
		await cleanup.tick();
		expect(files()).toEqual([]);
		await request(app.getHttpServer())
			.get(path)
			.auth(host.accessToken, { type: "bearer" })
			.expect(404);
	});

	it("rejects unauthenticated, wrong-role and unrelated-Host requests without storage writes", async () => {
		const { path } = await fixture();
		const other = await createAccount(UserRole.HOST);
		const camper = await createAccount(UserRole.CAMPER);
		await request(app.getHttpServer()).post(path).attach("file", image(), "trip.png").expect(401);
		await upload(path, camper).expect(403);
		await upload(path, other).expect(403);
		expect(files()).toEqual([]);
	});

	it("rejects references to missing Trips and images belonging to another Trip", async () => {
		const first = await fixture();
		const second = await fixture();
		await upload(`/api/trips/${randomUUID()}/images`, first.host).expect(404);
		const result = await upload(second.path, second.host).expect(201);
		await request(app.getHttpServer())
			.delete(`${first.path}/${result.body[0].id}`)
			.auth(first.host.accessToken, { type: "bearer" })
			.expect(404);
		expect(existsSync(filePath(result.body[0].url))).toBe(true);
	});

	it.each([TripStatus.ONGOING, TripStatus.COMPLETED, TripStatus.CANCELLED])(
		"rejects upload and removal in state %s",
		async (status) => {
			const { host, tripId, path } = await fixture();
			const first = await upload(path, host).expect(201);
			await dataSource.query("UPDATE trips SET status=$2 WHERE id=$1", [tripId, status]);
			await upload(path, host, image("blocked")).expect(409);
			await request(app.getHttpServer())
				.delete(`${path}/${first.body[0].id}`)
				.auth(host.accessToken, { type: "bearer" })
				.expect(409);
			expect(files()).toHaveLength(1);
			expect(
				await dataSource.query("SELECT id FROM trip_images WHERE trip_id=$1", [tripId])
			).toHaveLength(1);
		}
	);

	it("rejects missing, forged and oversized uploads before persisting an image", async () => {
		const { host, tripId, path } = await fixture();
		await request(app.getHttpServer())
			.post(path)
			.auth(host.accessToken, { type: "bearer" })
			.expect(422);
		await upload(path, host, Buffer.from("not an image")).expect(422);
		await upload(path, host, Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)])).expect(413);
		expect(files()).toEqual([]);
		expect(await cover(tripId)).toBeNull();
		expect(await dataSource.query("SELECT id FROM trip_images WHERE trip_id=$1", [tripId])).toEqual(
			[]
		);
	});

	it("applies Trip visibility to the image collection", async () => {
		const { host, tripId, path } = await fixture();
		const camper = await createAccount(UserRole.CAMPER);
		const uploaded = await upload(path, host).expect(201);
		await request(app.getHttpServer())
			.get(path)
			.auth(camper.accessToken, { type: "bearer" })
			.expect(404);
		await dataSource.query("UPDATE trips SET status=$2 WHERE id=$1", [
			tripId,
			TripStatus.PUBLISHED,
		]);
		const visible = await request(app.getHttpServer())
			.get(path)
			.auth(camper.accessToken, { type: "bearer" })
			.expect(200);
		expect(visible.body).toEqual(uploaded.body);
	});
	const partialValues = {
		routeId: "",
		title: "Unfinished trip",
		description: "",
		coverImageUrl: "",
		tripType: "day_trip",
		startsAt: "",
		endsAt: "",
		meetingLongitude: "",
		meetingLatitude: "",
		meetingAt: "",
		bookingDeadline: "",
		capacityMin: "",
		capacityMax: "",
		pricePerPerson: "0",
		waypoints: [],
	};
	it("saves an incomplete form and images as a visible owned draft, and restores them", async () => {
		const host = await createAccount(UserRole.HOST);
		const id = randomUUID();
		const path = `/api/trip-drafts/${id}`;
		await request(app.getHttpServer())
			.put(path)
			.auth(host.accessToken, { type: "bearer" })
			.field("values", JSON.stringify(partialValues))
			.attach("images", image(), { filename: "first.png", contentType: "image/png" })
			.expect(200);
		const list = await request(app.getHttpServer())
			.get("/api/trip-drafts")
			.auth(host.accessToken, { type: "bearer" })
			.expect(200);
		expect(list.body).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id, title: "Unfinished trip", imageCount: 1 }),
			])
		);
		const restored = await request(app.getHttpServer())
			.get(path)
			.auth(host.accessToken, { type: "bearer" })
			.expect(200);
		expect(restored.body.values).toEqual(partialValues);
		const cover = await request(app.getHttpServer())
			.get(`${path}/thumbnail`)
			.auth(host.accessToken, { type: "bearer" })
			.expect(200);
		expect(cover.body.name).toBe("first.png");
		expect(Buffer.from(cover.body.base64, "base64")).toEqual(image());

		expect(Buffer.from(restored.body.images[0].base64, "base64")).toEqual(image());
		await request(app.getHttpServer())
			.put(path)
			.auth(host.accessToken, { type: "bearer" })
			.field("values", JSON.stringify({ ...partialValues, title: "Updated draft" }))
			.expect(200);
		expect(
			await dataSource.query("SELECT id FROM trip_form_drafts WHERE id=$1", [id])
		).toHaveLength(1);
		expect(
			await dataSource.query("SELECT id FROM trip_form_draft_images WHERE draft_id=$1", [id])
		).toHaveLength(0);
	});
	it("preserves draft image bytes on metadata-only autosaves and rejects ambiguous updates", async () => {
		const host = await createAccount(UserRole.HOST);
		const path = `/api/trip-drafts/${randomUUID()}`;
		await request(app.getHttpServer())
			.put(path)
			.auth(host.accessToken, { type: "bearer" })
			.field("values", JSON.stringify(partialValues))
			.attach("images", image(), { filename: "first.png", contentType: "image/png" })
			.expect(200);
		await request(app.getHttpServer())
			.put(path)
			.auth(host.accessToken, { type: "bearer" })
			.field("values", JSON.stringify({ ...partialValues, title: "Autosaved title" }))
			.field("preserveImages", "true")
			.expect(200);
		await request(app.getHttpServer())
			.put(path)
			.auth(host.accessToken, { type: "bearer" })
			.field("values", JSON.stringify({ ...partialValues, title: "Rejected" }))
			.field("preserveImages", "true")
			.attach("images", image(), { filename: "other.png", contentType: "image/png" })
			.expect(422);
		const restored = await request(app.getHttpServer())
			.get(path)
			.auth(host.accessToken, { type: "bearer" })
			.expect(200);
		expect(restored.body.values.title).toBe("Autosaved title");
		expect(restored.body.images).toHaveLength(1);
		expect(restored.body.images[0].name).toBe("first.png");
		expect(Buffer.from(restored.body.images[0].base64, "base64")).toEqual(image());
		await request(app.getHttpServer())
			.put(`/api/trip-drafts/${randomUUID()}`)
			.auth(host.accessToken, { type: "bearer" })
			.field("values", JSON.stringify(partialValues))
			.field("preserveImages", "true")
			.expect(404);
	});

	it("rejects unauthorized draft access and invalid image bytes without persisting data", async () => {
		const host = await createAccount(UserRole.HOST);
		const other = await createAccount(UserRole.HOST);
		const id = randomUUID();
		const path = `/api/trip-drafts/${id}`;
		await request(app.getHttpServer())
			.put(path)
			.auth(host.accessToken, { type: "bearer" })
			.field("values", JSON.stringify(partialValues))
			.expect(200);
		await request(app.getHttpServer())
			.get(path)
			.auth(other.accessToken, { type: "bearer" })
			.expect(403);
		await request(app.getHttpServer())
			.put(path)
			.auth(other.accessToken, { type: "bearer" })
			.field("values", JSON.stringify(partialValues))
			.expect(403);
		await request(app.getHttpServer()).get(path).expect(401);
		await request(app.getHttpServer())
			.get(`${path}/thumbnail`)
			.auth(other.accessToken, { type: "bearer" })
			.expect(403);
		await request(app.getHttpServer()).get(`${path}/thumbnail`).expect(401);

		const bad = randomUUID();
		await request(app.getHttpServer())
			.put(`/api/trip-drafts/${bad}`)
			.auth(host.accessToken, { type: "bearer" })
			.field("values", JSON.stringify(partialValues))
			.attach("images", Buffer.from("fake"), { filename: "fake.png", contentType: "image/png" })
			.expect(422);
		expect(
			await dataSource.query("SELECT id FROM trip_form_drafts WHERE id=$1", [bad])
		).toHaveLength(0);
	});
	it("retires a form draft and removes its temporary image bytes after Trip creation", async () => {
		const { host, tripId } = await fixture();
		const id = randomUUID();
		const path = `/api/trip-drafts/${id}`;
		await request(app.getHttpServer())
			.put(path)
			.auth(host.accessToken, { type: "bearer" })
			.field("values", JSON.stringify(partialValues))
			.attach("images", image(), { filename: "first.png", contentType: "image/png" })
			.expect(200);
		for (let i = 0; i < 2; i++)
			await request(app.getHttpServer())
				.post(`${path}/complete`)
				.auth(host.accessToken, { type: "bearer" })
				.send({ tripId })
				.expect(201);
		const list = await request(app.getHttpServer())
			.get("/api/trip-drafts")
			.auth(host.accessToken, { type: "bearer" })
			.expect(200);
		expect(list.body.some((draft: { id: string }) => draft.id === id)).toBe(false);
		expect(
			await dataSource.query("SELECT id FROM trip_form_draft_images WHERE draft_id=$1", [id])
		).toEqual([]);
	});
	it("links an interrupted image submission back to its existing draft Trip", async () => {
		const { host, tripId } = await fixture();
		const id = randomUUID();
		await request(app.getHttpServer())
			.put(`/api/trip-drafts/${id}`)
			.auth(host.accessToken, { type: "bearer" })
			.field("values", JSON.stringify(partialValues))
			.field("tripId", tripId)
			.attach("images", image(), { filename: "pending.png", contentType: "image/png" })
			.expect(200);
		const restored = await request(app.getHttpServer())
			.get(`/api/trip-drafts/${id}`)
			.auth(host.accessToken, { type: "bearer" })
			.expect(200);
		expect(restored.body.tripId).toBe(tripId);
		expect(restored.body.images).toHaveLength(1);
		const list = await request(app.getHttpServer())
			.get("/api/trip-drafts")
			.auth(host.accessToken, { type: "bearer" })
			.expect(200);
		expect(list.body).toEqual(expect.arrayContaining([expect.objectContaining({ id, tripId })]));
	});
	it("applies a complete pending update atomically and rejects stale retries", async () => {
		const { host, tripId, path } = await fixture();
		const first = await upload(path, host).expect(201);
		await dataSource.query("UPDATE trips SET status='pending_approval' WHERE id=$1", [tripId]);
		const [before]: { route_id: string; updated_at: Date }[] = await dataSource.query(
			"SELECT route_id,updated_at FROM trips WHERE id=$1",
			[tripId]
		);
		const base = createPayload(before.route_id);
		const payload = {
			...base,
			title: "Final pending update",
			expectedUpdatedAt: before.updated_at.toISOString(),
			retainedImageIds: [first.body[0].id],
			waypoints: [
				base.waypoints[0],
				{
					type: "overnight",
					name: "",
					location: { type: "Point", coordinates: [108.24, 16.05] },
					plannedAt: "2026-10-02T12:00:00.000Z",
				},
				base.waypoints[1],
			],
		};
		const finalized = await request(app.getHttpServer())
			.patch(`/api/trips/${tripId}/pending-update`)
			.auth(host.accessToken, { type: "bearer" })
			.field("payload", JSON.stringify(payload))
			.attach("images", image("new"), { filename: "new.png", contentType: "image/png" })
			.expect(200);
		expect(finalized.body.title).toBe("Final pending update");
		expect(finalized.body.status).toBe("pending_approval");
		expect(finalized.body.images).toHaveLength(2);
		expect(finalized.body.waypoints).toHaveLength(3);
		await request(app.getHttpServer())
			.patch(`/api/trips/${tripId}/pending-update`)
			.auth(host.accessToken, { type: "bearer" })
			.field("payload", JSON.stringify(payload))
			.expect(409);
		const current = await request(app.getHttpServer())
			.get(path)
			.auth(host.accessToken, { type: "bearer" })
			.expect(200);
		expect(current.body).toHaveLength(2);
	});
	it("rolls back Trip fields when final image retention is invalid", async () => {
		const { host, tripId, path } = await fixture();
		const uploaded = await upload(path, host).expect(201);
		await dataSource.query("UPDATE trips SET status='pending_approval' WHERE id=$1", [tripId]);
		const [before]: { route_id: string; updated_at: Date; title: string }[] =
			await dataSource.query("SELECT route_id,updated_at,title FROM trips WHERE id=$1", [tripId]);
		const base = createPayload(before.route_id);
		const payload = {
			...base,
			title: "Must roll back",
			expectedUpdatedAt: before.updated_at.toISOString(),
			retainedImageIds: [randomUUID()],
			waypoints: [
				base.waypoints[0],
				{
					type: "overnight",
					name: "",
					location: { type: "Point", coordinates: [108.24, 16.05] },
					plannedAt: "2026-10-02T12:00:00.000Z",
				},
				base.waypoints[1],
			],
		};
		await request(app.getHttpServer())
			.patch(`/api/trips/${tripId}/pending-update`)
			.auth(host.accessToken, { type: "bearer" })
			.field("payload", JSON.stringify(payload))
			.expect(409);
		const [after]: { title: string; updated_at: Date }[] = await dataSource.query(
			"SELECT title,updated_at FROM trips WHERE id=$1",
			[tripId]
		);
		expect(after.title).toBe(before.title);
		expect(after.updated_at).toEqual(before.updated_at);
		const current = await request(app.getHttpServer())
			.get(path)
			.auth(host.accessToken, { type: "bearer" })
			.expect(200);
		expect(current.body).toEqual(uploaded.body);
	});
	it("keeps the Admin version unchanged when legacy endpoints attempt pending writes", async () => {
		const { host, tripId, path } = await fixture();
		const uploaded = await upload(path, host).expect(201);
		await dataSource.query("UPDATE trips SET status='pending_approval' WHERE id=$1", [tripId]);
		const [before]: {
			route_id: string;
			title: string;
			updated_at: Date;
			cover_image_url: string;
		}[] = await dataSource.query(
			"SELECT route_id,title,updated_at,cover_image_url FROM trips WHERE id=$1",
			[tripId]
		);
		const payload = createPayload(before.route_id);
		await request(app.getHttpServer())
			.patch(`/api/trips/${tripId}`)
			.auth(host.accessToken, { type: "bearer" })
			.send({ ...payload, title: "Must remain private" })
			.expect(409);
		await upload(path, host, image("not-finalized")).expect(409);
		await request(app.getHttpServer())
			.delete(`${path}/${uploaded.body[0].id}`)
			.auth(host.accessToken, { type: "bearer" })
			.expect(409);
		const [after]: { title: string; updated_at: Date; cover_image_url: string }[] =
			await dataSource.query("SELECT title,updated_at,cover_image_url FROM trips WHERE id=$1", [
				tripId,
			]);
		expect(after.title).toBe(before.title);
		expect(after.updated_at).toEqual(before.updated_at);
		expect(after.cover_image_url).toBe(before.cover_image_url);
		const current = await request(app.getHttpServer())
			.get(path)
			.auth(host.accessToken, { type: "bearer" })
			.expect(200);
		expect(current.body).toEqual(uploaded.body);
	});
});
