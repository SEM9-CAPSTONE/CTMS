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

describe("SOS Acknowledge and Close Handling (CTMS-080, BR-261, integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	const bookingIds: string[] = [];
	const sosIds: string[] = [];

	let host: Account;
	let otherHost: Account;
	let camper: Account;
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
				`sos-ctms80-${label}-${id}@example.com`,
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
		otherHost = await createAccount(UserRole.HOST, "other-host");
		camper = await createAccount(UserRole.CAMPER, "camper");

		routeId = randomUUID();
		routeIds.push(routeId);
		await dataSource.query(
			`INSERT INTO "trekking_routes" (
				"id", "host_id", "name", "route_geom", "length_meters", "difficulty",
				"expected_duration_minutes", "status"
			 ) VALUES (
				$1, $2, 'SOS Route 80',
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
				$1, $2, $3, 'Active SOS Handling Trip', 'day_trip', 0, $4, $4::timestamptz + interval '8 hours',
				ST_SetSRID(ST_MakePoint(108.2, 16.05), 4326)::geography,
				$4::timestamptz - interval '1 day', 1, 20, 1, 0, $5
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
	}

	async function createActiveSos(): Promise<string> {
		const res = await request(app.getHttpServer())
			.post(`/api/trips/${tripId}/sos`)
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.send({
				emergencyType: EmergencyType.MEDICAL,
				location: { latitude: 16.052, longitude: 108.205 },
				batteryLevel: 90,
				eventTime: new Date().toISOString(),
			});
		expect(res.status).toBe(201);
		sosIds.push(res.body.id);
		return res.body.id;
	}

	it("Happy path: Host acknowledges SOS and later closes it with resolution note (BR-261, AC1-AC6)", async () => {
		const sosId = await createActiveSos();

		// 1. Host acknowledges SOS
		const ackRes = await request(app.getHttpServer())
			.patch(`/api/trips/${tripId}/sos/${sosId}/acknowledge`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send();

		expect(ackRes.status).toBe(200);
		expect(ackRes.body.status).toBe(SosStatus.ACKNOWLEDGED);
		expect(ackRes.body.acknowledgedBy).toBe(host.id);
		expect(ackRes.body.acknowledgedAt).toBeTruthy();

		// Verify DB row
		const rowAfterAck = await dataSource.getRepository(SosAlert).findOneBy({ id: sosId });
		expect(rowAfterAck?.status).toBe(SosStatus.ACKNOWLEDGED);
		expect(rowAfterAck?.acknowledgedBy).toBe(host.id);
		expect(rowAfterAck?.acknowledgedAt).toBeTruthy();

		// Verify AuditLog for acknowledge
		const ackAudit = await dataSource.getRepository(AuditLog).findOne({
			where: { targetType: "sos_alert", targetId: sosId, action: "SOS_ACKNOWLEDGED" },
		});
		expect(ackAudit).toBeTruthy();
		expect(ackAudit?.actorId).toBe(host.id);
		expect(ackAudit?.before).toMatchObject({ status: SosStatus.ACTIVE });
		expect(ackAudit?.after).toMatchObject({
			status: SosStatus.ACKNOWLEDGED,
			acknowledgedBy: host.id,
		});

		// 2. Host closes the SOS with resolution note
		const note = "Medical team reached the camper. Minor injury treated, camper evacuated safely.";
		const closeRes = await request(app.getHttpServer())
			.patch(`/api/trips/${tripId}/sos/${sosId}/close`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send({ resolutionNote: note });

		expect(closeRes.status).toBe(200);
		expect(closeRes.body.status).toBe(SosStatus.CLOSED);
		expect(closeRes.body.closedBy).toBe(host.id);
		expect(closeRes.body.closedAt).toBeTruthy();
		expect(closeRes.body.resolutionNote).toBe(note);

		// Verify DB row after closure
		const rowAfterClose = await dataSource.getRepository(SosAlert).findOneBy({ id: sosId });
		expect(rowAfterClose?.status).toBe(SosStatus.CLOSED);
		expect(rowAfterClose?.closedBy).toBe(host.id);
		expect(rowAfterClose?.closedAt).toBeTruthy();
		expect(rowAfterClose?.resolutionNote).toBe(note);

		// Verify AuditLog for close
		const closeAudit = await dataSource.getRepository(AuditLog).findOne({
			where: { targetType: "sos_alert", targetId: sosId, action: "SOS_CLOSED" },
		});
		expect(closeAudit).toBeTruthy();
		expect(closeAudit?.actorId).toBe(host.id);
		expect(closeAudit?.reason).toBe(note);
		expect(closeAudit?.before).toMatchObject({ status: SosStatus.ACKNOWLEDGED });
		expect(closeAudit?.after).toMatchObject({
			status: SosStatus.CLOSED,
			closedBy: host.id,
			resolutionNote: note,
		});

		// 3. PB AC-7: closed is terminal in MVP and cannot be reopened or mutated
		const reopenRes = await request(app.getHttpServer())
			.patch(`/api/trips/${tripId}/sos/${sosId}/close`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send({ resolutionNote: "Attempting to re-close or reopen" });
		expect(reopenRes.status).toBe(409);
		expect(reopenRes.body.error).toBe(SosErrorCode.SOS_ALREADY_CLOSED);
	});

	it("AC1: Rejects unauthorized user or host of another trip (403)", async () => {
		const sosId = await createActiveSos();

		// Camper cannot acknowledge
		const camperAck = await request(app.getHttpServer())
			.patch(`/api/trips/${tripId}/sos/${sosId}/acknowledge`)
			.set("Authorization", `Bearer ${camper.accessToken}`)
			.send();
		expect(camperAck.status).toBe(403);

		// Host of another trip cannot acknowledge
		const otherHostAck = await request(app.getHttpServer())
			.patch(`/api/trips/${tripId}/sos/${sosId}/acknowledge`)
			.set("Authorization", `Bearer ${otherHost.accessToken}`)
			.send();
		expect(otherHostAck.status).toBe(403);
	});

	it("AC4: Closing is rejected if SOS is not acknowledged (409)", async () => {
		const sosId = await createActiveSos();

		// Attempt to close directly from ACTIVE
		const closeRes = await request(app.getHttpServer())
			.patch(`/api/trips/${tripId}/sos/${sosId}/close`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send({ resolutionNote: "Trying to close active alert" });

		expect(closeRes.status).toBe(409);
		expect(closeRes.body.error).toBe(SosErrorCode.SOS_NOT_ACKNOWLEDGED);
	});

	it("Validation: Closing without resolution note is rejected (422)", async () => {
		const sosId = await createActiveSos();

		// Acknowledge first
		await request(app.getHttpServer())
			.patch(`/api/trips/${tripId}/sos/${sosId}/acknowledge`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send();

		// Close with empty note
		const emptyRes = await request(app.getHttpServer())
			.patch(`/api/trips/${tripId}/sos/${sosId}/close`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send({ resolutionNote: "   " });

		expect(emptyRes.status).toBe(422);

		// Close with missing note
		const missingRes = await request(app.getHttpServer())
			.patch(`/api/trips/${tripId}/sos/${sosId}/close`)
			.set("Authorization", `Bearer ${host.accessToken}`)
			.send({});

		expect(missingRes.status).toBe(422);
	});
});
