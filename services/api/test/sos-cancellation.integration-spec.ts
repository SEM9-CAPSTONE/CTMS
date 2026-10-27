import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { AuditLog } from "../src/modules/auth/entities/audit-log.entity";
import { BookingMemberStatus } from "../src/modules/bookings/booking-member-status.enum";
import { BookingStatus } from "../src/modules/profiles/entities/booking.entity";
import { SosAlert } from "../src/modules/sos/entities/sos-alert.entity";
import { EmergencyType, SosErrorCode, SosStatus } from "../src/modules/sos/sos.enums";
import { TrekkingRouteStatus } from "../src/modules/trekking-routes/entities/trekking-route.entity";
import { TripStatus } from "../src/modules/trips/entities/trip.entity";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

describe("SOS Accidental Cancellation (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	const bookingIds: string[] = [];
	const sosIds: string[] = [];

	let host: Account;
	let camper: Account;
	let otherCamper: Account;
	let outsider: Account;
	let routeId: string;
	let tripId: string;

	beforeAll(async () => {
		jest.setTimeout(60_000);
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
		await assertSafeTestDatabase(dataSource);
		await createFixture();
	}, 60_000);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			if (sosIds.length > 0) {
				await dataSource.query(
					`DELETE FROM "audit_logs" WHERE "target_type" = 'sos_alert' AND "target_id" = ANY($1)`,
					[sosIds]
				);
				await dataSource.query('DELETE FROM "sos_alerts" WHERE "id" = ANY($1)', [sosIds]);
			}
			if (bookingIds.length > 0) {
				await dataSource.query('DELETE FROM "booking_members" WHERE "booking_id" = ANY($1)', [
					bookingIds,
				]);
				await dataSource.query('DELETE FROM "bookings" WHERE "id" = ANY($1)', [bookingIds]);
			}
			if (tripIds.length > 0) {
				await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
			}
			if (routeIds.length > 0) {
				await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
			}
			if (userIds.length > 0) {
				await dataSource.query('DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1)', [userIds]);
				await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
				await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
			}
		}
		await app?.close();
	});

	async function createAccount(role: UserRole, label: string): Promise<Account> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[
				id,
				`sos-${label}-${id}@example.com`,
				await hash("P@ssword123", 4),
				role,
				UserStatus.ACTIVE,
				`SOS ${label}`,
			]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createFixture(): Promise<void> {
		host = await createAccount(UserRole.HOST, "host");
		camper = await createAccount(UserRole.CAMPER, "camper");
		otherCamper = await createAccount(UserRole.CAMPER, "other-camper");
		outsider = await createAccount(UserRole.CAMPER, "outsider");

		routeId = randomUUID();
		routeIds.push(routeId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" (
				"id", "host_id", "name", "route_geom", "length_meters", "difficulty",
				"expected_duration_minutes", "status"
			 ) VALUES (
				$1, $2, 'SOS Route',
				ST_SetSRID(ST_MakeLine(ST_MakePoint(108.2, 16.05), ST_MakePoint(108.22, 16.07)), 4326)::geography,
				2000, 'moderate', 120, $3
			 )`,
			[routeId, host.id, TrekkingRouteStatus.ACTIVE]
		);

		tripId = randomUUID();
		tripIds.push(tripId);
		const start = new Date(Date.now() - 3600_000);
		await dataSource.query(
			`INSERT INTO "trips" (
				"id", "host_id", "route_id", "title", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min",
				"capacity_max", "seats_taken", "price_per_person", "status"
			 ) VALUES (
				$1, $2, $3, 'Active SOS Trip', 'day_trip', 0, $4, $4::timestamptz + interval '8 hours',
				ST_SetSRID(ST_MakePoint(108.2, 16.05), 4326)::geography,
				$4::timestamptz - interval '1 day', 1, 20, 2, 0, $5
			 )`,
			[tripId, host.id, routeId, start, TripStatus.ONGOING]
		);

		// Booking for camper
		const bookingId1 = randomUUID();
		bookingIds.push(bookingId1);
		await dataSource.query(
			`INSERT INTO "bookings" (
				"id", "trip_id", "user_id", "num_people", "total_amount", "status"
			 ) VALUES ($1, $2, $3, 1, 0, $4)`,
			[bookingId1, tripId, camper.id, BookingStatus.CONFIRMED]
		);
		await dataSource.query(
			`INSERT INTO "booking_members" (
				"id", "booking_id", "user_id", "is_primary", "member_status", "checked_in_at"
			 ) VALUES ($1, $2, $3, true, $4, now())`,
			[randomUUID(), bookingId1, camper.id, BookingMemberStatus.JOINED]
		);

		// Booking for otherCamper
		const bookingId2 = randomUUID();
		bookingIds.push(bookingId2);
		await dataSource.query(
			`INSERT INTO "bookings" (
				"id", "trip_id", "user_id", "num_people", "total_amount", "status"
			 ) VALUES ($1, $2, $3, 1, 0, $4)`,
			[bookingId2, tripId, otherCamper.id, BookingStatus.CONFIRMED]
		);
		await dataSource.query(
			`INSERT INTO "booking_members" (
				"id", "booking_id", "user_id", "is_primary", "member_status", "checked_in_at"
			 ) VALUES ($1, $2, $3, true, $4, now())`,
			[randomUUID(), bookingId2, otherCamper.id, BookingMemberStatus.JOINED]
		);
	}

	it("Happy path: Camper triggers SOS and then cancels it within policy (BR-258, BR-191)", async () => {
		// 1. Camper creates SOS
		const createRes = await request(app.getHttpServer())
			.post(`/api/trips/${tripId}/sos`)
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.send({
				emergencyType: EmergencyType.MEDICAL,
				location: { latitude: 16.052, longitude: 108.205 },
				batteryLevel: 85,
				eventTime: new Date().toISOString(),
			});

		expect(createRes.status).toBe(201);
		expect(createRes.body.status).toBe(SosStatus.ACTIVE);
		const sosId = createRes.body.id;
		sosIds.push(sosId);

		// 2. Camper cancels the accidental SOS
		const cancelReason = "False alarm, accidentally pressed while checking bag";
		const cancelRes = await request(app.getHttpServer())
			.patch(`/api/trips/${tripId}/sos/${sosId}/cancel`)
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.send({ reason: cancelReason });

		expect(cancelRes.status).toBe(200);
		expect(cancelRes.body.id).toBe(sosId);
		expect(cancelRes.body.status).toBe(SosStatus.CANCELLED);
		expect(cancelRes.body.cancelledBy).toBe(camper.id);
		expect(cancelRes.body.cancelledAt).toBeTruthy();
		expect(cancelRes.body.cancellationReason).toBe(cancelReason);

		// 3. Verify Database persistence (No deletion - BR-258 invariant)
		const savedAlert = await dataSource.getRepository(SosAlert).findOneBy({ id: sosId });
		expect(savedAlert).not.toBeNull();
		expect(savedAlert?.status).toBe(SosStatus.CANCELLED);
		expect(savedAlert?.cancelledBy).toBe(camper.id);
		expect(savedAlert?.cancellationReason).toBe(cancelReason);
		expect(savedAlert?.cancelledAt).not.toBeNull();

		// 4. Verify Audit Log entry (BR-191)
		const auditLog = await dataSource.getRepository(AuditLog).findOneBy({
			targetType: "sos_alert",
			targetId: sosId,
			action: "SOS_CANCELLED",
		});
		expect(auditLog).not.toBeNull();
		expect(auditLog?.actorId).toBe(camper.id);
		expect(auditLog?.reason).toBe(cancelReason);
	});

	it("Rejects cancellation if SOS is already CANCELLED (HTTP 409 Conflict)", async () => {
		// 1. Camper creates SOS
		const createRes = await request(app.getHttpServer())
			.post(`/api/trips/${tripId}/sos`)
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.send({
				emergencyType: EmergencyType.INJURY,
				eventTime: new Date().toISOString(),
			});

		const sosId = createRes.body.id;
		sosIds.push(sosId);

		// 2. First cancellation succeeds
		await request(app.getHttpServer())
			.patch(`/api/trips/${tripId}/sos/${sosId}/cancel`)
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.send({ reason: "First cancellation" })
			.expect(200);

		// 3. Second cancellation fails with 409
		const repeatRes = await request(app.getHttpServer())
			.patch(`/api/trips/${tripId}/sos/${sosId}/cancel`)
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.send({ reason: "Duplicate cancellation" });

		expect(repeatRes.status).toBe(409);
		expect(repeatRes.body.error).toBe(SosErrorCode.SOS_ALREADY_CANCELLED);
	});

	it("Rejects cancellation by a non-sender (HTTP 403 Forbidden)", async () => {
		// 1. Camper creates SOS
		const createRes = await request(app.getHttpServer())
			.post(`/api/trips/${tripId}/sos`)
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.send({
				emergencyType: EmergencyType.LOST,
				eventTime: new Date().toISOString(),
			});

		const sosId = createRes.body.id;
		sosIds.push(sosId);

		// 2. Other Camper tries to cancel Camper's SOS
		const failRes = await request(app.getHttpServer())
			.patch(`/api/trips/${tripId}/sos/${sosId}/cancel`)
			.set("Authorization", `Bearer ${otherCamper.accessToken}`)
			.send({ reason: "Cancelling on behalf of friend" });

		expect(failRes.status).toBe(403);
		expect(failRes.body.error).toBe(SosErrorCode.NOT_SOS_SENDER);
	});

	it("Rejects cancellation by a non-participant outsider (HTTP 403 Forbidden)", async () => {
		// 1. Camper creates SOS
		const createRes = await request(app.getHttpServer())
			.post(`/api/trips/${tripId}/sos`)
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.send({
				emergencyType: EmergencyType.NATURAL_HAZARD,
				eventTime: new Date().toISOString(),
			});

		const sosId = createRes.body.id;
		sosIds.push(sosId);

		// 2. Outsider tries to cancel
		const failRes = await request(app.getHttpServer())
			.patch(`/api/trips/${tripId}/sos/${sosId}/cancel`)
			.set("Authorization", `Bearer ${outsider.accessToken}`)
			.send({ reason: "Outsider trying to cancel" });

		expect(failRes.status).toBe(403);
		expect(failRes.body.error).toBe(SosErrorCode.NOT_TRIP_PARTICIPANT);
	});

	it("Rejects cancellation with invalid payload (empty reason) (HTTP 422 Unprocessable Entity)", async () => {
		// 1. Camper creates SOS
		const createRes = await request(app.getHttpServer())
			.post(`/api/trips/${tripId}/sos`)
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.send({
				emergencyType: EmergencyType.OTHER,
				eventTime: new Date().toISOString(),
			});

		const sosId = createRes.body.id;
		sosIds.push(sosId);

		// 2. Cancel with whitespace-only reason
		const failRes = await request(app.getHttpServer())
			.patch(`/api/trips/${tripId}/sos/${sosId}/cancel`)
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.send({ reason: "   " });

		expect(failRes.status).toBe(422);
	});
});
