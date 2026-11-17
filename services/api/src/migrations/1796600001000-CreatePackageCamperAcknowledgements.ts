import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePackageCamperAcknowledgements1796600001000 implements MigrationInterface {
	async up(q: QueryRunner): Promise<void> {
		await q.query(`
		 CREATE TABLE offline_package_camper_acknowledgements (
		   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
		   trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
		   user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
		   package_id uuid,
		   policy_version varchar(64) NOT NULL,
		   confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
		   FOREIGN KEY(package_id,trip_id) REFERENCES offline_packages(id,trip_id) ON DELETE RESTRICT
		 );
		 CREATE UNIQUE INDEX offline_package_camper_ack_scope
		   ON offline_package_camper_acknowledgements(trip_id,user_id,policy_version,package_id)
		   NULLS NOT DISTINCT;
		`);
	}

	async down(q: QueryRunner): Promise<void> {
		await q.query("DROP TABLE offline_package_camper_acknowledgements");
	}
}
