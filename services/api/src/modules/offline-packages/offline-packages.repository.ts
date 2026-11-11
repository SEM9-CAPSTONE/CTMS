import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource, type EntityManager } from "typeorm";
import {
	LEASE_SECONDS,
	MAX_ATTEMPTS,
	PackageFailure,
	type PackageJob,
	PackageJobStatus,
	type PackageMetadata,
	PackageReason,
} from "./offline-packages.types";

@Injectable()
export class OfflinePackagesRepository {
	constructor(private readonly db: DataSource) {}

	async request(tripId: string, requestKey: string): Promise<PackageJob> {
		return this.db.transaction(async (manager) => {
			const trips: { status: string }[] = await manager.query(
				"SELECT status FROM trips WHERE id=$1 FOR SHARE",
				[tripId]
			);
			if (trips[0]?.status !== "published")
				throw new PackageFailure([PackageReason.TRIP_NOT_PUBLISHED]);
			await manager.query(
				"INSERT INTO offline_package_jobs(trip_id,request_key) VALUES($1,$2) ON CONFLICT(trip_id,request_key) DO NOTHING",
				[tripId, requestKey]
			);
			const jobs: PackageJob[] = await manager.query(
				"SELECT * FROM offline_package_jobs WHERE trip_id=$1 AND request_key=$2",
				[tripId, requestKey]
			);
			return jobs[0];
		});
	}
	async claim(): Promise<PackageJob | null> {
		return this.db.transaction(async (manager) => {
			const exhausted: PackageJob[] = await manager.query(
				`WITH changed AS (UPDATE offline_package_jobs SET status='FAILED',
			 reason_codes='["LEASE_LOST"]',lease_token=NULL,lease_until=NULL,completed_at=clock_timestamp()
			 WHERE status='GENERATING' AND lease_until<=clock_timestamp() AND attempts >= $1 RETURNING *) SELECT * FROM changed`,
				[MAX_ATTEMPTS]
			);
			for (const job of exhausted)
				await this.audit(manager, job.id, PackageJobStatus.FAILED, [PackageReason.LEASE_LOST]);
			const jobs: PackageJob[] = await manager.query(
				`
			 WITH candidate AS (
			  SELECT id FROM offline_package_jobs WHERE attempts<$1 AND
			  ((status IN ('PENDING','RETRYABLE_FAILED') AND next_attempt_at<=clock_timestamp())
			   OR (status='GENERATING' AND lease_until<=clock_timestamp()))
			  ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1
			 ), changed AS (UPDATE offline_package_jobs j SET status='GENERATING',attempts=attempts+1,
			 generation_started_at=COALESCE(generation_started_at,clock_timestamp()),
			 lease_token=$2,lease_until=clock_timestamp()+make_interval(secs=>$3)
			 FROM candidate c WHERE j.id=c.id RETURNING j.*) SELECT * FROM changed`,
				[MAX_ATTEMPTS, randomUUID(), LEASE_SECONDS]
			);
			const job = jobs[0];
			if (job) await this.audit(manager, job.id, PackageJobStatus.GENERATING);
			return job ?? null;
		});
	}
	async heartbeat(job: PackageJob): Promise<boolean> {
		const rows: { id: string }[] = await this.db.query(
			`WITH changed AS (UPDATE offline_package_jobs
		 SET lease_until=clock_timestamp()+make_interval(secs=>$3)
		 WHERE id=$1 AND lease_token=$2 AND status='GENERATING' AND lease_until>clock_timestamp() RETURNING id) SELECT * FROM changed`,
			[job.id, job.lease_token, LEASE_SECONDS]
		);
		return rows.length === 1;
	}
	async assertLease(manager: EntityManager, job: PackageJob): Promise<void> {
		const rows: { id: string }[] = await manager.query(
			`SELECT id FROM offline_package_jobs
		 WHERE id=$1 AND lease_token=$2 AND status='GENERATING' AND lease_until>clock_timestamp() FOR UPDATE`,
			[job.id, job.lease_token]
		);
		if (!rows.length) throw new PackageFailure([PackageReason.LEASE_LOST], true);
	}
	async complete(
		manager: EntityManager,
		job: PackageJob,
		metadata: PackageMetadata
	): Promise<void> {
		const rows: { id: string }[] = await manager.query(
			`WITH changed AS (UPDATE offline_package_jobs SET status='READY',package_id=$3,
		 lease_token=NULL,lease_until=NULL,reason_codes='[]',completed_at=clock_timestamp()
		 WHERE id=$1 AND lease_token=$2 AND status='GENERATING' AND lease_until>clock_timestamp() RETURNING id) SELECT * FROM changed`,
			[job.id, job.lease_token, metadata.id]
		);
		if (!rows.length) throw new PackageFailure([PackageReason.LEASE_LOST], true);
		await this.audit(manager, job.id, PackageJobStatus.READY);
	}
	async fail(job: PackageJob, failure: PackageFailure): Promise<void> {
		const terminalFailure = failure.reasons.includes(PackageReason.ARTIFACT_INVALID);
		const status = terminalFailure
			? PackageJobStatus.FAILED
			: failure.retryable
				? job.attempts < MAX_ATTEMPTS
					? PackageJobStatus.RETRYABLE_FAILED
					: PackageJobStatus.FAILED
				: PackageJobStatus.BLOCKED;
		await this.db.transaction(async (manager) => {
			const rows: { id: string }[] = await manager.query(
				`WITH changed AS (UPDATE offline_package_jobs SET status=$3::varchar,
			 reason_codes=$4::jsonb,lease_token=NULL,lease_until=NULL,
			 next_attempt_at=clock_timestamp()+make_interval(secs=>$5),
			 completed_at=CASE WHEN $3::varchar='RETRYABLE_FAILED' THEN NULL ELSE clock_timestamp() END
			 WHERE id=$1 AND lease_token=$2 AND status='GENERATING' AND lease_until>clock_timestamp() RETURNING id) SELECT * FROM changed`,
				[job.id, job.lease_token, status, JSON.stringify(failure.reasons), 5 * 2 ** job.attempts]
			);
			if (rows.length) await this.audit(manager, job.id, status, failure.reasons);
		});
	}
	async audit(
		manager: EntityManager,
		jobId: string,
		status: PackageJobStatus,
		reasons: PackageReason[] = []
	): Promise<void> {
		await manager.query(
			"INSERT INTO offline_package_audit(job_id,status,reason_codes) VALUES($1,$2,$3::jsonb)",
			[jobId, status, JSON.stringify(reasons)]
		);
	}
	async status(tripId: string, jobId: string): Promise<PackageJob | null> {
		const rows: PackageJob[] = await this.db.query(
			"SELECT * FROM offline_package_jobs WHERE trip_id=$1 AND id=$2",
			[tripId, jobId]
		);
		return rows[0] ?? null;
	}
	async ready(tripId: string, version?: number): Promise<PackageMetadata | null> {
		const rows: PackageMetadata[] = await this.db.query(
			`SELECT id,trip_id,package_version,generation_key,
		 schema_version,manifest,sha256,size_bytes,artifact_key,generated_at FROM offline_packages
		 WHERE trip_id=$1 AND ($2::integer IS NULL OR package_version=$2) ORDER BY package_version DESC LIMIT 1`,
			[tripId, version ?? null]
		);
		return rows[0] ?? null;
	}
}
