import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAutomaticCheckpointArrivals1794600000000 implements MigrationInterface {
	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS checkpoint_arrival_contexts (
				trip_id uuid PRIMARY KEY REFERENCES trips(id) ON DELETE RESTRICT,
				route_id uuid NOT NULL REFERENCES trekking_routes(id) ON DELETE RESTRICT,
				route_version varchar(64) NOT NULL CHECK (length(route_version) > 0),
				package_id uuid NOT NULL,
				package_version varchar(64) NOT NULL CHECK (length(package_version) > 0),
				checkpoints jsonb NOT NULL CHECK (jsonb_typeof(checkpoints) = 'array'),
				context_source varchar(32) NOT NULL DEFAULT 'authoritative',
				created_at timestamptz NOT NULL DEFAULT now(),
				UNIQUE (trip_id, route_id, route_version, package_id, package_version)
			);
			ALTER TABLE checkpoint_arrival_contexts ADD COLUMN IF NOT EXISTS context_source varchar(32) NOT NULL DEFAULT 'authoritative';
			CREATE TABLE IF NOT EXISTS automatic_checkpoint_visits (
				id uuid PRIMARY KEY,
				trip_id uuid NOT NULL,
				user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
				checkpoint_id uuid NOT NULL,
				route_id uuid NOT NULL,
				route_version varchar(64) NOT NULL,
				package_id uuid NOT NULL,
				package_version varchar(64) NOT NULL,
				event_type varchar(32) NOT NULL DEFAULT 'CHECKPOINT_REACHED'
					CHECK (event_type = 'CHECKPOINT_REACHED'),
				event_time timestamptz NOT NULL,
				location geography(Point,4326) NOT NULL,
				samples jsonb NOT NULL CHECK (jsonb_array_length(samples) = 3),
				detected_offline boolean NOT NULL,
				fingerprint varchar(64) NOT NULL,
				received_at timestamptz NOT NULL DEFAULT now(),
				FOREIGN KEY (trip_id, route_id, route_version, package_id, package_version)
					REFERENCES checkpoint_arrival_contexts
					(trip_id, route_id, route_version, package_id, package_version) ON DELETE RESTRICT,
				UNIQUE (trip_id, user_id, checkpoint_id)
			);
			ALTER TABLE automatic_checkpoint_visits DROP CONSTRAINT IF EXISTS automatic_checkpoint_visits_checkpoint_id_fkey;
		`);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			"DROP TABLE IF EXISTS automatic_checkpoint_visits; DROP TABLE IF EXISTS checkpoint_arrival_contexts;"
		);
	}
}
