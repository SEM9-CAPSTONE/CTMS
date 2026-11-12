import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { DataSource, type EntityManager } from "typeorm";
import type { PackageMetadata } from "./offline-packages.types";
import type { PackagePolicyContext } from "./package-activation.types";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { PackageArtifactBuilder } from "./package-artifact.builder";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { PackageArtifactStorage } from "./package-artifact.storage";
import { enqueueDepartureNotifications } from "./package-departure-notifications.service";
import type { PackageSourceFreshness } from "./package-freshness.source";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { PackageFreshnessSource } from "./package-freshness.source";

export interface DevicePackageReport {
	deviceId: string;
	packageId: string;
	status: "downloaded" | "verified" | "active";
	sha256?: string;
}
export interface DepartureCheck {
	ready: boolean;
	reasonCode: string;
	packageId?: string;
}
interface TripRow {
	status: string;
	checkedAt: Date;
}

@Injectable()
export class PackageActivationService {
	constructor(
		private readonly db: DataSource,
		private readonly freshness: PackageFreshnessSource,
		private readonly storage: PackageArtifactStorage,
		private readonly builder: PackageArtifactBuilder
	) {}

	private fail(code: string): never {
		throw new ConflictException({ code });
	}
	private async sourceState(
		m: EntityManager,
		tripId: string,
		packageId: string
	): Promise<PackageSourceFreshness> {
		try {
			return await this.freshness.read(m, tripId, packageId);
		} catch {
			return { state: "unknown", expiresAt: null, reasonCodes: ["SOURCE_FRESHNESS_UNAVAILABLE"] };
		}
	}
	private async artifactAvailable(pkg: PackageMetadata): Promise<boolean> {
		try {
			this.builder.verify(
				await this.storage.read(pkg.artifact_key, pkg.sha256, Number(pkg.size_bytes)),
				pkg.manifest
			);
			return true;
		} catch {
			return false;
		}
	}
	private async trip(
		m: EntityManager,
		tripId: string,
		userId: string,
		lock = false,
		allowHost = false
	): Promise<TripRow> {
		const rows: TripRow[] = await m.query(
			`SELECT t.status,transaction_timestamp() AS "checkedAt" FROM trips t WHERE t.id=$1 AND (
   EXISTS(SELECT 1 FROM trip_porters p WHERE p.trip_id=t.id AND p.porter_id=$2 AND p.status='assigned') OR
   EXISTS(SELECT 1 FROM booking_members bm JOIN bookings b ON b.id=bm.booking_id WHERE b.trip_id=t.id AND bm.user_id=$2 AND b.status='confirmed' AND bm.member_status IN ('registered','joined') AND bm.left_at IS NULL)
   OR ($3::boolean AND t.host_id=$2)) ${lock ? "FOR UPDATE OF t" : ""}`,
			[tripId, userId, allowHost]
		);
		if (!rows[0]) throw new NotFoundException({ code: "TRIP_NOT_ACCESSIBLE" });
		return rows[0];
	}
	private async exact(
		m: EntityManager,
		tripId: string,
		packageId: string
	): Promise<PackageMetadata> {
		const rows: PackageMetadata[] = await m.query(
			"SELECT * FROM offline_packages WHERE trip_id=$1 AND id=$2",
			[tripId, packageId]
		);
		if (!rows[0]) this.fail("PACKAGE_TRIP_MISMATCH");
		return rows[0];
	}
	private assertMutable(trip: TripRow): void {
		if (trip.status === "ongoing") this.fail("PACKAGE_VERSION_LOCKED");
		if (trip.status !== "published") this.fail("PACKAGE_TRIP_NOT_PUBLISHED");
	}
	async departureStatus(userId: string, tripId: string) {
		return this.db.transaction("REPEATABLE READ", async (m) => {
			const trip = await this.trip(m, tripId, userId, false, true);
			const [row]: Array<{
				last_checked_at: Date | null;
				last_reason_code: string | null;
				locked_at: Date | null;
			}> = await m.query(
				"SELECT r.last_checked_at,r.last_reason_code,d.locked_at FROM offline_package_requirements r LEFT JOIN offline_package_departures d ON d.trip_id=r.trip_id WHERE r.trip_id=$1",
				[tripId]
			);
			const blocked =
				trip.status === "published" &&
				!!row?.last_reason_code &&
				row.last_reason_code !== "PACKAGE_DEPARTURE_READY";
			return {
				tripId,
				tripStatus: trip.status,
				checkedAt: trip.checkedAt.toISOString(),
				blocked,
				state:
					trip.status === "completed" || trip.status === "cancelled"
						? "inactive"
						: row?.locked_at
							? "locked"
							: blocked
								? "blocked"
								: row?.last_reason_code === "PACKAGE_DEPARTURE_READY"
									? "ready"
									: "not_checked",
				reasonCode: row?.last_reason_code ?? null,
				lastCheckedAt: row?.last_checked_at?.toISOString() ?? null,
			};
		});
	}

	async context(
		userId: string,
		tripId: string,
		deviceId: string,
		packageId: string
	): Promise<PackagePolicyContext> {
		return this.db.transaction("REPEATABLE READ", async (m) => {
			const trip = await this.trip(m, tripId, userId);
			const pkg = await this.exact(m, tripId, packageId);
			const [latest]: PackageMetadata[] = await m.query(
				"SELECT * FROM offline_packages WHERE trip_id=$1 ORDER BY package_version DESC LIMIT 1",
				[tripId]
			);
			const [required]: Array<{
				package_id: string;
				package_version: number;
				last_checked_at: Date | null;
				last_reason_code: string | null;
			}> = await m.query(
				"SELECT r.package_id,p.package_version,r.last_checked_at,r.last_reason_code FROM offline_package_requirements r JOIN offline_packages p ON p.id=r.package_id WHERE r.trip_id=$1",
				[tripId]
			);
			const [report]: Array<{
				status: DevicePackageReport["status"];
				verified_sha256: string | null;
				downloaded_at: Date;
				verified_at: Date | null;
				activated_at: Date | null;
			}> = await m.query(
				"SELECT status,verified_sha256,downloaded_at,verified_at,activated_at FROM offline_package_device_reports WHERE trip_id=$1 AND user_id=$2 AND device_id=$3 AND package_id=$4",
				[tripId, userId, deviceId, packageId]
			);
			const [departure]: Array<{ package_id: string; locked_at: Date | null }> = await m.query(
				"SELECT package_id,locked_at FROM offline_package_departures WHERE trip_id=$1",
				[tripId]
			);
			return {
				departureCheck:
					required?.last_checked_at && required.last_reason_code
						? {
								checkedAt: required.last_checked_at.toISOString(),
								reasonCode: required.last_reason_code,
							}
						: null,
				tripId,
				tripStatus: trip.status,
				checkedAt: trip.checkedAt.toISOString(),
				selected: {
					packageId: pkg.id,
					version: pkg.package_version,
					updatedAt: pkg.generated_at.toISOString(),
				},
				integrity: {
					serverArtifact: (await this.artifactAvailable(pkg)) ? "verified" : "unavailable",
					state: report?.verified_sha256 === pkg.sha256 ? "client_reported_verified" : "unknown",
					serverVerifiedClientBytes: false,
				},
				publication: {
					latestVersion: latest.package_version,
					newerAvailable: latest.package_version > pkg.package_version,
					requiredPackageId: required?.package_id ?? null,
					requiredVersion: required?.package_version ?? null,
					updateRequired:
						trip.status === "published" && !!required && required.package_id !== pkg.id,
				},
				deviceReport: report
					? {
							state: report.status,
							downloadedAt: report.downloaded_at.toISOString(),
							verifiedAt: report.verified_at?.toISOString() ?? null,
							activatedAt: report.activated_at?.toISOString() ?? null,
						}
					: null,
				sourceFreshness: await this.sourceState(m, tripId, packageId),
				replaceAllowed: trip.status === "published",
				lockedPackageId: departure?.locked_at ? departure.package_id : null,
				lockedAt: departure?.locked_at?.toISOString() ?? null,
			};
		});
	}

	async report(userId: string, tripId: string, input: DevicePackageReport) {
		return this.db.transaction(async (m) => {
			const trip = await this.trip(m, tripId, userId, true);
			this.assertMutable(trip);
			const pkg = await this.exact(m, tripId, input.packageId);
			if (input.status !== "downloaded" && input.sha256 !== pkg.sha256)
				this.fail("PACKAGE_HASH_MISMATCH");
			if (input.status === "active") {
				try {
					this.builder.verify(
						await this.storage.read(pkg.artifact_key, pkg.sha256, Number(pkg.size_bytes)),
						pkg.manifest
					);
				} catch {
					this.fail("PACKAGE_ARTIFACT_UNAVAILABLE");
				}
				const [required]: Array<{ package_id: string }> = await m.query(
					"SELECT package_id FROM offline_package_requirements WHERE trip_id=$1",
					[tripId]
				);
				if (required && required.package_id !== pkg.id) this.fail("PACKAGE_UPDATE_REQUIRED");
				// Retain verification history while allowing pre-start device activation replacement.
				await m.query(
					"UPDATE offline_package_device_reports SET status='verified' WHERE trip_id=$1 AND user_id=$2 AND device_id=$3 AND package_id<>$4 AND status='active'",
					[tripId, userId, input.deviceId, pkg.id]
				);
			}
			await m.query(
				`INSERT INTO offline_package_device_reports(trip_id,user_id,device_id,package_id,status,verified_sha256,verified_at,activated_at)
    VALUES($1,$2,$3,$4,$5::varchar,$6,CASE WHEN $5::varchar<>'downloaded' THEN now() END,CASE WHEN $5::varchar='active' THEN now() END)
    ON CONFLICT(trip_id,user_id,device_id,package_id) DO UPDATE SET
    status=CASE WHEN offline_package_device_reports.status='active' OR EXCLUDED.status='active' THEN 'active' WHEN offline_package_device_reports.status='verified' OR EXCLUDED.status='verified' THEN 'verified' ELSE 'downloaded' END,
    verified_sha256=COALESCE(offline_package_device_reports.verified_sha256,EXCLUDED.verified_sha256),
    verified_at=COALESCE(offline_package_device_reports.verified_at,EXCLUDED.verified_at),activated_at=COALESCE(offline_package_device_reports.activated_at,EXCLUDED.activated_at)`,
				[
					tripId,
					userId,
					input.deviceId,
					pkg.id,
					input.status,
					input.status === "downloaded" ? null : input.sha256,
				]
			);
			return {
				accepted: true,
				verificationEvidence:
					input.status === "downloaded" ? "CLIENT_REPORTED_DOWNLOAD" : "CLIENT_REPORTED_HASH_MATCH",
			};
		});
	}

	async confirmDeparture(userId: string, tripId: string, input: DevicePackageReport) {
		return this.db.transaction(async (m) => {
			const trip = await this.trip(m, tripId, userId, true);
			this.assertMutable(trip);
			const [porter]: Array<{ id: string }> = await m.query(
				"SELECT trip_id AS id FROM trip_porters WHERE trip_id=$1 AND porter_id=$2 AND status='assigned'",
				[tripId, userId]
			);
			if (!porter) this.fail("DEPARTURE_RESPONSIBLE_PORTER_REQUIRED");
			await this.exact(m, tripId, input.packageId);
			const [active]: Array<{ package_id: string }> = await m.query(
				"SELECT package_id FROM offline_package_device_reports WHERE trip_id=$1 AND user_id=$2 AND device_id=$3 AND package_id=$4 AND status='active'",
				[tripId, userId, input.deviceId, input.packageId]
			);
			if (!active) this.fail("PACKAGE_ACTIVATION_REQUIRED");
			await m.query(
				`INSERT INTO offline_package_departures(trip_id,user_id,device_id,package_id) VALUES($1,$2,$3,$4)
    ON CONFLICT(trip_id) DO UPDATE SET user_id=EXCLUDED.user_id,device_id=EXCLUDED.device_id,package_id=EXCLUDED.package_id,
    confirmed_at=CASE WHEN offline_package_departures.user_id=EXCLUDED.user_id AND offline_package_departures.device_id=EXCLUDED.device_id AND offline_package_departures.package_id=EXCLUDED.package_id THEN offline_package_departures.confirmed_at ELSE now() END`,
				[tripId, userId, input.deviceId, input.packageId]
			);
			const check = await this.assertDepartureReady(m, tripId, false);
			if (!check.ready) this.fail(check.reasonCode);
			return check;
		});
	}

	/** Internal CTMS-119 handoff. Publisher must use the same Trip lock as departure. */
	async requirePackage(m: EntityManager, tripId: string, packageId: string): Promise<void> {
		const [trip]: TripRow[] = await m.query("SELECT status FROM trips WHERE id=$1 FOR UPDATE", [
			tripId,
		]);
		if (!trip) throw new NotFoundException({ code: "TRIP_NOT_ACCESSIBLE" });
		this.assertMutable(trip);
		await this.exact(m, tripId, packageId);
		await m.query(
			"INSERT INTO offline_package_requirements(trip_id,package_id) VALUES($1,$2) ON CONFLICT(trip_id) DO UPDATE SET last_checked_at=CASE WHEN offline_package_requirements.package_id=EXCLUDED.package_id THEN offline_package_requirements.last_checked_at END,last_reason_code=CASE WHEN offline_package_requirements.package_id=EXCLUDED.package_id THEN offline_package_requirements.last_reason_code END,package_id=EXCLUDED.package_id,required_at=CASE WHEN offline_package_requirements.package_id=EXCLUDED.package_id THEN offline_package_requirements.required_at ELSE now() END",
			[tripId, packageId]
		);
	}

	/** Caller holds the Trip write lock and commits locked_at together with ongoing. */
	async assertDepartureReady(
		m: EntityManager,
		tripId: string,
		lock = true
	): Promise<DepartureCheck> {
		const [required]: Array<{ package_id: string }> = await m.query(
			"SELECT package_id FROM offline_package_requirements WHERE trip_id=$1",
			[tripId]
		);
		if (!required) return { ready: true, reasonCode: "NO_REQUIRED_PACKAGE" };
		const decision = async (result: DepartureCheck): Promise<DepartureCheck> => {
			if (lock) {
				const [previous]: Array<{ last_reason_code: string | null }> = await m.query(
					"SELECT last_reason_code FROM offline_package_requirements WHERE trip_id=$1",
					[tripId]
				);
				await m.query(
					"UPDATE offline_package_requirements SET last_checked_at=transaction_timestamp(),last_reason_code=$2 WHERE trip_id=$1",
					[tripId, result.reasonCode]
				);
				if (!result.ready && previous?.last_reason_code !== result.reasonCode) {
					await m.query(
						`INSERT INTO audit_logs(actor_id,action,target_type,target_id,"before","after",reason) VALUES(NULL,'offline_package.departure_blocked','trip',$1,jsonb_build_object('reasonCode',$2::text),jsonb_build_object('reasonCode',$3::text),$3)`,
						[tripId, previous?.last_reason_code ?? null, result.reasonCode]
					);
					await enqueueDepartureNotifications(m, tripId, result.reasonCode);
				}
			}
			return result;
		};
		const [ready]: Array<{ package_id: string }> = await m.query(
			`SELECT d.package_id FROM offline_package_departures d
   JOIN offline_package_device_reports r USING(trip_id,user_id,device_id,package_id)
   JOIN offline_packages p ON p.id=d.package_id AND p.trip_id=d.trip_id
   WHERE d.trip_id=$1 AND d.package_id=$2 AND r.status='active' AND r.verified_sha256=p.sha256
   AND EXISTS(SELECT 1 FROM trip_porters tp WHERE tp.trip_id=d.trip_id AND tp.porter_id=d.user_id AND tp.status='assigned')`,
			[tripId, required.package_id]
		);
		if (!ready) return decision({ ready: false, reasonCode: "PACKAGE_DEPARTURE_NOT_READY" });
		const source = await this.sourceState(m, tripId, ready.package_id);
		if (source.state === "expired")
			return decision({ ready: false, reasonCode: "PACKAGE_SOURCE_EXPIRED" });
		if (source.state === "unknown")
			return decision({ ready: false, reasonCode: "SOURCE_FRESHNESS_UNAVAILABLE" });
		if (!(await this.artifactAvailable(await this.exact(m, tripId, ready.package_id))))
			return decision({ ready: false, reasonCode: "PACKAGE_ARTIFACT_UNAVAILABLE" });
		if (lock)
			await m.query(
				"UPDATE offline_package_departures SET locked_at=COALESCE(locked_at,transaction_timestamp()) WHERE trip_id=$1",
				[tripId]
			);
		return decision({
			ready: true,
			reasonCode: "PACKAGE_DEPARTURE_READY",
			packageId: ready.package_id,
		});
	}
}
