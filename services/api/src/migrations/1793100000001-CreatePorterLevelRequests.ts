import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePorterLevelRequests1793100000001 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`
		 ALTER TABLE porter_route_qualifications ADD CONSTRAINT porter_qualification_identity UNIQUE(id,porter_id,route_id);
		 CREATE TABLE porter_level_requests (
		  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), qualification_id uuid NOT NULL, porter_id uuid NOT NULL, route_id uuid NOT NULL,
		  current_level porter_route_proficiency NOT NULL, current_verified boolean NOT NULL, target_level porter_route_proficiency NOT NULL,
		  reason varchar(2000) NOT NULL CHECK(length(trim(reason))>0), status varchar(16) NOT NULL DEFAULT 'pending'
		    CHECK(status IN ('pending','needs_info','approved','rejected','cancelled')),
		  version integer NOT NULL DEFAULT 1 CHECK(version>0), submission_hash varchar(64) NOT NULL,
		  decision_reason varchar(2000), decided_by uuid REFERENCES users(id) ON DELETE RESTRICT, decided_at timestamptz,
		  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
		  FOREIGN KEY(qualification_id,porter_id,route_id) REFERENCES porter_route_qualifications(id,porter_id,route_id) ON DELETE RESTRICT,
		  CHECK(array_position(ARRAY['learning','proficient','expert'],target_level::text)>array_position(ARRAY['learning','proficient','expert'],current_level::text))
		 );
		 CREATE UNIQUE INDEX porter_level_requests_one_open ON porter_level_requests(porter_id,route_id) WHERE status IN ('pending','needs_info');
		 CREATE INDEX porter_level_requests_queue ON porter_level_requests(status,created_at DESC);
		 CREATE TABLE porter_level_request_evidence (
		  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES porter_level_requests(id) ON DELETE RESTRICT,
		  file_ref uuid NOT NULL UNIQUE, file_name varchar(255) NOT NULL, mime_type varchar(100) NOT NULL,
		  size integer NOT NULL CHECK(size>0 AND size<=5242880), checksum varchar(64) NOT NULL,
		  uploaded_at timestamptz NOT NULL DEFAULT now(), removed_at timestamptz
		 );
		 CREATE TABLE porter_level_request_events (
		  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES porter_level_requests(id) ON DELETE RESTRICT,
		  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, action varchar(32) NOT NULL,
		  from_status varchar(16), to_status varchar(16) NOT NULL, reason varchar(2000), snapshot jsonb NOT NULL,
		  created_at timestamptz NOT NULL DEFAULT now()
		 );
		 ALTER TABLE porter_level_decisions ADD COLUMN source varchar(16) NOT NULL DEFAULT 'direct' CHECK(source IN ('direct','request')),
		  ADD COLUMN request_id uuid REFERENCES porter_level_requests(id) ON DELETE RESTRICT,
		  ADD COLUMN action varchar(16) CHECK(action IN ('upgrade','downgrade','recognize','reject')),
		  ADD COLUMN from_verified boolean, ADD COLUMN to_verified boolean,
		  ADD COLUMN evidence_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
		  ADD COLUMN porter_reason varchar(2000);
		 CREATE UNIQUE INDEX porter_level_decisions_request ON porter_level_decisions(request_id) WHERE request_id IS NOT NULL;
		 CREATE TABLE porter_level_notification_outbox (
		  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
		  payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz
		 );
		 CREATE TABLE porter_level_notifications (
		  id uuid PRIMARY KEY REFERENCES porter_level_notification_outbox(id) ON DELETE RESTRICT,
		  recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, payload jsonb NOT NULL,
		  created_at timestamptz NOT NULL, read_at timestamptz
		 );
		 CREATE INDEX porter_level_notifications_recipient ON porter_level_notifications(recipient_id,created_at DESC);
		`);
	}
	async down(runner: QueryRunner): Promise<void> {
		await runner.query(`DROP TABLE porter_level_notifications; DROP TABLE porter_level_notification_outbox;
		 DROP INDEX porter_level_decisions_request;
		 ALTER TABLE porter_level_decisions DROP COLUMN source,DROP COLUMN request_id,DROP COLUMN action,DROP COLUMN from_verified,DROP COLUMN to_verified,DROP COLUMN evidence_snapshot,DROP COLUMN porter_reason;
		 DROP TABLE porter_level_request_events; DROP TABLE porter_level_request_evidence; DROP TABLE porter_level_requests;
		 ALTER TABLE porter_route_qualifications DROP CONSTRAINT porter_qualification_identity;`);
	}
}
