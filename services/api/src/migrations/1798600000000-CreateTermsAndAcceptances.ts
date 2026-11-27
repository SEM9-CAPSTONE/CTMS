import type { MigrationInterface, QueryRunner } from "typeorm";
import {
	DEFAULT_TERMS_EFFECTIVE_DATE,
	DEFAULT_TERMS_SUMMARY,
	DEFAULT_TERMS_TITLE,
	DEFAULT_TERMS_V1_SECTIONS,
	DEFAULT_TERMS_VERSION,
} from "../modules/terms/terms-content";

export class CreateTermsAndAcceptances1798600000000 implements MigrationInterface {
	name = "CreateTermsAndAcceptances1798600000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "terms_versions" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"version" varchar(32) NOT NULL,
				"title" varchar(200) NOT NULL,
				"summary" text,
				"effective_date" date NOT NULL,
				"sections" jsonb NOT NULL,
				"is_active" boolean NOT NULL DEFAULT false,
				"requires_reconsent" boolean NOT NULL DEFAULT true,
				"published_at" timestamptz NOT NULL DEFAULT now(),
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_terms_versions_id" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_terms_versions_version" UNIQUE ("version")
			)
		`);

		await queryRunner.query(`
			CREATE UNIQUE INDEX IF NOT EXISTS "UQ_terms_versions_single_active"
			ON "terms_versions" ("is_active")
			WHERE "is_active" = true
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "user_terms_acceptances" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"user_id" uuid NOT NULL,
				"terms_version_id" uuid NOT NULL,
				"version" varchar(32) NOT NULL,
				"accepted_at" timestamptz NOT NULL DEFAULT now(),
				"source" varchar(32) NOT NULL DEFAULT 'reconsent',
				"platform" varchar(16) NOT NULL DEFAULT 'api',
				CONSTRAINT "PK_user_terms_acceptances_id" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_user_terms_acceptances_user_version" UNIQUE ("user_id", "terms_version_id"),
				CONSTRAINT "FK_user_terms_acceptances_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
				CONSTRAINT "FK_user_terms_acceptances_terms_version_id" FOREIGN KEY ("terms_version_id") REFERENCES "terms_versions"("id") ON DELETE RESTRICT
			)
		`);

		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_user_terms_acceptances_user_accepted_at"
			ON "user_terms_acceptances" ("user_id", "accepted_at" DESC)
		`);

		await queryRunner.query(
			`INSERT INTO "terms_versions" (
				"version",
				"title",
				"summary",
				"effective_date",
				"sections",
				"is_active",
				"requires_reconsent",
				"published_at"
			)
			VALUES ($1, $2, $3, $4::date, $5::jsonb, true, true, now())
			ON CONFLICT ("version") DO NOTHING`,
			[
				DEFAULT_TERMS_VERSION,
				DEFAULT_TERMS_TITLE,
				DEFAULT_TERMS_SUMMARY,
				DEFAULT_TERMS_EFFECTIVE_DATE,
				JSON.stringify(DEFAULT_TERMS_V1_SECTIONS),
			]
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_terms_acceptances_user_accepted_at"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "user_terms_acceptances"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_terms_versions_single_active"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "terms_versions"`);
	}
}
