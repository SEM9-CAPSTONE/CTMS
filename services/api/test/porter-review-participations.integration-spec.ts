import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { PorterReviewsRepository } from "../src/modules/porter-reviews/porter-reviews.repository";
import { User, UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("CTMS-390 own completed review participations", () => {
	let app: INestApplication;
	let db: DataSource;
	let jwt: JwtService;
	let repository: PorterReviewsRepository;
	let owner: User;
	let guest: User;
	let outsider: User;
	let host: User;
	let porter: User;
	let now: Date;
	const users: string[] = [];
	const routeId = randomUUID();
	const tripId = randomUUID();
	const bookingIds = Array.from({ length: 4 }, () => randomUUID());
	const auth = (user: User) => `Bearer ${jwt.sign({ sub: user.id, roles: [user.role] })}`;
	const list = (actor = guest, query: Record<string, unknown> = {}) =>
		request(app.getHttpServer())
			.get("/api/porter-reviews/participations")
			.set("Authorization", auth(actor))
			.query(query);
	const context = (bookingId = bookingIds[0]) =>
		request(app.getHttpServer())
			.get(`/api/bookings/${bookingId}/porter-reviews/context`)
			.set("Authorization", auth(guest));
	async function account(role: UserRole) {
		const user = await db.getRepository(User).save({
			email: `review-list-${randomUUID()}@example.test`,
			fullName: "Nguyễn Văn An",
			role,
			status: UserStatus.ACTIVE,
			passwordHash: "unused",
		});
		users.push(user.id);
		await db.query("INSERT INTO user_roles(user_id,role) VALUES ($1,$2)", [user.id, role]);
		return user;
	}
	beforeAll(async () => {
		const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
		repository = module.get(PorterReviewsRepository);
		await assertSafeTestDatabase(db);
		owner = await account(UserRole.CAMPER);
		guest = await account(UserRole.CAMPER);
		outsider = await account(UserRole.CAMPER);
		host = await account(UserRole.HOST);
		porter = await account(UserRole.PORTER);
		now = await repository.now(db.manager);
		await db.query(
			`INSERT INTO trekking_routes(id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status)
			VALUES ($1,$2,'Tuyến ven biển Sơn Trà',ST_GeogFromText('LINESTRING(108.22 16.04,108.25 16.07)'),3500,'moderate',240,'active')`,
			[routeId, host.id]
		);
		await db.query(
			`INSERT INTO trips(id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,seats_taken,price_per_person,status)
			VALUES ($1,$2,$3,'Khám phá bán đảo Sơn Trà','day_trip',0,now()-interval '2 days',now()-interval '1 day',ST_GeogFromText('POINT(108.22 16.04)'),now()-interval '3 days',1,20,2,0,'completed')`,
			[tripId, host.id, routeId]
		);
		await db.query("INSERT INTO trip_porters(trip_id,porter_id,status) VALUES ($1,$2,'assigned')", [
			tripId,
			porter.id,
		]);
		for (const bookingId of bookingIds) {
			await db.query(
				`INSERT INTO bookings(id,trip_id,user_id,num_people,status,payment_status,completed_at)
				VALUES ($1,$2,$3,2,'completed','not_required',$4)`,
				[bookingId, tripId, owner.id, new Date(now.getTime() - 3600000)]
			);
			await db.query(
				`INSERT INTO booking_members(id,booking_id,user_id,is_primary,member_status,checked_in_at)
				VALUES ($1,$2,$3,true,'joined',now()-interval '2 days'),($4,$2,$5,false,'joined',now()-interval '2 days')`,
				[randomUUID(), bookingId, owner.id, randomUUID(), guest.id]
			);
		}
	}, 90000);
	beforeEach(async () => {
		await db.query(
			"UPDATE bookings SET status='completed',completed_at=$2 WHERE id=ANY($1::uuid[])",
			[bookingIds, new Date(now.getTime() - 3600000)]
		);
		await db.query(
			"UPDATE booking_members SET member_status='joined',checked_in_at=now()-interval '2 days',left_at=NULL WHERE booking_id=ANY($1::uuid[])",
			[bookingIds]
		);
		await db.query("UPDATE trip_porters SET status='assigned' WHERE trip_id=$1", [tripId]);
		jest.spyOn(repository, "now").mockResolvedValue(now);
	});
	afterEach(() => jest.restoreAllMocks());
	afterAll(async () => {
		if (db?.isInitialized) {
			await assertSafeTestDatabase(db);
			await db.query("DELETE FROM booking_members WHERE booking_id=ANY($1::uuid[])", [bookingIds]);
			await db.query("DELETE FROM bookings WHERE id=ANY($1::uuid[])", [bookingIds]);
			await db.query("DELETE FROM trip_porters WHERE trip_id=$1", [tripId]);
			await db.query("DELETE FROM trips WHERE id=$1", [tripId]);
			await db.query("DELETE FROM trekking_routes WHERE id=$1", [routeId]);
			await db.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [users]);
		}
		await app?.close();
	});
	it("lets a linked guest who does not own the booking discover their completed participation", async () => {
		const response = await list().expect(200);
		expect(response.body.items).toHaveLength(4);
		expect(response.body.items[0]).toMatchObject({
			tripId,
			tripTitle: "Khám phá bán đảo Sơn Trà",
			eligible: true,
		});
		expect(response.body.serverTime).toBe(now.toISOString());
		expect((await list(owner).expect(200)).body.items).toHaveLength(4);
	});
	it("does not expose another account's participation or allow a userId override", async () => {
		expect((await list(outsider).expect(200)).body.items).toEqual([]);
		await list(outsider, { userId: guest.id }).expect(422);
	});
	it("returns only the approved projection, without money, other members or review text", async () => {
		const response = await list().expect(200);
		expect(Object.keys(response.body.items[0]).sort()).toEqual(
			[
				"bookingId",
				"tripId",
				"tripTitle",
				"startsAt",
				"completedAt",
				"expiresAt",
				"eligible",
				"reason",
			].sort()
		);
	});
	it("uses fixed completion ordering with deterministic ties and bounded pagination", async () => {
		await db.query("UPDATE bookings SET completed_at=$2 WHERE id=$1", [
			bookingIds[0],
			new Date(now.getTime() - 1000),
		]);
		const first = await list(guest, { page: 1, limit: 2 }).expect(200);
		const second = await list(guest, { page: 2, limit: 2 }).expect(200);
		expect(first.body).toMatchObject({ page: 1, limit: 2, hasMore: true });
		expect(second.body.hasMore).toBe(false);
		const ids = [...first.body.items, ...second.body.items].map(
			(item: { bookingId: string }) => item.bookingId
		);
		expect(ids).toEqual([bookingIds[0], ...bookingIds.slice(1).sort()]);
		await list(guest, { limit: 51 }).expect(422);
		await list(guest, { page: 0 }).expect(422);
	});
	it("excludes unfinished or future completion", async () => {
		await db.query("UPDATE bookings SET status='confirmed' WHERE id=$1", [bookingIds[0]]);
		await db.query("UPDATE bookings SET completed_at=$2 WHERE id=$1", [
			bookingIds[1],
			new Date(now.getTime() + 1000),
		]);
		expect((await list().expect(200)).body.items).toHaveLength(2);
	});
	it.each(["member_status='no_show'", "checked_in_at=NULL", "left_at=now()"])(
		"excludes incomplete participation: %s",
		async (condition) => {
			await db.query(`UPDATE booking_members SET ${condition} WHERE booking_id=$1 AND user_id=$2`, [
				bookingIds[0],
				guest.id,
			]);
			expect((await list().expect(200)).body.items).toHaveLength(3);
		}
	);
	it.each(["open", "expired", "no-assignment"])(
		"agrees with context eligibility and server time: %s",
		async (state) => {
			if (state === "expired")
				await db.query("UPDATE bookings SET completed_at=$2 WHERE id=$1", [
					bookingIds[0],
					new Date(now.getTime() - 86400000),
				]);
			if (state === "no-assignment")
				await db.query("UPDATE trip_porters SET status='unassigned' WHERE trip_id=$1", [tripId]);
			const response = await list().expect(200);
			const detail = await context().expect(200);
			const item = response.body.items.find(
				(entry: { bookingId: string }) => entry.bookingId === bookingIds[0]
			);
			expect(item).toMatchObject({
				eligible: detail.body.eligible,
				reason: detail.body.reason,
				expiresAt: detail.body.expiresAt,
			});
			expect(response.body.serverTime).toBe(detail.body.serverTime);
		}
	);
	it("requires authenticated Camper access", async () => {
		await request(app.getHttpServer()).get("/api/porter-reviews/participations").expect(401);
		await list(host).expect(403);
	});
});
