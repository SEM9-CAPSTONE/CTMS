import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePorterLevelReviews1793100000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`
			CREATE TABLE porter_level_policies (
				level porter_route_proficiency PRIMARY KEY,
				definition jsonb NOT NULL,
				version integer NOT NULL CHECK (version > 0),
				updated_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
				updated_at timestamptz NOT NULL DEFAULT now()
			);
			CREATE TABLE porter_level_evidence (
				porter_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
				skills text[] NOT NULL,
				version integer NOT NULL CHECK (version > 0),
				updated_at timestamptz NOT NULL DEFAULT now()
			);
			CREATE TABLE porter_level_decisions (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				qualification_id uuid NOT NULL REFERENCES porter_route_qualifications(id) ON DELETE RESTRICT,
				porter_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
				route_id uuid NOT NULL REFERENCES trekking_routes(id) ON DELETE RESTRICT,
				actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
				outcome varchar(16) NOT NULL CHECK (outcome IN ('approved', 'rejected')),
				from_level porter_route_proficiency,
				to_level porter_route_proficiency NOT NULL,
				reason varchar(2000) NOT NULL CHECK (length(trim(reason)) > 0),
				policy_snapshot jsonb NOT NULL,
				dossier_snapshot jsonb NOT NULL,
				comparison_snapshot jsonb NOT NULL,
				decided_at timestamptz NOT NULL DEFAULT now()
			);
			CREATE INDEX porter_level_decisions_qualification ON porter_level_decisions(qualification_id, decided_at DESC);
			CREATE INDEX porter_level_decisions_porter ON porter_level_decisions(porter_id, decided_at DESC);
		`);
	}
	async down(runner: QueryRunner): Promise<void> {
		await runner.query(
			"DROP TABLE porter_level_decisions; DROP TABLE porter_level_evidence; DROP TABLE porter_level_policies;"
		);
	}
}
