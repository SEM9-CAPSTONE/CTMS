import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { UpdateDefaultCancellationPolicy1792627200001 } from "../src/migrations/1792627200001-UpdateDefaultCancellationPolicy";
import type { CancellationPolicySnapshotV1 } from "../src/modules/bookings/cancellation-policy";
import { dataSourceOptions } from "../src/shared/database/typeorm.config";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("Mentor cancellation policy data migration", () => {
	it("upgrades only future built-in Trip policies, preserves Booking snapshots/custom policies and rolls back safely", async () => {
		const db = await new DataSource(dataSourceOptions).initialize();
		await assertSafeTestDatabase(db);
		const runner = db.createQueryRunner();
		await runner.startTransaction();
		try {
			// Isolate the migration's backup table inside a transaction rolled back below.
			await runner.query(
				"ALTER TABLE mentor_default_policy_backups RENAME TO mentor_policy_original_backups"
			);
			const userId = randomUUID();
			const routeId = randomUUID();
			const oldTripId = randomUUID();
			const customTripId = randomUUID();
			const oldPolicy = {
				version: 1,
				rules: [
					{ minHoursBeforeTrip: 48, refundPercent: 100 },
					{ minHoursBeforeTrip: 24, refundPercent: 50 },
					{ minHoursBeforeTrip: 0, refundPercent: 0 },
				],
			};
			const customPolicy = { version: 1, rules: [{ minHoursBeforeTrip: 0, refundPercent: 80 }] };
			await runner.query(
				"INSERT INTO users(id,email,password_hash,role,status) VALUES ($1,$2,'test','host','active')",
				[userId, `migration-${userId}@example.com`]
			);
			await runner.query(
				`INSERT INTO trekking_routes(id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status)
				VALUES($1,$2,'Migration fixture',ST_SetSRID(ST_MakeLine(ST_MakePoint(108,16),ST_MakePoint(108.01,16.01)),4326)::geography,1000,'easy',60,'active')`,
				[routeId, userId]
			);
			for (const [tripId, policy] of [
				[oldTripId, oldPolicy],
				[customTripId, customPolicy],
			] as const) {
				await runner.query(
					`INSERT INTO trips(id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,price_per_person,status,cancellation_policy)
					VALUES($1,$2,$3,'Migration trip','day_trip',0,now()+interval '5 days',now()+interval '6 days',ST_SetSRID(ST_MakePoint(108,16),4326)::geography,now()+interval '4 days',1,10,100,'published',$4)`,
					[tripId, userId, routeId, policy]
				);
			}
			await runner.query(
				"INSERT INTO bookings(trip_id,user_id,num_people,status,payment_status,cancellation_policy_snapshot) VALUES($1,$2,1,'confirmed','paid',$3)",
				[oldTripId, userId, oldPolicy]
			);
			const migration = new UpdateDefaultCancellationPolicy1792627200001();
			await migration.up(runner);
			const readPolicy = async (tripId: string): Promise<CancellationPolicySnapshotV1> =>
				(
					await runner.query<Array<{ cancellation_policy: CancellationPolicySnapshotV1 }>>(
						"SELECT cancellation_policy FROM trips WHERE id=$1",
						[tripId]
					)
				)[0].cancellation_policy;
			expect((await readPolicy(oldTripId)).rules).toEqual([
				{ minHoursBeforeTrip: 72, refundPercent: 100 },
				{ minHoursBeforeTrip: 48, refundPercent: 30 },
				{ minHoursBeforeTrip: 0, refundPercent: 0 },
			]);
			expect(await readPolicy(customTripId)).toEqual(customPolicy);
			expect(
				(
					await runner.query<Array<{ cancellation_policy_snapshot: CancellationPolicySnapshotV1 }>>(
						"SELECT cancellation_policy_snapshot FROM bookings WHERE trip_id=$1",
						[oldTripId]
					)
				)[0].cancellation_policy_snapshot
			).toEqual(oldPolicy);
			await migration.down(runner);
			expect(await readPolicy(oldTripId)).toEqual(oldPolicy);
			expect(await readPolicy(customTripId)).toEqual(customPolicy);
		} finally {
			await runner.rollbackTransaction();
			await runner.release();
			await db.destroy();
		}
	}, 60_000);
});
