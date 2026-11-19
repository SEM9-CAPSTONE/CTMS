import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePorterCertificates1796800000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`
			DO $$ BEGIN
				CREATE TYPE porter_certificate_type AS ENUM ('wfa', 'rescue', 'guide_card', 'other');
			EXCEPTION
				WHEN duplicate_object THEN null;
			END $$;

			DO $$ BEGIN
				CREATE TYPE porter_certificate_status AS ENUM ('pending', 'verified', 'rejected');
			EXCEPTION
				WHEN duplicate_object THEN null;
			END $$;

			CREATE TABLE IF NOT EXISTS porter_certificates (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				porter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				type porter_certificate_type NOT NULL,
				name varchar(255) NOT NULL,
				certificate_number varchar(100),
				issued_by varchar(255),
				issued_date date,
				expiry_date date,
				file_url varchar(1000),
				status porter_certificate_status NOT NULL DEFAULT 'pending',
				rejection_reason varchar(1000),
				verified_by uuid REFERENCES users(id) ON DELETE RESTRICT,
				verified_at timestamptz,
				created_at timestamptz NOT NULL DEFAULT now(),
				updated_at timestamptz NOT NULL DEFAULT now(),
				deleted_at timestamptz
			);

			CREATE INDEX IF NOT EXISTS idx_porter_certificates_porter ON porter_certificates(porter_id) WHERE deleted_at IS NULL;
			CREATE INDEX IF NOT EXISTS idx_porter_certificates_status ON porter_certificates(status) WHERE deleted_at IS NULL;
			CREATE UNIQUE INDEX IF NOT EXISTS uq_porter_certificates_number ON porter_certificates(porter_id, type, certificate_number)
				WHERE deleted_at IS NULL AND certificate_number IS NOT NULL AND length(trim(certificate_number)) > 0;
		`);
	}

	async down(runner: QueryRunner): Promise<void> {
		await runner.query(`
			DROP TABLE IF EXISTS porter_certificates;
			DROP TYPE IF EXISTS porter_certificate_status;
			DROP TYPE IF EXISTS porter_certificate_type;
		`);
	}
}
