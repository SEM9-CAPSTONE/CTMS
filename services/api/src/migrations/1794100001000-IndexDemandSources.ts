import type { MigrationInterface, QueryRunner } from "typeorm";

/** Support fixed-month eligibility reads without indexing prohibited source fields. */
export class IndexDemandSources1794100001000 implements MigrationInterface {
	async up(q: QueryRunner): Promise<void> {
		await q.query(
			"CREATE INDEX idx_demand_booking_month ON bookings(created_at,id) WHERE status IN ('confirmed','completed') AND cancelled_at IS NULL"
		);
		await q.query(
			"CREATE INDEX idx_demand_refund_exclusion ON payments(booking_id) WHERE type='refund' AND status <> 'failed'"
		);
	}
	async down(q: QueryRunner): Promise<void> {
		await q.query("DROP INDEX idx_demand_refund_exclusion; DROP INDEX idx_demand_booking_month");
	}
}
