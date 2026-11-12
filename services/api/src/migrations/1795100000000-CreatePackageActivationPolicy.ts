import type { MigrationInterface, QueryRunner } from "typeorm";

/** Additive only: legacy Trips have no requirement and keep their existing lifecycle. */
export class CreatePackageActivationPolicy1795100000000 implements MigrationInterface {
	async up(q: QueryRunner): Promise<void> {
		await q.query(`CREATE TABLE offline_package_requirements (
   trip_id uuid PRIMARY KEY REFERENCES trips(id) ON DELETE RESTRICT,
   package_id uuid NOT NULL, required_at timestamptz NOT NULL DEFAULT now(),
   last_checked_at timestamptz, last_reason_code varchar(64),
   FOREIGN KEY(package_id,trip_id) REFERENCES offline_packages(id,trip_id) ON DELETE RESTRICT
  );
  CREATE TABLE offline_package_device_reports (
   trip_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
   device_id uuid NOT NULL, package_id uuid NOT NULL, verified_sha256 varchar(64),
   status varchar(12) NOT NULL CHECK(status IN ('downloaded','verified','active')),
   downloaded_at timestamptz NOT NULL DEFAULT now(), verified_at timestamptz, activated_at timestamptz,
   PRIMARY KEY(trip_id,user_id,device_id,package_id),
   FOREIGN KEY(package_id,trip_id) REFERENCES offline_packages(id,trip_id) ON DELETE RESTRICT,
   CHECK(verified_sha256 IS NULL OR verified_sha256 ~ '^[a-f0-9]{64}$'),
   CHECK(status='downloaded' OR (verified_sha256 IS NOT NULL AND verified_at IS NOT NULL)),
   CHECK(status<>'active' OR activated_at IS NOT NULL)
  );
  CREATE UNIQUE INDEX offline_package_device_active ON offline_package_device_reports(trip_id,user_id,device_id) WHERE status='active';
  CREATE TABLE offline_package_departures (
   trip_id uuid PRIMARY KEY REFERENCES trips(id) ON DELETE RESTRICT,
   user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, device_id uuid NOT NULL,
   package_id uuid NOT NULL, confirmed_at timestamptz NOT NULL DEFAULT now(), locked_at timestamptz,
   FOREIGN KEY(trip_id,user_id,device_id,package_id) REFERENCES offline_package_device_reports(trip_id,user_id,device_id,package_id) ON DELETE RESTRICT
  );
  CREATE TABLE offline_package_departure_notifications (
   id uuid PRIMARY KEY, episode_id uuid NOT NULL,
   trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
   recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
   reason_code varchar(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),read_at timestamptz,
   UNIQUE(episode_id,recipient_id)
  );
  CREATE INDEX offline_package_departure_notification_inbox ON offline_package_departure_notifications(recipient_id,created_at DESC,id);`);
	}
	async down(q: QueryRunner): Promise<void> {
		await q.query(
			"DROP TABLE offline_package_departure_notifications; DROP TABLE offline_package_departures; DROP TABLE offline_package_device_reports; DROP TABLE offline_package_requirements;"
		);
	}
}
