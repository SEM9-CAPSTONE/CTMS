import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { PorterAvailabilityStatus } from "../src/modules/profiles/entities/porter-profile.entity";
import { PorterRouteProficiency } from "../src/modules/profiles/entities/porter-route-qualification.entity";
import { PorterVerificationStatus } from "../src/modules/profiles/entities/porter-verification.entity";
import { AvailablePortersRepository } from "../src/modules/trips/repositories/available-porters.repository";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

interface TestActor {
	id: string;
	token: string;
}

const TINY_PNG_BUFFER = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
	"base64"
);

const TARGET_START = new Date("2035-08-10T08:00:00.000Z");
const TARGET_END = new Date("2035-08-10T16:00:00.000Z");

describe("CTMS-138 Porter Certificates (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let availablePortersRepo: AvailablePortersRepository;

	const userIds = new Set<string>();
	const routeIds = new Set<string>();
	const tripIds = new Set<string>();
	const certIds = new Set<string>();

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
		availablePortersRepo = moduleRef.get(AvailablePortersRepository);
	});

	afterEach(async () => {
		const certs = [...certIds];
		const users = [...userIds];
		const routes = [...routeIds];
		const trips = [...tripIds];

		if (certs.length > 0) {
			await dataSource.query("DELETE FROM porter_certificates WHERE id = ANY($1::uuid[])", [certs]);
		}
		if (users.length > 0) {
			await dataSource.query("DELETE FROM porter_certificates WHERE porter_id = ANY($1::uuid[])", [
				users,
			]);
			await dataSource.query(
				"DELETE FROM trip_porters WHERE trip_id = ANY($1::uuid[]) OR porter_id = ANY($2::uuid[])",
				[trips, users]
			);
			await dataSource.query(
				"DELETE FROM porter_route_qualifications WHERE route_id = ANY($1::uuid[]) OR porter_id = ANY($2::uuid[])",
				[routes, users]
			);
			await dataSource.query("DELETE FROM porter_verifications WHERE porter_id = ANY($1::uuid[])", [
				users,
			]);
			await dataSource.query("DELETE FROM porter_profiles WHERE porter_id = ANY($1::uuid[])", [
				users,
			]);
			await dataSource.query("DELETE FROM user_roles WHERE user_id = ANY($1::uuid[])", [users]);
		}
		if (trips.length > 0) {
			await dataSource.query("DELETE FROM trips WHERE id = ANY($1::uuid[])", [trips]);
		}
		if (routes.length > 0) {
			await dataSource.query("DELETE FROM trekking_routes WHERE id = ANY($1::uuid[])", [routes]);
		}
		if (users.length > 0) {
			await dataSource.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [users]);
		}

		userIds.clear();
		routeIds.clear();
		tripIds.clear();
		certIds.clear();
	});

	afterAll(async () => {
		await app.close();
	});

	async function createActor(role: UserRole, name: string): Promise<TestActor> {
		const id = randomUUID();
		userIds.add(id);
		await dataSource.query(
			"INSERT INTO users (id, email, password_hash, role, status, full_name) VALUES ($1, $2, $3, $4, $5, $6)",
			[id, `cert-test-${id}@ctms.local`, "unused", role, UserStatus.ACTIVE, name]
		);
		await dataSource.query("INSERT INTO user_roles (user_id, role) VALUES ($1, $2)", [id, role]);
		return { id, token: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createRoute(hostId: string): Promise<string> {
		const routeId = randomUUID();
		routeIds.add(routeId);
		await dataSource.query(
			`INSERT INTO trekking_routes (
				id, host_id, name, route_geom, length_meters, difficulty, expected_duration_minutes, status
			) VALUES ($1, $2, $3, ST_GeogFromText($4), $5, $6, $7, $8)`,
			[
				routeId,
				hostId,
				`CTMS-138 Route-${routeId}`,
				"SRID=4326;LINESTRING(108.45 11.94,108.47 11.95)",
				2500,
				"moderate",
				180,
				"active",
			]
		);
		return routeId;
	}

	async function createTrip(
		hostId: string,
		routeId: string,
		startsAt = TARGET_START,
		endsAt = TARGET_END
	): Promise<string> {
		const tripId = randomUUID();
		tripIds.add(tripId);
		await dataSource.query(
			`INSERT INTO trips (
				id, host_id, route_id, title, trip_type, duration_nights, starts_at, ends_at,
				meeting_point, booking_deadline, capacity_min, capacity_max, price_per_person, status
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_GeogFromText($9), $10, $11, $12, $13, $14)`,
			[
				tripId,
				hostId,
				routeId,
				`CTMS-138 Trip-${tripId}`,
				"day_trip",
				0,
				startsAt,
				endsAt,
				"SRID=4326;POINT(108.45 11.94)",
				new Date(startsAt.getTime() - 24 * 60 * 60 * 1000),
				1,
				20,
				500000,
				"published",
			]
		);
		return tripId;
	}

	async function createCandidate(
		name: string,
		options: {
			experienceYears?: number;
			proficiency?: PorterRouteProficiency;
			routeId?: string;
			verifierId?: string;
		} = {}
	): Promise<TestActor> {
		const actor = await createActor(UserRole.PORTER, name);
		const experienceYears = options.experienceYears ?? 4;

		await dataSource.query(
			`INSERT INTO porter_profiles (
				porter_id, experience_years, availability_status, rating_avg, completed_trips
			) VALUES ($1, $2, $3, 4.8, 25)`,
			[actor.id, experienceYears, PorterAvailabilityStatus.AVAILABLE]
		);

		await dataSource.query(
			`INSERT INTO porter_verifications (
				porter_id, status, guide_card_expires_on, reviewed_at
			) VALUES ($1, $2, '2036-12-31', now())`,
			[actor.id, PorterVerificationStatus.APPROVED]
		);

		if (options.routeId && options.proficiency) {
			await dataSource.query(
				`INSERT INTO porter_route_qualifications (
					porter_id, route_id, proficiency, times_led, verified_by, verified_at
				) VALUES ($1, $2, $3, 2, $4, now())`,
				[actor.id, options.routeId, options.proficiency, options.verifierId ?? actor.id]
			);
		}

		return actor;
	}

	async function insertCertificate(
		porterId: string,
		data: {
			type: string;
			name: string;
			status?: "pending" | "verified" | "rejected";
			expiryDate?: string;
			fileUrl?: string;
			certificateNumber?: string;
			issuedBy?: string;
			rejectionReason?: string;
		}
	): Promise<string> {
		const id = randomUUID();
		certIds.add(id);
		await dataSource.query(
			`INSERT INTO porter_certificates (
				id, porter_id, type, name, status, expiry_date,
				file_url, certificate_number, issued_by, rejection_reason, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())`,
			[
				id,
				porterId,
				data.type,
				data.name,
				data.status ?? "verified",
				data.expiryDate ?? "2028-12-31",
				data.fileUrl ?? "/uploads/test.jpg",
				data.certificateNumber ?? "CERT-001",
				data.issuedBy ?? "Hội Chữ thập đỏ",
				data.rejectionReason ?? null,
			]
		);
		return id;
	}

	// =========================================================================
	// TEST 1: Lead Porter Query & Certificate Filtering
	// =========================================================================
	it("Test 1: queries lead porters and returns only verified, unexpired certificates for eligible lead candidates", async () => {
		const host = await createActor(UserRole.HOST, "Chủ Chuyến Test");
		const admin = await createActor(UserRole.ADMIN, "Quản Trị Viên Test");
		const routeId = await createRoute(host.id);
		const tripId = await createTrip(host.id, routeId);

		// Candidate 1: Tùng (Expert, 3 verified unexpired certs)
		const tung = await createCandidate("Đỗ Thanh Tùng", {
			routeId,
			proficiency: PorterRouteProficiency.EXPERT,
			verifierId: admin.id,
		});
		await insertCertificate(tung.id, { type: "wfa", name: "Sơ cấp cứu hoang dã WFA" });
		await insertCertificate(tung.id, { type: "rescue", name: "Cứu hộ địa hình núi dốc" });
		await insertCertificate(tung.id, { type: "guide_card", name: "Thẻ HDV Quốc tế" });

		// Candidate 2: Sơn (Expert, 1 verified cert, 1 rejected cert, 1 expired cert)
		const son = await createCandidate("Nguyễn Minh Sơn", {
			routeId,
			proficiency: PorterRouteProficiency.EXPERT,
			verifierId: admin.id,
		});
		await insertCertificate(son.id, {
			type: "wfa",
			name: "Sơ cấp cứu hoang dã WFA",
			status: "verified",
			expiryDate: "2028-05-15",
		});
		await insertCertificate(son.id, {
			type: "rescue",
			name: "Kỹ thuật cứu hộ suối thác",
			status: "rejected",
			rejectionReason: "Ảnh mờ",
		});
		await insertCertificate(son.id, {
			type: "other",
			name: "Chứng chỉ sơ cấp cứu cơ bản",
			status: "verified",
			expiryDate: "2020-01-01", // EXPIRED
		});

		// Candidate 3: An (Proficient, 1 verified cert)
		const an = await createCandidate("Trần Hoàng An", {
			routeId,
			proficiency: PorterRouteProficiency.PROFICIENT,
			verifierId: admin.id,
		});
		await insertCertificate(an.id, { type: "wfa", name: "Sơ cấp cứu hoang dã WFA" });

		// Candidate 4: Mai (Trainee/Learning - ineligible for Lead)
		const mai = await createCandidate("Lê Thị Mai", {
			routeId,
			proficiency: PorterRouteProficiency.LEARNING,
			verifierId: admin.id,
		});
		await insertCertificate(mai.id, { type: "wfa", name: "Sơ cấp cứu hoang dã WFA" });

		// Execute Host search for role=lead
		const res = await request(app.getHttpServer())
			.get(`/api/trips/${tripId}/available-porters?role=lead`)
			.set("Authorization", `Bearer ${host.token}`)
			.expect(200);

		const candidateIds = res.body.items.map((i: { porterId: string }) => i.porterId);

		// Mai is excluded because learning proficiency is not allowed for Lead
		expect(candidateIds).toContain(tung.id);
		expect(candidateIds).toContain(son.id);
		expect(candidateIds).toContain(an.id);
		expect(candidateIds).not.toContain(mai.id);

		// Tùng has all 3 verified certs returned
		const tungItem = res.body.items.find((i: { porterId: string }) => i.porterId === tung.id);
		expect(tungItem.certificates).toHaveLength(3);
		expect(tungItem.certificates.map((c: { type: string }) => c.type)).toEqual(
			expect.arrayContaining(["wfa", "rescue", "guide_card"])
		);

		// Sơn has ONLY 1 verified cert (rejected and expired certs are omitted)
		const sonItem = res.body.items.find((i: { porterId: string }) => i.porterId === son.id);
		expect(sonItem.certificates).toHaveLength(1);
		expect(sonItem.certificates[0].name).toBe("Sơ cấp cứu hoang dã WFA");
		expect(sonItem.certificates[0].type).toBe("wfa");

		// An has 1 cert
		const anItem = res.body.items.find((i: { porterId: string }) => i.porterId === an.id);
		expect(anItem.certificates).toHaveLength(1);
	});

	// =========================================================================
	// TEST 2: Host Privacy Protection (No sensitive fields in DTO)
	// =========================================================================
	it("Test 2: protects porter privacy: DTO exposes only type and name, never sensitive fields", async () => {
		const host = await createActor(UserRole.HOST, "Chủ Chuyến Test");
		const routeId = await createRoute(host.id);
		const tripId = await createTrip(host.id, routeId);

		const porter = await createCandidate("Người Hỗ Trợ Riêng Tư", {
			routeId,
			proficiency: PorterRouteProficiency.EXPERT,
		});
		await insertCertificate(porter.id, {
			type: "rescue",
			name: "Cứu hộ đặc biệt",
			status: "verified",
			fileUrl: "https://secret-cdn.local/confidential-cert.pdf",
			certificateNumber: "TOP-SECRET-12345",
			issuedBy: "Cục Cứu Nạn Quốc Gia",
			rejectionReason: "Ghi chú nội bộ không được lộ",
		});

		const res = await request(app.getHttpServer())
			.get(`/api/trips/${tripId}/available-porters?role=lead`)
			.set("Authorization", `Bearer ${host.token}`)
			.expect(200);

		const target = res.body.items.find((i: { porterId: string }) => i.porterId === porter.id);
		expect(target).toBeDefined();
		expect(target.certificates).toHaveLength(1);

		const cert = target.certificates[0];
		// Allowed fields: type and name
		expect(cert.type).toBe("rescue");
		expect(cert.name).toBe("Cứu hộ đặc biệt");

		// Strict privacy check: No sensitive internal / raw fields leaked to Host
		expect(cert.fileUrl).toBeUndefined();
		expect(cert.file_url).toBeUndefined();
		expect(cert.certificateNumber).toBeUndefined();
		expect(cert.certificate_number).toBeUndefined();
		expect(cert.issuedBy).toBeUndefined();
		expect(cert.issued_by).toBeUndefined();
		expect(cert.rejectionReason).toBeUndefined();
		expect(cert.rejection_reason).toBeUndefined();
		expect(cert.adminNote).toBeUndefined();
		expect(cert.admin_note).toBeUndefined();
		expect(cert.verifiedBy).toBeUndefined();
		expect(cert.verifiedAt).toBeUndefined();

		// Only exactly 2 keys exist on certificate object
		expect(Object.keys(cert).sort()).toEqual(["name", "type"]);
	});

	// =========================================================================
	// TEST 3: Fixed Query Count (No N+1 query problem)
	// =========================================================================
	it("Test 3: executes exactly 3 queries regardless of candidate count (no N+1 query problem)", async () => {
		const host = await createActor(UserRole.HOST, "Chủ Chuyến Test");
		const routeId = await createRoute(host.id);
		const tripId = await createTrip(host.id, routeId);

		// Seed 5 candidate porters with certificates
		for (let i = 1; i <= 5; i++) {
			const candidate = await createCandidate(`Porter Candidate ${i}`, {
				routeId,
				proficiency: PorterRouteProficiency.EXPERT,
			});
			await insertCertificate(candidate.id, {
				type: "wfa",
				name: `WFA Cert ${i}`,
			});
			await insertCertificate(candidate.id, {
				type: "rescue",
				name: `Rescue Cert ${i}`,
			});
		}

		// Spy on repository query execution
		const queriesExecuted: string[] = [];
		const originalQuery = AvailablePortersRepository.prototype.query;
		const spy = jest
			.spyOn(availablePortersRepo, "query")
			.mockImplementation(async (sql: string, params?: unknown[]) => {
				queriesExecuted.push(sql);
				return Reflect.apply(originalQuery, availablePortersRepo, [sql, params]);
			});

		try {
			const res = await request(app.getHttpServer())
				.get(`/api/trips/${tripId}/available-porters?role=lead&limit=10`)
				.set("Authorization", `Bearer ${host.token}`)
				.expect(200);

			expect(res.body.items.length).toBeGreaterThanOrEqual(5);

			// Must be EXACTLY 3 queries:
			// 1. SELECT COUNT(*)
			// 2. SELECT candidate profiles LIMIT ... OFFSET ...
			// 3. SELECT c.porter_id, c.type, c.name FROM porter_certificates c WHERE c.porter_id = ANY($1)
			expect(queriesExecuted).toHaveLength(3);
			expect(queriesExecuted[0]).toMatch(/SELECT COUNT\(\*\)/i);
			expect(queriesExecuted[1]).toMatch(/FROM "porter_profiles" profile/i);
			expect(queriesExecuted[2]).toMatch(/FROM porter_certificates c/i);
			expect(queriesExecuted[2]).toMatch(/c\.porter_id = ANY\(\$1\)/i);
		} finally {
			spy.mockRestore();
		}
	});

	// =========================================================================
	// TEST 4: Certificate Lifecycle, Auto Revert to Pending & Isolation
	// =========================================================================
	it("Test 4: manages certificate lifecycle, reverts to pending on edit, enforces isolation and soft delete", async () => {
		const porterA = await createActor(UserRole.PORTER, "Porter A");
		const porterB = await createActor(UserRole.PORTER, "Porter B");

		// 1. Porter A creates a certificate
		const createRes = await request(app.getHttpServer())
			.post("/api/porter/certificates")
			.set("Authorization", `Bearer ${porterA.token}`)
			.send({
				type: "wfa",
				name: "Chứng chỉ WFA ban đầu",
				certificateNumber: "WFA-001",
				issuedBy: "Hội Chữ Thập Đỏ",
				issuedDate: "2024-01-01",
				expiryDate: "2028-01-01",
				fileUrl: "/uploads/wfa-initial.jpg",
			})
			.expect(201);

		const certId = createRes.body.id;
		certIds.add(certId);
		expect(createRes.body.status).toBe("pending");

		// 2. Simulate Admin verification
		await dataSource.query(
			"UPDATE porter_certificates SET status = 'verified', verified_at = now() WHERE id = $1",
			[certId]
		);

		// Verify status is now 'verified'
		const getVerifiedRes = await request(app.getHttpServer())
			.get(`/api/porter/certificates/${certId}`)
			.set("Authorization", `Bearer ${porterA.token}`)
			.expect(200);
		expect(getVerifiedRes.body.status).toBe("verified");

		// 3. Porter A edits the verified certificate (e.g. updating name)
		const updateRes = await request(app.getHttpServer())
			.put(`/api/porter/certificates/${certId}`)
			.set("Authorization", `Bearer ${porterA.token}`)
			.send({
				name: "Chứng chỉ WFA cập nhật mới",
				expiryDate: "2029-01-01",
			})
			.expect(200);

		// Core rule: Sửa chứng chỉ đã xác minh PHẢI tự động chuyển về pending
		expect(updateRes.body.status).toBe("pending");
		expect(updateRes.body.name).toBe("Chứng chỉ WFA cập nhật mới");

		// 4. Isolation: Porter B attempts to edit Porter A's certificate -> 403 Forbidden
		await request(app.getHttpServer())
			.put(`/api/porter/certificates/${certId}`)
			.set("Authorization", `Bearer ${porterB.token}`)
			.send({ name: "Porter B can thiệp trái phép" })
			.expect(403);

		// Porter B attempts to delete Porter A's certificate -> 403 Forbidden
		await request(app.getHttpServer())
			.delete(`/api/porter/certificates/${certId}`)
			.set("Authorization", `Bearer ${porterB.token}`)
			.expect(403);

		// 5. Porter A deletes certificate -> 200 OK
		await request(app.getHttpServer())
			.delete(`/api/porter/certificates/${certId}`)
			.set("Authorization", `Bearer ${porterA.token}`)
			.expect(200);

		// Verify soft delete in DB
		const dbRows = await dataSource.query(
			"SELECT deleted_at FROM porter_certificates WHERE id = $1",
			[certId]
		);
		expect(dbRows[0].deleted_at).not.toBeNull();

		// Porter A's list no longer includes the deleted cert
		const listRes = await request(app.getHttpServer())
			.get("/api/porter/certificates")
			.set("Authorization", `Bearer ${porterA.token}`)
			.expect(200);
		expect(listRes.body.find((c: { id: string }) => c.id === certId)).toBeUndefined();
	});

	// =========================================================================
	// TEST 5: File Upload Format & Size Validation
	// =========================================================================
	it("Test 5: validates file upload format and size strictly (rejects invalid MIME types and >5MB files)", async () => {
		const porter = await createActor(UserRole.PORTER, "Porter Upload Tester");

		// 1. Upload disallowed format (.txt / text/plain) -> 400 Bad Request
		const invalidFormatRes = await request(app.getHttpServer())
			.post("/api/porter/certificates/upload")
			.set("Authorization", `Bearer ${porter.token}`)
			.attach("file", Buffer.from("invalid plain text content"), "malicious.txt")
			.expect(400);

		expect(invalidFormatRes.body.message).toMatch(/JPG|PNG|WebP|PDF/i);

		// 2. Upload file exceeding 5MB limit -> 400 Bad Request
		const largeBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024); // 5MB + 1KB
		const largeFileRes = await request(app.getHttpServer())
			.post("/api/porter/certificates/upload")
			.set("Authorization", `Bearer ${porter.token}`)
			.attach("file", largeBuffer, { filename: "large_cert.png", contentType: "image/png" });

		// Either Multer rejects with 400 / 413
		expect([400, 413]).toContain(largeFileRes.status);

		// 3. Upload valid image -> 201 Created with fileUrl
		const validRes = await request(app.getHttpServer())
			.post("/api/porter/certificates/upload")
			.set("Authorization", `Bearer ${porter.token}`)
			.attach("file", TINY_PNG_BUFFER, { filename: "valid_cert.png", contentType: "image/png" })
			.expect(201);

		expect(validRes.body.fileUrl).toBeDefined();
		expect(typeof validRes.body.fileUrl).toBe("string");
	});
});
