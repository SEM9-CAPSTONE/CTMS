import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { PaymentsService } from "../src/modules/bookings/payments.service";
import {
	BookingPaymentStatus,
	BookingStatus,
} from "../src/modules/profiles/entities/booking.entity";
import { UserRole } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Fixture {
	bookingId: string;
	tripId: string;
	chargeId: string;
	orderCode: number;
}
interface State {
	status: BookingStatus;
	cancelled_at: Date | null;
	seats_taken: number;
	refund_count: number;
	audit_count: number;
}

describe("PATCH /api/bookings/:bookingId/cancel (real Postgres)", () => {
	let app: INestApplication;
	let db: DataSource;
	let jwt: JwtService;
	let payments: PaymentsService;
	let owner: { id: string; token: string };
	let foreign: { id: string; token: string };
	let host: { id: string; token: string };
	const userIds: string[] = [];
	const tripIds: string[] = [];
	const routeIds: string[] = [];

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
		payments = module.get(PaymentsService);
		await assertSafeTestDatabase(db);
		owner = await account(UserRole.CAMPER);
		foreign = await account(UserRole.CAMPER);
		host = await account(UserRole.HOST);
	}, 60000);

	afterAll(async () => {
		try {
			if (db?.isInitialized) {
				await db.query(
					"DELETE FROM audit_logs WHERE target_id IN (SELECT id FROM bookings WHERE trip_id = ANY($1)) OR target_id IN (SELECT p.id FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE b.trip_id = ANY($1))",
					[tripIds]
				);
				await db.query(
					`DELETE FROM payments WHERE type = 'refund' AND booking_id IN (SELECT id FROM bookings WHERE trip_id = ANY($1))`,
					[tripIds]
				);
				await db.query("DELETE FROM trips WHERE id = ANY($1)", [tripIds]);
				await db.query("DELETE FROM equipment_catalog_items WHERE host_id = $1", [host?.id]);
				await db.query("DELETE FROM trekking_routes WHERE id = ANY($1)", [routeIds]);
				await db.query("DELETE FROM user_roles WHERE user_id = ANY($1)", [userIds]);
				await db.query("DELETE FROM users WHERE id = ANY($1)", [userIds]);
			}
		} finally {
			await app?.close();
		}
	});

	async function account(role: UserRole) {
		const id = randomUUID();
		userIds.push(id);
		await db.query(
			`INSERT INTO users (id, email, password_hash, role, status, full_name) VALUES ($1, $2, 'unused-test-hash', $3, 'active', 'Cancellation test')`,
			[id, `cancel-${id}@example.com`, role]
		);
		await db.query("INSERT INTO user_roles (user_id, role) VALUES ($1, $2)", [id, role]);
		return { id, token: jwt.sign({ sub: id, roles: [role] }) };
	}

	async function fixture(
		options: {
			status?: BookingStatus;
			paymentStatus?: BookingPaymentStatus;
			policy?: unknown;
			startsAt?: Date;
			charge?: boolean;
		} = {}
	): Promise<Fixture> {
		const routeId = randomUUID();
		const tripId = randomUUID();
		const bookingId = randomUUID();
		const chargeId = randomUUID();
		const orderCode = Date.now() + tripIds.length;
		routeIds.push(routeId);
		tripIds.push(tripId);
		await db.query(
			`INSERT INTO trekking_routes (id, host_id, name, route_geom, length_meters, difficulty, expected_duration_minutes, status)
			VALUES ($1, $2, 'Cancellation route', ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22,16.04), ST_MakePoint(108.25,16.07)),4326)::geography, 3500, 'moderate', 240, 'active')`,
			[routeId, host.id]
		);
		await db.query(
			`INSERT INTO trips (id, host_id, route_id, title, trip_type, duration_nights, starts_at, ends_at, meeting_point, booking_deadline, capacity_min, capacity_max, seats_taken, price_per_person, cancellation_policy, status)
			VALUES ($1,$2,$3,'Cancellation trip','day_trip',0,'2099-10-10T01:00:00Z','2099-10-10T10:00:00Z',ST_SetSRID(ST_MakePoint(108.22,16.04),4326)::geography,'2099-10-09T01:00:00Z',1,10,2,999,$4,'published')`,
			[
				tripId,
				host.id,
				routeId,
				{ version: 1, rules: [{ minHoursBeforeTrip: 0, refundPercent: 100 }] },
			]
		);
		await db.query(
			`INSERT INTO bookings (id,trip_id,user_id,num_people,status,payment_status,hold_expires_at,trip_starts_at_snapshot,trip_ends_at_snapshot,base_price,total_amount,cancellation_policy_snapshot)
			VALUES ($1,$2,$3,2,$4,$5,'2020-01-01T00:00:00Z',$6,'2099-10-10T10:00:00Z',999,999,$7)`,
			[
				bookingId,
				tripId,
				owner.id,
				options.status ?? BookingStatus.CONFIRMED,
				options.paymentStatus ?? BookingPaymentStatus.PAID,
				options.startsAt ?? new Date("2099-10-10T01:00:00Z"),
				options.policy === undefined
					? { version: 1, rules: [{ minHoursBeforeTrip: 0, refundPercent: 50 }] }
					: options.policy,
			]
		);
		if (options.charge !== false)
			await db.query(
				`INSERT INTO payments (id,booking_id,amount,type,status,provider_reference) VALUES ($1,$2,1.01,'charge','succeeded',$3)`,
				[chargeId, bookingId, String(orderCode)]
			);
		return { bookingId, tripId, chargeId, orderCode };
	}

	function cancel(bookingId: string, token = owner.token, body: object = {}) {
		return request(app.getHttpServer())
			.patch(`/api/bookings/${bookingId}/cancel`)
			.set("Authorization", `Bearer ${token}`)
			.send(body);
	}
	async function state(f: Fixture): Promise<State> {
		const rows: State[] = await db.query(
			`SELECT b.status,b.cancelled_at,t.seats_taken,
			(SELECT COUNT(*)::int FROM payments WHERE booking_id=b.id AND type='refund') AS refund_count,
			(SELECT COUNT(*)::int FROM audit_logs WHERE target_id=b.id AND action='booking.cancelled') AS audit_count
			FROM bookings b JOIN trips t ON t.id=b.trip_id WHERE b.id=$1`,
			[f.bookingId]
		);
		return rows[0];
	}

	it("atomically cancels using snapshot policy and actual charge, preserves members and returns minimal data", async () => {
		const f = await fixture();
		await db.query(
			`INSERT INTO booking_members (booking_id,user_id,is_primary,member_status) VALUES ($1,$2,true,'registered')`,
			[f.bookingId, owner.id]
		);
		const membersBefore = await db.query("SELECT * FROM booking_members WHERE booking_id=$1", [
			f.bookingId,
		]);
		const response = await cancel(f.bookingId, owner.token, { reason: "  changed plans  " }).expect(
			200
		);
		expect(Object.keys(response.body).sort()).toEqual([
			"bookingId",
			"cancelledAt",
			"paymentStatus",
			"refund",
			"status",
		]);
		expect(response.body).toMatchObject({
			bookingId: f.bookingId,
			status: "cancelled",
			paymentStatus: "paid",
			refund: { amount: "0.51", status: "pending" },
		});
		expect(await state(f)).toMatchObject({
			status: "cancelled",
			seats_taken: 0,
			refund_count: 1,
			audit_count: 1,
		});
		expect(
			await db.query("SELECT * FROM booking_members WHERE booking_id=$1", [f.bookingId])
		).toEqual(membersBefore);
		const refunds = await db.query(
			"SELECT parent_payment_id,provider_reference FROM payments WHERE id=$1",
			[response.body.refund.obligationId]
		);
		expect(refunds).toEqual([{ parent_payment_id: f.chargeId, provider_reference: null }]);
		const audits = await db.query('SELECT reason,"after" FROM audit_logs WHERE target_id=$1', [
			f.bookingId,
		]);
		expect(audits).toEqual([
			expect.objectContaining({
				reason: "changed plans",
				after: expect.objectContaining({
					policy: expect.objectContaining({ exactRefundPercent: "50" }),
					refund: expect.objectContaining({ rounding: "HALF_UP", amount: "0.51" }),
					seatReleaseCount: 2,
				}),
			}),
		]);
		const beforeRead = await state(f);
		await request(app.getHttpServer())
			.get(`/api/bookings/${f.bookingId}`)
			.set("Authorization", `Bearer ${owner.token}`)
			.expect(200);
		expect(await state(f)).toEqual(beforeRead);
	});

	it("replays sequential and concurrent requests without double release, refund or audit", async () => {
		const f = await fixture();
		const [first, duplicate] = await Promise.all([
			cancel(f.bookingId).expect(200),
			cancel(f.bookingId, owner.token, { reason: "different retry reason" }).expect(200),
		]);
		expect(duplicate.body).toEqual(first.body);
		await db.query(
			"UPDATE bookings SET cancellation_policy_snapshot=NULL,trip_starts_at_snapshot='2020-01-01T00:00:00Z' WHERE id=$1",
			[f.bookingId]
		);
		const replay = await cancel(f.bookingId).expect(200);
		expect(replay.body).toEqual(first.body);
		expect(await state(f)).toMatchObject({ seats_taken: 0, refund_count: 1, audit_count: 1 });
		await db.query("UPDATE payments SET status='failed' WHERE id=$1", [
			first.body.refund.obligationId,
		]);
		const failedRefund = await cancel(f.bookingId).expect(200);
		expect(failedRefund.body.refund.status).toBe("failed");
		expect(failedRefund.body.status).toBe("cancelled");
	});

	it("supports free confirmed cancellation and preserves reconfirmation capacity", async () => {
		const f = await fixture({ paymentStatus: BookingPaymentStatus.NOT_REQUIRED, charge: false });
		await db.query(
			`INSERT INTO bookings (trip_id,user_id,num_people,status,payment_status) VALUES ($1,$2,3,'pending_reconfirmation','paid')`,
			[f.tripId, foreign.id]
		);
		await db.query("UPDATE trips SET seats_taken=5 WHERE id=$1", [f.tripId]);
		const response = await cancel(f.bookingId).expect(200);
		expect(response.body.refund).toBeNull();
		expect(await state(f)).toMatchObject({
			status: "cancelled",
			seats_taken: 3,
			refund_count: 0,
			audit_count: 1,
		});
	});

	it("supports zero refund without inserting a zero-value Payment", async () => {
		const f = await fixture({
			policy: { version: 1, rules: [{ minHoursBeforeTrip: 0, refundPercent: 0 }] },
		});
		expect((await cancel(f.bookingId).expect(200)).body.refund).toBeNull();
		expect((await state(f)).refund_count).toBe(0);
	});

	it("caps the additional obligation after existing pending and succeeded refunds", async () => {
		const f = await fixture();
		await db.query(
			`INSERT INTO payments (booking_id,amount,type,status,parent_payment_id) VALUES ($1,0.20,'refund','pending',$2),($1,0.30,'refund','succeeded',$2),($1,0.99,'refund','failed',$2)`,
			[f.bookingId, f.chargeId]
		);
		expect((await cancel(f.bookingId).expect(200)).body.refund.amount).toBe("0.01");
	});

	it("rejects non-owners including replay, wrong roles, missing auth and malformed/unknown ids", async () => {
		const f = await fixture();
		const before = await state(f);
		await cancel(f.bookingId, foreign.token).expect(403);
		await cancel(f.bookingId, host.token).expect(403);
		await request(app.getHttpServer())
			.patch(`/api/bookings/${f.bookingId}/cancel`)
			.send({})
			.expect(401);
		await cancel("bad-id").expect(422);
		await cancel(randomUUID()).expect(404);
		expect(await state(f)).toEqual(before);
		await cancel(f.bookingId).expect(200);
		const after = await state(f);
		await cancel(f.bookingId, foreign.token).expect(403);
		expect(await state(f)).toEqual(after);
	});

	it("rejects an inactive caller", async () => {
		const f = await fixture();
		const before = await state(f);
		await db.query("UPDATE users SET status='suspended' WHERE id=$1", [owner.id]);
		try {
			await cancel(f.bookingId).expect(401);
			expect(await state(f)).toEqual(before);
		} finally {
			await db.query("UPDATE users SET status='active' WHERE id=$1", [owner.id]);
		}
	});

	it.each(["actor", "cancelledAt", "refundPercent", "refundAmount", "status", "paymentStatus"])(
		"rejects client-owned attempt to set %s",
		async (field) => {
			const f = await fixture();
			const before = await state(f);
			await cancel(f.bookingId, owner.token, { [field]: "forged" }).expect(422);
			expect(await state(f)).toEqual(before);
		}
	);

	it.each([
		BookingStatus.PENDING_PAYMENT,
		BookingStatus.PENDING_RECONFIRMATION,
		BookingStatus.EXPIRED,
		BookingStatus.COMPLETED,
	])("rejects %s without expiry or release", async (status) => {
		const f = await fixture({
			status,
			paymentStatus:
				status === BookingStatus.PENDING_PAYMENT
					? BookingPaymentStatus.UNPAID
					: BookingPaymentStatus.PAID,
		});
		const before = await state(f);
		await cancel(f.bookingId).expect(409);
		expect(await state(f)).toEqual(before);
	});

	it.each([null, { refundHours: 48 }, { version: 1, rules: [] }])(
		"rejects unsupported policy %p without writes",
		async (policy) => {
			const f = await fixture({ policy });
			const before = await state(f);
			await cancel(f.bookingId).expect(409);
			expect(await state(f)).toEqual(before);
		}
	);

	it("rejects after Trip start and inconsistent capacity without writes", async () => {
		const past = await fixture({ startsAt: new Date("2020-01-01T00:00:00Z") });
		const pastState = await state(past);
		await cancel(past.bookingId).expect(409);
		expect(await state(past)).toEqual(pastState);
		const f = await fixture();
		await db.query("UPDATE trips SET seats_taken=1 WHERE id=$1", [f.tripId]);
		const before = await state(f);
		await cancel(f.bookingId).expect(409);
		expect(await state(f)).toEqual(before);
	});

	it("rejects ambiguous active equipment atomically, and does not touch already cancelled reservations", async () => {
		const f = await fixture();
		const equipmentId = randomUUID();
		const itemId = randomUUID();
		await db.query(
			`INSERT INTO equipment_catalog_items (id,host_id,name,category,quantity_total,rental_price_per_day,status) VALUES ($1,$2,'Test tent','shelter',5,1,'active')`,
			[equipmentId, host.id]
		);
		await db.query(
			`INSERT INTO booking_items (id,booking_id,item_type,equipment_catalog_item_id,quantity,unit_price,rental_days,total_price) VALUES ($1,$2,'equipment',$3,1,1,1,1)`,
			[itemId, f.bookingId, equipmentId]
		);
		await db.query(
			`INSERT INTO equipment_reservations (booking_item_id,equipment_catalog_item_id,quantity,rental_start_date,rental_end_date) VALUES ($1,$2,1,'2099-10-10','2099-10-10')`,
			[itemId, equipmentId]
		);
		const before = await state(f);
		await cancel(f.bookingId).expect(409);
		expect(await state(f)).toEqual(before);
		await db.query(
			"UPDATE equipment_reservations SET status='cancelled' WHERE booking_item_id=$1",
			[itemId]
		);
		const reservationBefore = await db.query(
			"SELECT * FROM equipment_reservations WHERE booking_item_id=$1",
			[itemId]
		);
		await cancel(f.bookingId).expect(200);
		expect(
			await db.query("SELECT * FROM equipment_reservations WHERE booking_item_id=$1", [itemId])
		).toEqual(reservationBefore);
	});

	it.each(["audit", "refund"])(
		"rolls back Booking, seats, metadata and refund on %s persistence failure",
		async (failure) => {
			const f = await fixture();
			const before = await state(f);
			const table = failure === "audit" ? "audit_logs" : "payments";
			const condition =
				failure === "audit"
					? `NEW.action = 'booking.cancelled' AND NEW.target_id = '${f.bookingId}'::uuid`
					: `NEW.type = 'refund' AND NEW.booking_id = '${f.bookingId}'::uuid`;
			await db.query(
				`CREATE FUNCTION ctms174_test_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'forced cancellation persistence failure'; END IF; RETURN NEW; END $$`
			);
			try {
				await db.query(
					`CREATE TRIGGER ctms174_test_reject BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION ctms174_test_reject()`
				);
				await cancel(f.bookingId).expect(500);
				expect(await state(f)).toEqual(before);
			} finally {
				await db.query(`DROP TRIGGER IF EXISTS ctms174_test_reject ON ${table}`);
				await db.query("DROP FUNCTION ctms174_test_reject()");
			}
		}
	);

	it("does not restore cancelled participation when another successful charge arrives later", async () => {
		const f = await fixture();
		await cancel(f.bookingId).expect(200);
		const lateId = randomUUID();
		const lateOrder = f.orderCode + 1000000;
		await db.query(
			`INSERT INTO payments (id,booking_id,amount,type,status,provider_reference) VALUES ($1,$2,1.01,'charge','pending',$3)`,
			[lateId, f.bookingId, String(lateOrder)]
		);
		await payments.handlePayOSWebhook({
			orderCode: lateOrder,
			amount: 1.01,
			description: "Test late charge",
			accountNumber: "9704",
			reference: lateId,
			transactionDateTime: "2030-01-01T00:00:00Z",
			currency: "VND",
			paymentLinkId: "test",
			code: "00",
			desc: "success",
		});
		expect(await state(f)).toMatchObject({
			status: "cancelled",
			seats_taken: 0,
			refund_count: 1,
			audit_count: 1,
		});
		await request(app.getHttpServer())
			.post(`/api/bookings/${f.bookingId}/members`)
			.set("Authorization", `Bearer ${owner.token}`)
			.set("Idempotency-Key", randomUUID())
			.send({ members: [{ userId: foreign.id }] })
			.expect(409);
	});

	it("replays legacy cancelled Bookings without fabricating metadata", async () => {
		const f = await fixture({ status: BookingStatus.CANCELLED });
		const before = await state(f);
		expect((await cancel(f.bookingId).expect(200)).body).toMatchObject({
			status: "cancelled",
			cancelledAt: null,
			refund: null,
		});
		expect(await state(f)).toEqual(before);
	});
});
