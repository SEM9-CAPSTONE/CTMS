import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-112 (CTMS-300 / CTMS-421).
 * Creates:
 *  - `settlements` — snapshot of settled trip revenue and 5% platform commission
 *  - `host_wallets` — host wallet balance
 *  - `payouts` — host payout requests with bank transfer info
 *  - `wallet_transactions` — immutable ledger of wallet balance mutations
 */
export class CreateSettlementsAndHostWalletsTable1787210000000 implements MigrationInterface {
	name = "CreateSettlementsAndHostWalletsTable1787210000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		// -----------------------------------------------------------------------
		// settlements
		// -----------------------------------------------------------------------
		await queryRunner.query(`
			CREATE TABLE "settlements" (
				"id"              uuid          NOT NULL DEFAULT gen_random_uuid(),
				"trip_id"         uuid          NOT NULL,
				"host_id"         uuid          NOT NULL,
				"settlement_base" numeric(12,2) NOT NULL,
				"commission_rate" numeric(5,4)  NOT NULL DEFAULT 0.0500,
				"platform_fee"    numeric(12,2) NOT NULL,
				"net_amount"      numeric(12,2) NOT NULL,
				"settled_at"      timestamptz   NOT NULL DEFAULT now(),
				"created_at"      timestamptz   NOT NULL DEFAULT now(),
				"updated_at"      timestamptz   NOT NULL DEFAULT now(),
				CONSTRAINT "PK_settlements_id"
					PRIMARY KEY ("id"),
				CONSTRAINT "UQ_settlements_trip_id"
					UNIQUE ("trip_id"),
				CONSTRAINT "FK_settlements_trip_id"
					FOREIGN KEY ("trip_id")
					REFERENCES "trips" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_settlements_host_id"
					FOREIGN KEY ("host_id")
					REFERENCES "users" ("id") ON DELETE CASCADE,
				CONSTRAINT "CHK_settlements_base_non_negative"
					CHECK ("settlement_base" >= 0),
				CONSTRAINT "CHK_settlements_fee_non_negative"
					CHECK ("platform_fee" >= 0),
				CONSTRAINT "CHK_settlements_net_non_negative"
					CHECK ("net_amount" >= 0)
			)
		`);

		await queryRunner.query(`
			CREATE INDEX "IDX_settlements_host_id"
			ON "settlements" ("host_id")
		`);

		// -----------------------------------------------------------------------
		// host_wallets
		// -----------------------------------------------------------------------
		await queryRunner.query(`
			CREATE TABLE "host_wallets" (
				"id"         uuid          NOT NULL DEFAULT gen_random_uuid(),
				"host_id"    uuid          NOT NULL,
				"balance"    numeric(12,2) NOT NULL DEFAULT 0.00,
				"created_at" timestamptz   NOT NULL DEFAULT now(),
				"updated_at" timestamptz   NOT NULL DEFAULT now(),
				CONSTRAINT "PK_host_wallets_id"
					PRIMARY KEY ("id"),
				CONSTRAINT "UQ_host_wallets_host_id"
					UNIQUE ("host_id"),
				CONSTRAINT "FK_host_wallets_host_id"
					FOREIGN KEY ("host_id")
					REFERENCES "users" ("id") ON DELETE CASCADE,
				CONSTRAINT "CHK_host_wallets_balance_non_negative"
					CHECK ("balance" >= 0)
			)
		`);

		// -----------------------------------------------------------------------
		// payouts
		// -----------------------------------------------------------------------
		await queryRunner.query(`
			CREATE TABLE "payouts" (
				"id"                   uuid          NOT NULL DEFAULT gen_random_uuid(),
				"host_id"              uuid          NOT NULL,
				"wallet_id"            uuid          NOT NULL,
				"amount"               numeric(12,2) NOT NULL,
				"status"               varchar(32)   NOT NULL DEFAULT 'pending',
				"bank_name"            varchar(100)  NOT NULL,
				"account_number"       varchar(50)   NOT NULL,
				"account_holder_name"  varchar(100)  NOT NULL,
				"transaction_ref"      varchar(255),
				"rejection_reason"     varchar(255),
				"admin_notes"          text,
				"created_at"           timestamptz   NOT NULL DEFAULT now(),
				"updated_at"           timestamptz   NOT NULL DEFAULT now(),
				CONSTRAINT "PK_payouts_id"
					PRIMARY KEY ("id"),
				CONSTRAINT "FK_payouts_host_id"
					FOREIGN KEY ("host_id")
					REFERENCES "users" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_payouts_wallet_id"
					FOREIGN KEY ("wallet_id")
					REFERENCES "host_wallets" ("id") ON DELETE CASCADE,
				CONSTRAINT "CHK_payouts_amount_positive"
					CHECK ("amount" > 0)
			)
		`);

		await queryRunner.query(`
			CREATE INDEX "IDX_payouts_host_id_status"
			ON "payouts" ("host_id", "status")
		`);

		// -----------------------------------------------------------------------
		// wallet_transactions
		// -----------------------------------------------------------------------
		await queryRunner.query(`
			CREATE TABLE "wallet_transactions" (
				"id"            uuid          NOT NULL DEFAULT gen_random_uuid(),
				"wallet_id"     uuid          NOT NULL,
				"settlement_id" uuid,
				"payout_id"     uuid,
				"trip_id"       uuid,
				"type"          varchar(32)   NOT NULL,
				"base_amount"   numeric(12,2) NOT NULL DEFAULT 0.00,
				"fee_amount"    numeric(12,2) NOT NULL DEFAULT 0.00,
				"net_amount"    numeric(12,2) NOT NULL,
				"balance_after" numeric(12,2) NOT NULL,
				"description"   varchar(255)  NOT NULL,
				"created_at"    timestamptz   NOT NULL DEFAULT now(),
				CONSTRAINT "PK_wallet_transactions_id"
					PRIMARY KEY ("id"),
				CONSTRAINT "FK_wallet_transactions_wallet_id"
					FOREIGN KEY ("wallet_id")
					REFERENCES "host_wallets" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_wallet_transactions_settlement_id"
					FOREIGN KEY ("settlement_id")
					REFERENCES "settlements" ("id") ON DELETE SET NULL,
				CONSTRAINT "FK_wallet_transactions_payout_id"
					FOREIGN KEY ("payout_id")
					REFERENCES "payouts" ("id") ON DELETE SET NULL,
				CONSTRAINT "FK_wallet_transactions_trip_id"
					FOREIGN KEY ("trip_id")
					REFERENCES "trips" ("id") ON DELETE SET NULL
			)
		`);

		await queryRunner.query(`
			CREATE INDEX "IDX_wallet_transactions_wallet_id_created_at"
			ON "wallet_transactions" ("wallet_id", "created_at" DESC)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS "wallet_transactions"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "payouts"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "host_wallets"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "settlements"`);
	}
}
