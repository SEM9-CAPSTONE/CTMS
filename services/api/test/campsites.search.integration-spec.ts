import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { CampsiteStatus } from "../src/modules/campsites/entities/campsite.entity";
import { ZoneStatus } from "../src/modules/campsites/entities/zone.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import {
	CampsiteFixtureTracker,
	cleanupCampsiteFixtures,
	createFixtureCampsite,
	createFixtureHost,
	createFixtureImage,
	createFixtureZone,
} from "./support/campsite-fixtures";

interface TestAccount {
	id: string;
	accessToken: string;
}

describe("Search Campsites GET /campsites (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let tracker: CampsiteFixtureTracker;
	let cleanupUserIds: string[];
	let hostId: string;
	let camper: TestAccount;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		await app?.close();
	});

	beforeEach(async () => {
		tracker = new CampsiteFixtureTracker();
		cleanupUserIds = [];
		hostId = await createFixtureHost(dataSource, tracker);
		camper = await createAccount("camper", "active");
	});

	afterEach(async () => {
		await cleanupCampsiteFixtures(dataSource, tracker);
		if (cleanupUserIds.length > 0) {
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [
				cleanupUserIds,
			]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [cleanupUserIds]);
		}
	});

	async function createAccount(
		role: "camper" | "host" | "admin",
		status: "active" | "pending_verification" | "suspended"
	): Promise<TestAccount> {
		const sequence = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
		const email = `e2e-campsites-${role}-${sequence}@example.com`;
		const passwordHash = await hash("S3curePass!", 10);
		const rows = (await dataSource.query(
			`INSERT INTO "users" ("email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, $4, $5) RETURNING "id"`,
			[email, passwordHash, role, status, "Test Account"]
		)) as Array<{ id: string }>;
		const id = rows[0].id;
		await dataSource.query(
			`INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2) ON CONFLICT ("user_id", "role") DO NOTHING`,
			[id, role]
		);
		cleanupUserIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	function search(token: string | undefined, query: Record<string, unknown> = {}) {
		const req = request(app.getHttpServer()).get("/api/campsites").query(query);
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	}

	let provinceCounter = 0;
	/** A fresh, collision-free `province` value per call, so tests can run without interfering with each other's result sets even though `province` is a broad filter. */
	function uniqueProvince(): string {
		provinceCounter += 1;
		return `CTMS77FIX-${Date.now()}-${provinceCounter}`;
	}

	describe("security (BR-202, DG-NEW-AUTH)", () => {
		it("rejects a request with no token (401)", async () => {
			await search(undefined).expect(401);
		});

		it("rejects a non-Camper role even when authenticated (403)", async () => {
			const host = await createAccount("host", "active");
			await search(host.accessToken).expect(403);

			const admin = await createAccount("admin", "active");
			await search(admin.accessToken).expect(403);
		});

		it("rejects a Camper whose account is not active (401), for both pending_verification and suspended", async () => {
			const pending = await createAccount("camper", "pending_verification");
			await search(pending.accessToken).expect(401);

			const suspended = await createAccount("camper", "suspended");
			await search(suspended.accessToken).expect(401);
		});
	});

	describe("status invariant (BR-045/047/234, DTO+repository double lock)", () => {
		it("returns only active campsites, hiding draft/pending_approval/suspended/closed/archived", async () => {
			const province = uniqueProvince();
			const active = await createFixtureCampsite(dataSource, tracker, {
				hostId,
				province,
				status: CampsiteStatus.ACTIVE,
			});
			await createFixtureCampsite(dataSource, tracker, {
				hostId,
				province,
				status: CampsiteStatus.DRAFT,
			});
			await createFixtureCampsite(dataSource, tracker, {
				hostId,
				province,
				status: CampsiteStatus.PENDING_APPROVAL,
			});
			await createFixtureCampsite(dataSource, tracker, {
				hostId,
				province,
				status: CampsiteStatus.SUSPENDED,
			});
			await createFixtureCampsite(dataSource, tracker, {
				hostId,
				province,
				status: CampsiteStatus.CLOSED,
			});
			await createFixtureCampsite(dataSource, tracker, {
				hostId,
				province,
				status: CampsiteStatus.ARCHIVED,
			});

			const res = await search(camper.accessToken, { province }).expect(200);

			expect(res.body.items).toHaveLength(1);
			expect(res.body.items[0].id).toBe(active);
			expect(res.body.pagination.total).toBe(1);
		});

		it("rejects any status value other than active with 422, never widening the result set", async () => {
			const res = await search(camper.accessToken, { status: "draft" }).expect(422);
			expect(res.body.statusCode).toBe(422);
		});
	});

	describe("amenities ANY-match + Zone.status DG-NEW + no duplicate campsite", () => {
		it("matches a campsite with ANY requested amenity on ANY zone, returned exactly once even with multiple matching zones", async () => {
			const province = uniqueProvince();
			const multiZone = await createFixtureCampsite(dataSource, tracker, { hostId, province });
			await createFixtureZone(dataSource, multiZone, {
				amenities: ["wifi", "toilet"],
				basePrice: "100.00",
			});
			await createFixtureZone(dataSource, multiZone, { amenities: ["bbq"], basePrice: "200.00" });

			const res = await search(camper.accessToken, { province, amenities: "wifi,bbq" }).expect(200);

			const ids = res.body.items.map((item: { id: string }) => item.id);
			expect(ids.filter((id: string) => id === multiZone)).toHaveLength(1);
		});

		it("excludes a campsite with no overlapping amenity", async () => {
			const province = uniqueProvince();
			const noMatch = await createFixtureCampsite(dataSource, tracker, { hostId, province });
			await createFixtureZone(dataSource, noMatch, { amenities: ["parking"] });

			const res = await search(camper.accessToken, { province, amenities: ["wifi"] }).expect(200);

			expect(res.body.items.map((item: { id: string }) => item.id)).not.toContain(noMatch);
		});

		it("DG-NEW: excludes a campsite whose only amenity-matching zone is closed", async () => {
			const province = uniqueProvince();
			const closedZoneOnly = await createFixtureCampsite(dataSource, tracker, { hostId, province });
			await createFixtureZone(dataSource, closedZoneOnly, {
				amenities: ["wifi"],
				status: ZoneStatus.CLOSED,
			});

			const res = await search(camper.accessToken, { province, amenities: ["wifi"] }).expect(200);

			expect(res.body.items.map((item: { id: string }) => item.id)).not.toContain(closedZoneOnly);
		});

		it("an omitted amenities filter does not exclude anything (empty filter != impossible condition)", async () => {
			const province = uniqueProvince();
			const campsite = await createFixtureCampsite(dataSource, tracker, { hostId, province });
			await createFixtureZone(dataSource, campsite, { amenities: ["parking"] });

			const res = await search(camper.accessToken, { province }).expect(200);

			expect(res.body.items.map((item: { id: string }) => item.id)).toContain(campsite);
		});
	});

	describe("zone base price range (BR-046)", () => {
		it("matches a campsite with at least one zone's basePrice inside [minPrice, maxPrice] (inclusive)", async () => {
			const province = uniqueProvince();
			const inRange = await createFixtureCampsite(dataSource, tracker, { hostId, province });
			await createFixtureZone(dataSource, inRange, { basePrice: "200.00" });
			const outOfRange = await createFixtureCampsite(dataSource, tracker, { hostId, province });
			await createFixtureZone(dataSource, outOfRange, { basePrice: "50.00" });

			const res = await search(camper.accessToken, {
				province,
				minPrice: 150,
				maxPrice: 300,
			}).expect(200);

			const ids = res.body.items.map((item: { id: string }) => item.id);
			expect(ids).toContain(inRange);
			expect(ids).not.toContain(outOfRange);
		});

		it("minPrice > maxPrice deterministically returns an empty result, not an error", async () => {
			const province = uniqueProvince();
			const campsite = await createFixtureCampsite(dataSource, tracker, { hostId, province });
			await createFixtureZone(dataSource, campsite, { basePrice: "100.00" });

			const res = await search(camper.accessToken, {
				province,
				minPrice: 300,
				maxPrice: 100,
			}).expect(200);

			expect(res.body.items).toHaveLength(0);
			expect(res.body.pagination.total).toBe(0);
		});
	});

	describe("province/city filter (case-insensitive exact match)", () => {
		it("matches regardless of casing but rejects a partial/substring value", async () => {
			const province = uniqueProvince();
			const campsite = await createFixtureCampsite(dataSource, tracker, {
				hostId,
				province,
				city: "SpecificCity",
			});

			const caseInsensitive = await search(camper.accessToken, {
				province: province.toLowerCase(),
				city: "SPECIFICCITY",
			}).expect(200);
			expect(caseInsensitive.body.items.map((item: { id: string }) => item.id)).toContain(campsite);

			const substring = await search(camper.accessToken, { province: province.slice(0, 5) }).expect(
				200
			);
			expect(substring.body.items).toHaveLength(0);
		});
	});

	describe("response contract (BR-048)", () => {
		it("returns id/name/location/coverImage(lowest display_order)/activeRoutes:[]", async () => {
			const province = uniqueProvince();
			const campsite = await createFixtureCampsite(dataSource, tracker, {
				hostId,
				province,
				city: "ContractCity",
				latitude: "12.345678",
				longitude: "109.876543",
			});
			await createFixtureImage(dataSource, campsite, {
				url: "https://example.com/second.jpg",
				displayOrder: 2,
			});
			await createFixtureImage(dataSource, campsite, {
				url: "https://example.com/first.jpg",
				displayOrder: 1,
			});

			const res = await search(camper.accessToken, { province }).expect(200);

			expect(res.body.items).toEqual([
				{
					id: campsite,
					name: expect.any(String),
					location: {
						province,
						city: "ContractCity",
						latitude: 12.345678,
						longitude: 109.876543,
					},
					coverImage: "https://example.com/first.jpg",
					activeRoutes: [],
				},
			]);
		});

		it("returns coverImage: null for a campsite with no images", async () => {
			const province = uniqueProvince();
			await createFixtureCampsite(dataSource, tracker, { hostId, province });

			const res = await search(camper.accessToken, { province }).expect(200);

			expect(res.body.items[0].coverImage).toBeNull();
		});
	});

	describe("pagination (campsite-accurate, not joined-row-accurate)", () => {
		it("paginates by distinct campsite even when campsites have multiple zones", async () => {
			const province = uniqueProvince();
			const ids: string[] = [];
			for (let i = 0; i < 3; i++) {
				const id = await createFixtureCampsite(dataSource, tracker, { hostId, province });
				await createFixtureZone(dataSource, id, { basePrice: "100.00" });
				await createFixtureZone(dataSource, id, { basePrice: "150.00" });
				ids.push(id);
			}

			const page1 = await search(camper.accessToken, { province, page: 1, limit: 2 }).expect(200);
			const page2 = await search(camper.accessToken, { province, page: 2, limit: 2 }).expect(200);

			expect(page1.body.items).toHaveLength(2);
			expect(page2.body.items).toHaveLength(1);
			expect(page1.body.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });

			const page1Ids = page1.body.items.map((item: { id: string }) => item.id);
			const page2Ids = page2.body.items.map((item: { id: string }) => item.id);
			expect(page1Ids.some((id: string) => page2Ids.includes(id))).toBe(false);
			expect([...page1Ids, ...page2Ids].sort()).toEqual([...ids].sort());
		});
	});
});
