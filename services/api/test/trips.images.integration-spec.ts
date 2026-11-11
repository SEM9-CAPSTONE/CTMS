import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { ManageTripImages1792800000000 } from "../src/migrations/1792800000000-ManageTripImages";
import { AuditLog } from "../src/modules/auth/entities/audit-log.entity";
import { TripImagesService } from "../src/modules/trips/services/trip-images.service";
import type { UploadsService } from "../src/modules/uploads/uploads.service";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("Trip images database invariants", () => {
	const schema = `trip_images_${randomUUID().replaceAll("-", "")}`;
	const host = randomUUID();
	const trip = randomUUID();
	const otherTrip = randomUUID();
	let admin: DataSource;
	let db: DataSource;
	let service: TripImagesService;
	const upload = jest.fn();
	const uploads = {
		prepareTripImage: jest.fn(() => {
			const url = `https://example.test/${randomUUID()}.png`;
			const key = `trips/${randomUUID()}`;
			return { url, key, upload: () => upload().then(() => ({ url, key })) };
		}),
	};
	const file = (value: number) =>
		({
			buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, value]),
			mimetype: "image/png",
		}) as Express.Multer.File;
	beforeAll(async () => {
		admin = new DataSource({ type: "postgres", url: process.env.DATABASE_URL });
		await admin.initialize();
		await assertSafeTestDatabase(admin);
		await admin.query(`CREATE SCHEMA "${schema}"`);
		db = new DataSource({
			type: "postgres",
			url: process.env.DATABASE_URL,
			schema,
			entities: [AuditLog],
			extra: { options: `-c search_path=${schema},public` },
		});
		await db.initialize();
		await db.query(
			"CREATE TABLE trips(id uuid PRIMARY KEY,host_id uuid NOT NULL,status text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),cover_image_url varchar(500))"
		);
		await db.synchronize();
		await new ManageTripImages1792800000000().up(db.createQueryRunner());
		service = new TripImagesService(db, uploads as unknown as UploadsService);
	}, 30_000);
	beforeEach(async () => {
		await db.query("TRUNCATE trip_images,trip_image_cleanup,audit_logs,trips CASCADE");
		await db.query("INSERT INTO trips(id,host_id,status) VALUES($1,$3,'draft'),($2,$3,'draft')", [
			trip,
			otherTrip,
			host,
		]);
		upload.mockReset();
		upload.mockResolvedValue(undefined);
	});
	afterAll(async () => {
		if (db?.isInitialized) await db.destroy();
		if (admin?.isInitialized) {
			await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
			await admin.destroy();
		}
	});
	it("serializes concurrent distinct uploads at five and preserves the first cover", async () => {
		const first = await service.add(host, trip, file(0));
		const results = await Promise.allSettled(
			Array.from({ length: 24 }, (_, i) => service.add(host, trip, file(i + 1)))
		);
		expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(4);
		expect(await service.list(trip)).toHaveLength(5);
		const [row] = await db.query("SELECT cover_image_url FROM trips WHERE id=$1", [trip]);
		expect(row.cover_image_url).toBe(first[0].url);
	});
	it("creates one record, one storage object and one audit on concurrent retries", async () => {
		await Promise.all(Array.from({ length: 6 }, () => service.add(host, trip, file(0))));
		expect(await service.list(trip)).toHaveLength(1);
		expect(upload).toHaveBeenCalledTimes(1);
		const [row] = await db.query("SELECT count(*)::int AS count FROM audit_logs");
		expect(row.count).toBe(1);
	});
	it("promotes the next image on deletion and queues the deleted storage object", async () => {
		const [first] = await service.add(host, trip, file(0));
		await service.add(host, trip, file(1));
		const remaining = await service.remove(host, trip, first.id);
		expect(remaining).toHaveLength(1);
		const [row] = await db.query("SELECT cover_image_url FROM trips WHERE id=$1", [trip]);
		expect(row.cover_image_url).toBe(remaining[0].url);
		const jobs = await db.query("SELECT * FROM trip_image_cleanup");
		expect(jobs).toHaveLength(1);
		expect(jobs[0].url).toBe(first.url);
		const [beforeRetry] = await db.query("SELECT count(*)::int AS count FROM audit_logs");
		await service.remove(host, trip, first.id);
		const [afterRetry] = await db.query("SELECT count(*)::int AS count FROM audit_logs");
		expect(afterRetry.count).toBe(beforeRetry.count);
		expect(await db.query("SELECT * FROM trip_image_cleanup")).toHaveLength(1);
	});
	it("cascades physical image records and durably queues storage cleanup when deleting a Trip", async () => {
		await service.add(host, trip, file(0));
		await service.add(host, trip, file(1));
		await db.query("DELETE FROM trips WHERE id=$1", [trip]);
		expect(await service.list(trip)).toEqual([]);
		expect(await db.query("SELECT * FROM trip_image_cleanup")).toHaveLength(2);
	});
	it("rejects unauthorized mutations before allocating storage", async () => {
		await expect(service.add(randomUUID(), trip, file(0))).rejects.toThrow();
		expect(await service.list(trip)).toEqual([]);
		expect(upload).not.toHaveBeenCalled();
	});

	it("rolls back metadata and thumbnail while retaining a cleanup receipt after audit failure", async () => {
		await db.query(
			"CREATE FUNCTION fail_image_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit failed'; END $$"
		);
		await db.query(
			"CREATE TRIGGER fail_image_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_image_audit()"
		);
		try {
			await expect(service.add(host, trip, file(0))).rejects.toThrow("audit failed");
			expect(await service.list(trip)).toEqual([]);
			const [row] = await db.query("SELECT cover_image_url FROM trips WHERE id=$1", [trip]);
			expect(row.cover_image_url).toBeNull();
			expect(await db.query("SELECT * FROM trip_image_cleanup")).toHaveLength(1);
		} finally {
			await db.query("DROP TRIGGER fail_image_audit ON audit_logs");
			await db.query("DROP FUNCTION fail_image_audit()");
		}
	});
	it("cannot remove another Trip's image", async () => {
		const [image] = await service.add(host, otherTrip, file(0));
		await expect(service.remove(host, trip, image.id)).rejects.toThrow("Image does not belong");
		expect(await service.list(otherTrip)).toHaveLength(1);
		expect(await db.query("SELECT * FROM trip_image_cleanup")).toHaveLength(0);
	});
	it("advances the draft version for image changes while duplicate uploads preserve it", async () => {
		await db.query("UPDATE trips SET status='draft' WHERE id=$1", [trip]);
		const before = await db.query("SELECT updated_at FROM trips WHERE id=$1", [trip]);
		const images = await service.add(host, trip, file(17));
		const added = await db.query("SELECT updated_at FROM trips WHERE id=$1", [trip]);
		expect(new Date(added[0].updated_at).getTime()).toBeGreaterThan(
			new Date(before[0].updated_at).getTime()
		);
		await service.add(host, trip, file(17));
		const duplicate = await db.query("SELECT updated_at FROM trips WHERE id=$1", [trip]);
		expect(duplicate[0].updated_at).toEqual(added[0].updated_at);
		await service.remove(host, trip, images[0].id);
		const removed = await db.query("SELECT updated_at FROM trips WHERE id=$1", [trip]);
		expect(new Date(removed[0].updated_at).getTime()).toBeGreaterThan(
			new Date(added[0].updated_at).getTime()
		);
	});
});
