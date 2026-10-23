import type { MigrationInterface, QueryRunner } from "typeorm";

const OLD_RULES = [
	{ minHoursBeforeTrip: 48, refundPercent: 100 },
	{ minHoursBeforeTrip: 24, refundPercent: 50 },
	{ minHoursBeforeTrip: 0, refundPercent: 0 },
];
// Freeze migration values: importing application defaults would change migration history.
const NEW_POLICY = {
	version: 1,
	rules: [
		{ minHoursBeforeTrip: 72, refundPercent: 100 },
		{ minHoursBeforeTrip: 48, refundPercent: 30 },
		{ minHoursBeforeTrip: 0, refundPercent: 0 },
	],
	policy:
		"Hủy trước ít nhất 72 giờ hoàn 100%, từ 48 đến dưới 72 giờ hoàn 30%, dưới 48 giờ trước khởi hành không hoàn tiền.",
};

export class UpdateDefaultCancellationPolicy1792627200001 implements MigrationInterface {
	name = "UpdateDefaultCancellationPolicy1792627200001";
	async up(queryRunner: QueryRunner): Promise<void> {
		// Only recognize the exact previous built-in rules. Custom/legacy policies and
		// every Booking snapshot remain untouched. Keep originals for safe rollback.
		await queryRunner.query(`CREATE TABLE mentor_default_policy_backups (
			trip_id uuid PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
			policy jsonb NOT NULL
		)`);
		await queryRunner.query(
			`INSERT INTO mentor_default_policy_backups (trip_id, policy)
			SELECT id, cancellation_policy FROM trips
			WHERE status IN ('draft', 'pending_approval', 'published') AND starts_at > now()
			AND cancellation_policy->'version' = '1'::jsonb
			AND cancellation_policy->'rules' = $1::jsonb`,
			[JSON.stringify(OLD_RULES)]
		);
		await queryRunner.query(
			`UPDATE trips t SET cancellation_policy=$1::jsonb
			FROM mentor_default_policy_backups b WHERE t.id=b.trip_id`,
			[JSON.stringify(NEW_POLICY)]
		);
	}
	async down(queryRunner: QueryRunner): Promise<void> {
		// A policy edited after migration must not be overwritten during rollback.
		await queryRunner.query(
			`UPDATE trips t SET cancellation_policy=b.policy
			FROM mentor_default_policy_backups b
			WHERE t.id=b.trip_id AND t.cancellation_policy=$1::jsonb`,
			[JSON.stringify(NEW_POLICY)]
		);
		await queryRunner.query("DROP TABLE mentor_default_policy_backups");
	}
}
