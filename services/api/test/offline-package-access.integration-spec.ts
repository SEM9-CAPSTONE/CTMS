import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { OfflinePackageAccessRepository } from "../src/modules/offline-package-download/offline-package-access.repository";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("CTMS-053 actual PostgreSQL participant authorization", () => {
	const schema = `ctms53_${randomUUID().replace(/-/g, "")}`;
	const tripId = randomUUID();
	const otherTripId = randomUUID();
	const camper = randomUUID();
	const owner = randomUUID();
	const porter = randomUUID();
	const bookingId = randomUUID();
	let db: DataSource;
	let access: OfflinePackageAccessRepository;
	beforeAll(async () => {
		const url = process.env.TEST_DATABASE_URL ?? "postgresql://ctms:ctms@127.0.0.1:5432/ctms_test";
		if (!new URL(url).pathname.endsWith("_test")) throw new Error("Requires a *_test database");
		db = new DataSource({
			type: "postgres",
			url,
			extra: { options: `-c search_path=${schema},public`, connectionTimeoutMillis: 3000 },
		});
		await db.initialize();
		await assertSafeTestDatabase(db);
		await db.query(`CREATE SCHEMA ${schema}`);
		await db.query(`
		 CREATE TABLE trips(id uuid PRIMARY KEY,status text);
		 CREATE TABLE bookings(id uuid PRIMARY KEY,trip_id uuid,user_id uuid,status text);
		 CREATE TABLE booking_members(id uuid PRIMARY KEY,booking_id uuid,user_id uuid,member_status text,left_at timestamptz);
		 CREATE TABLE trip_porters(trip_id uuid,porter_id uuid,status text);
		`);
		access = new OfflinePackageAccessRepository(db);
	});
	afterAll(async () => {
		if (!db?.isInitialized) return;
		await assertSafeTestDatabase(db);
		await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
		await db.destroy();
	});
	beforeEach(async () => {
		await db.query("TRUNCATE trips,bookings,booking_members,trip_porters");
		await db.query("INSERT INTO trips VALUES($1,'published'),($2,'published')", [
			tripId,
			otherTripId,
		]);
		await db.query("INSERT INTO bookings VALUES($1,$2,$3,'confirmed')", [bookingId, tripId, owner]);
		await db.query("INSERT INTO booking_members VALUES($1,$2,$3,'registered',NULL)", [
			randomUUID(),
			bookingId,
			camper,
		]);
		await db.query("INSERT INTO trip_porters VALUES($1,$2,'assigned')", [tripId, porter]);
	});
	it("allows a registered member on a confirmed booking and an assigned Porter", async () => {
		expect(await access.downloadableTripStatus(tripId, camper)).toBe("published");
		expect(await access.downloadableTripStatus(tripId, porter)).toBe("published");
	});
	it("allows a joined member to recover bytes during an ongoing Trip", async () => {
		await db.query("UPDATE trips SET status='ongoing' WHERE id=$1", [tripId]);
		await db.query("UPDATE booking_members SET member_status='joined'");
		expect(await access.downloadableTripStatus(tripId, camper)).toBe("ongoing");
	});
	it("does not infer participation from booking ownership or another Trip", async () => {
		expect(await access.downloadableTripStatus(tripId, owner)).toBeNull();
		expect(await access.downloadableTripStatus(otherTripId, camper)).toBeNull();
		expect(await access.downloadableTripStatus(otherTripId, porter)).toBeNull();
		expect(await access.downloadableTripStatus(randomUUID(), camper)).toBeNull();
	});
	it.each(["removed", "no_show", "left"])("denies %s membership", async (status) => {
		await db.query("UPDATE booking_members SET member_status=$1", [status]);
		expect(await access.downloadableTripStatus(tripId, camper)).toBeNull();
	});
	it.each(["pending_payment", "pending_reconfirmation", "cancelled", "expired", "completed"])(
		"denies %s booking",
		async (status) => {
			await db.query("UPDATE bookings SET status=$1", [status]);
			expect(await access.downloadableTripStatus(tripId, camper)).toBeNull();
		}
	);
	it.each(["unassigned", "pending_reconfirmation"])(
		"denies %s Porter assignment",
		async (status) => {
			await db.query("UPDATE trip_porters SET status=$1", [status]);
			expect(await access.downloadableTripStatus(tripId, porter)).toBeNull();
		}
	);
	it.each(["draft", "pending_approval", "completed", "cancelled", "rejected"])(
		"denies %s Trip",
		async (status) => {
			await db.query("UPDATE trips SET status=$1 WHERE id=$2", [status, tripId]);
			expect(await access.downloadableTripStatus(tripId, camper)).toBeNull();
			expect(await access.downloadableTripStatus(tripId, porter)).toBeNull();
		}
	);
	it("observes membership revocation on the next resume without cached authorization", async () => {
		expect(await access.downloadableTripStatus(tripId, camper)).toBe("published");
		await db.query("UPDATE booking_members SET left_at=clock_timestamp()");
		expect(await access.downloadableTripStatus(tripId, camper)).toBeNull();
	});
});
