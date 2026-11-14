import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Porter tour-guide card (bug-list item #4, extends CTMS-1). A Porter declares a domestic or
 * international guide card (site-only cards are not accepted), the system reads the uploaded card
 * photo and records its automatic check, and an Admin must confirm the official registry lookup
 * before approving. Porters approved before this change keep their status (no card on file).
 * "A submitted verification has a card" is enforced by the service, not a CHECK, so rows already
 * pending review before this change do not block the migration.
 */
export class AddPorterGuideCard1795800000000 implements MigrationInterface {
	name = "AddPorterGuideCard1795800000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "porter_verifications"
				ADD COLUMN "guide_card_type" varchar(16),
				ADD COLUMN "guide_card_number" varchar(9),
				ADD COLUMN "guide_card_expires_on" date,
				ADD COLUMN "card_check" jsonb,
				ADD COLUMN "card_checked_at" timestamptz,
				ADD COLUMN "registry_checked_by" uuid,
				ADD COLUMN "registry_checked_at" timestamptz,
				ADD CONSTRAINT "CHK_porter_verifications_card_type"
					CHECK ("guide_card_type" IS NULL OR "guide_card_type" IN ('noi_dia', 'quoc_te')),
				ADD CONSTRAINT "CHK_porter_verifications_card_number"
					CHECK ("guide_card_number" IS NULL OR "guide_card_number" ~ '^[0-9]{9}$'),
				ADD CONSTRAINT "CHK_porter_verifications_registry_check"
					CHECK (("registry_checked_by" IS NULL) = ("registry_checked_at" IS NULL)),
				ADD CONSTRAINT "FK_porter_verifications_registry_checked_by" FOREIGN KEY ("registry_checked_by")
					REFERENCES "users" ("id") ON DELETE SET NULL
		`);
		await queryRunner.query(
			`ALTER TABLE "porter_verification_documents" ADD COLUMN "extraction" jsonb`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "porter_verification_documents" DROP COLUMN "extraction"`);
		await queryRunner.query(`
			ALTER TABLE "porter_verifications"
				DROP CONSTRAINT "FK_porter_verifications_registry_checked_by",
				DROP CONSTRAINT "CHK_porter_verifications_registry_check",
				DROP CONSTRAINT "CHK_porter_verifications_card_number",
				DROP CONSTRAINT "CHK_porter_verifications_card_type",
				DROP COLUMN "registry_checked_at",
				DROP COLUMN "registry_checked_by",
				DROP COLUMN "card_checked_at",
				DROP COLUMN "card_check",
				DROP COLUMN "guide_card_expires_on",
				DROP COLUMN "guide_card_number",
				DROP COLUMN "guide_card_type"
		`);
	}
}
