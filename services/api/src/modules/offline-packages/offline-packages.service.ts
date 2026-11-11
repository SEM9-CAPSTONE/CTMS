import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource } from "typeorm";
// biome-ignore lint/style/useImportType: Nest injection
import { OfflinePackagesRepository } from "./offline-packages.repository";
// biome-ignore lint/style/useImportType: Nest injection
import {
	type ApprovedGuidanceUnit,
	type NormalizedPackageHazard,
	OfflineSafetySources,
	PACKAGE_SCHEMA_VERSION,
	PackageFailure,
	type PackageJob,
	type PackageMetadata,
	PackageReason,
	type PackageSnapshot,
	type ReadyPackageMetadata,
	type TripSafetyContext,
} from "./offline-packages.types";
// biome-ignore lint/style/useImportType: Nest injection
import { PackageArtifactBuilder } from "./package-artifact.builder";
// biome-ignore lint/style/useImportType: Nest injection
import { PackageArtifactStorage } from "./package-artifact.storage";
// biome-ignore lint/style/useImportType: Nest injection
import { PackageCoreReader } from "./package-core.reader";
// biome-ignore lint/style/useImportType: Nest injection
import {
	ApprovedGuidanceSelector,
	EligibleHazardResolver,
	PackageEligibilityValidator,
	TripSafetyContextResolver,
	canonical,
	digest,
	generationKey,
	sourceFingerprint,
} from "./package-policy";
import { readVerifiedPackageRoute } from "./package-route.reader";

@Injectable()
export class OfflinePackagesService {
	constructor(
		private readonly db: DataSource,
		private readonly jobs: OfflinePackagesRepository,
		private readonly coreReader: PackageCoreReader,
		private readonly sources: OfflineSafetySources,
		private readonly contextResolver: TripSafetyContextResolver,
		private readonly hazardResolver: EligibleHazardResolver,
		private readonly guidanceSelector: ApprovedGuidanceSelector,
		private readonly validator: PackageEligibilityValidator,
		private readonly builder: PackageArtifactBuilder,
		private readonly storage: PackageArtifactStorage
	) {}
	requestInitial(tripId: string): Promise<PackageJob> {
		return this.jobs.request(tripId, "initial");
	}
	requestImpact(tripId: string, impactId: string): Promise<PackageJob> {
		if (!impactId.trim() || impactId.length > 1000)
			throw new Error("Stable impact identity required");
		return this.jobs.request(tripId, `impact:${digest(impactId)}`);
	}
	getJobStatus(tripId: string, jobId: string): Promise<PackageJob | null> {
		return this.jobs.status(tripId, jobId);
	}
	async getReadyMetadata(tripId: string, version?: number): Promise<ReadyPackageMetadata | null> {
		const row = await this.jobs.ready(tripId, version);
		if (!row) return null;
		return {
			id: row.id,
			tripId: row.trip_id,
			packageVersion: row.package_version,
			generationKey: row.generation_key,
			schemaVersion: row.schema_version,
			sha256: row.sha256,
			sizeBytes: row.size_bytes,
			generatedAt: new Date(row.generated_at).toISOString(),
			contentType: "application/zip",
		};
	}
	async getManifest(tripId: string, version?: number) {
		return (await this.jobs.ready(tripId, version))?.manifest ?? null;
	}
	/** Trusted service only. CTMS-053 must authorize the participant before calling. */
	async readArtifact(tripId: string, version: number): Promise<Buffer | null> {
		const metadata = await this.jobs.ready(tripId, version);
		if (!metadata) return null;
		return this.readSnapshotArtifact(metadata);
	}
	/** Trusted caller supplies metadata read in its transaction; never reselect a newer version. */
	async readSnapshotRoute(metadata: PackageMetadata) {
		return readVerifiedPackageRoute(await this.readSnapshotArtifact(metadata), metadata);
	}

	private async readSnapshotArtifact(metadata: PackageMetadata): Promise<Buffer> {
		const bytes = await this.storage.read(
			metadata.artifact_key,
			metadata.sha256,
			metadata.size_bytes
		);
		this.builder.verify(bytes, metadata.manifest);
		return bytes;
	}
	private selection(snapshot: PackageSnapshot): {
		context: TripSafetyContext;
		hazards: NormalizedPackageHazard[];
		guidance: ApprovedGuidanceUnit[];
	} {
		const now = Date.now();
		const context = this.contextResolver.resolve(snapshot.core, snapshot.safety);
		const hazards = this.hazardResolver.resolve(snapshot.safety, context, now);
		const guidance = this.guidanceSelector.select(snapshot.safety, context, now);
		this.validator.validate(snapshot.core, snapshot.safety, context, hazards, guidance, now);
		return { context, hazards, guidance };
	}
	async generate(job: PackageJob): Promise<void> {
		const snapshot = await this.db.transaction(
			"REPEATABLE READ",
			async (manager): Promise<PackageSnapshot> => {
				await manager.query("SET LOCAL statement_timeout='15s'");
				const core = await this.coreReader.read(manager, job.trip_id);
				const safety = await this.sources.read(manager, core, false);
				const versions: { version: number }[] = await manager.query(
					"SELECT COALESCE(max(package_version),0)+1 AS version FROM offline_packages WHERE trip_id=$1",
					[job.trip_id]
				);
				return {
					core,
					safety,
					coreFingerprint: digest(canonical(core)),
					sourceFingerprint: sourceFingerprint(safety),
					nextVersion: versions[0].version,
				};
			}
		);
		const selected = this.selection(snapshot);
		const identity = generationKey(snapshot.coreFingerprint, snapshot.sourceFingerprint);
		// Stable across retries of the durable request, including process restarts.
		const generatedAt = new Date(job.generation_started_at ?? job.created_at).toISOString();
		const artifact = this.builder.build(
			snapshot,
			selected.context,
			selected.hazards,
			selected.guidance,
			generatedAt
		);
		const key = `${artifact.sha256}.zip`;
		await this.db.transaction(async (manager) => {
			await this.jobs.assertLease(manager, job);
			await manager.query(
				`INSERT INTO offline_package_artifact_cleanup(artifact_key,job_id) VALUES($1,$2)
			 ON CONFLICT(artifact_key) DO UPDATE SET job_id=$2,next_cleanup_at=clock_timestamp()+interval '1 hour'`,
				[key, job.id]
			);
		});
		await this.storage.put(key, artifact.bytes);
		await this.db.transaction(async (manager) => {
			await manager.query("SET LOCAL lock_timeout='5s'");
			await manager.query("SET LOCAL statement_timeout='15s'");
			const core = await this.coreReader.read(manager, job.trip_id, true);
			// Serializes version allocation without holding a connection during ZIP construction.
			await manager.query("SELECT pg_advisory_xact_lock(hashtextextended($1,52))", [job.trip_id]);
			await this.jobs.assertLease(manager, job);
			const safety = await this.sources.read(manager, core, true);
			if (
				digest(canonical(core)) !== snapshot.coreFingerprint ||
				sourceFingerprint(safety) !== snapshot.sourceFingerprint ||
				safety.revision !== snapshot.safety.revision
			)
				throw new PackageFailure([PackageReason.SOURCE_CHANGED], true);
			const currentSelection = this.selection({ ...snapshot, core, safety });
			if (canonical(currentSelection) !== canonical(selected))
				throw new PackageFailure([PackageReason.SOURCE_CHANGED], true);
			const existing: PackageMetadata[] = await manager.query(
				"SELECT * FROM offline_packages WHERE trip_id=$1 AND generation_key=$2",
				[job.trip_id, identity]
			);
			if (existing[0]) {
				const previous = existing[0];
				this.builder.verify(
					await this.storage.read(previous.artifact_key, previous.sha256, previous.size_bytes),
					previous.manifest
				);
				await this.jobs.complete(manager, job, previous);
				return;
			}
			const versions: { version: number }[] = await manager.query(
				"SELECT COALESCE(max(package_version),0)+1 AS version FROM offline_packages WHERE trip_id=$1",
				[job.trip_id]
			);
			if (versions[0].version !== snapshot.nextVersion)
				throw new PackageFailure([PackageReason.VERSION_CONFLICT], true);
			await manager.query(
				"SELECT artifact_key FROM offline_package_artifact_cleanup WHERE artifact_key=$1 FOR UPDATE",
				[key]
			);
			this.builder.verify(
				await this.storage.read(key, artifact.sha256, artifact.bytes.length),
				artifact.manifest
			);
			const packages: PackageMetadata[] = await manager.query(
				`INSERT INTO offline_packages
			 (trip_id,package_version,generation_key,schema_version,manifest,provenance,sha256,size_bytes,artifact_key,generated_at)
			 VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10) RETURNING *`,
				[
					job.trip_id,
					snapshot.nextVersion,
					identity,
					PACKAGE_SCHEMA_VERSION,
					canonical(artifact.manifest),
					canonical(snapshot.safety),
					artifact.sha256,
					artifact.bytes.length,
					key,
					generatedAt,
				]
			);
			await this.jobs.complete(manager, job, packages[0]);
			await manager.query("DELETE FROM offline_package_artifact_cleanup WHERE artifact_key=$1", [
				key,
			]);
		});
	}
	async cleanupOrphans(): Promise<void> {
		await this.storage.cleanupTemporary();
		await this.db.transaction(async (manager) => {
			const rows: { artifact_key: string }[] =
				await manager.query(`SELECT c.artifact_key FROM offline_package_artifact_cleanup c
			 WHERE c.next_cleanup_at<=clock_timestamp()
			 AND NOT EXISTS(SELECT 1 FROM offline_packages p WHERE p.artifact_key=c.artifact_key)
			 AND NOT EXISTS(SELECT 1 FROM offline_package_jobs j WHERE j.id=c.job_id AND j.status='GENERATING' AND j.lease_until>clock_timestamp())
			 ORDER BY c.next_cleanup_at LIMIT 10 FOR UPDATE OF c SKIP LOCKED`);
			for (const row of rows) {
				await this.storage.remove(row.artifact_key);
				await manager.query(
					"UPDATE offline_package_artifact_cleanup SET next_cleanup_at=clock_timestamp()+interval '1 hour' WHERE artifact_key=$1",
					[row.artifact_key]
				);
			}
		});
	}
}
