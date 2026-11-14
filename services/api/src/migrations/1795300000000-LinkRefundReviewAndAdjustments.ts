import type { MigrationInterface, QueryRunner } from "typeorm";

export class LinkRefundReviewAndAdjustments1795300000000 implements MigrationInterface {
	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE payments ADD COLUMN review_status varchar(32)
			CHECK (review_status IN ('pending_review', 'approved', 'rejected'))`);
		await queryRunner.query(`UPDATE payments SET review_status = 'pending_review'
			WHERE type = 'refund' AND status = 'pending'`);
		await queryRunner.query(`ALTER TABLE financial_adjustments
			ADD COLUMN refund_payment_id uuid UNIQUE REFERENCES payments(id) ON DELETE RESTRICT`);
	}
	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query("ALTER TABLE financial_adjustments DROP COLUMN refund_payment_id");
		await queryRunner.query("ALTER TABLE payments DROP COLUMN review_status");
	}
}
