import { ForbiddenException, Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { DataSource } from "typeorm";
import type { ImportSafetyDto } from "./dto/import-safety.dto";
import { parseSafetyInput } from "./safety-input";

@Injectable()
export class SafetyImportService {
	constructor(
		private readonly db: DataSource,
		private readonly config: ConfigService
	) {}

	async import(
		actorId: string,
		dto: ImportSafetyDto
	): Promise<{ accepted: number; rejected: number; unchanged: number }> {
		const sources = (this.config.get<string>("ROUTE_SAFETY_APPROVED_SOURCES") ?? "")
			.split(",")
			.map((source) => source.trim())
			.filter(Boolean);
		if (!sources.includes(dto.source) || !dto.permissionReference.trim()) {
			throw new ForbiddenException("Safety source reuse must be approved before importing data");
		}
		const result = { accepted: 0, rejected: 0, unchanged: 0 };
		for (const [index, raw] of dto.features.entries()) {
			const input = parseSafetyInput(raw);
			let reason: string | null = input ? null : "INVALID_CANONICAL_RECORD";
			if (input) {
				try {
					const changed = await this.db.transaction(async (manager) => {
						const rows: Array<{ id: string }> = await manager.query(
							`
						 INSERT INTO external_safety_features (
						 source,external_id,source_type,source_reference,permission_reference,hazard_type,severity,
						 geom,geometry_role,description,observed_at,issued_at,valid_from,valid_until,
						 lifecycle_status,verification_status,accuracy_meters,raw_payload)
						 VALUES ($1,$2,$3,$4,$5,$6,$7,ST_SetSRID(ST_GeomFromGeoJSON($8),4326)::geography,
						 $9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb)
						 ON CONFLICT (source,external_id) DO UPDATE SET
						 source_type=EXCLUDED.source_type,source_reference=EXCLUDED.source_reference,
						 permission_reference=EXCLUDED.permission_reference,hazard_type=EXCLUDED.hazard_type,
						 severity=EXCLUDED.severity,geom=EXCLUDED.geom,geometry_role=EXCLUDED.geometry_role,
						 description=EXCLUDED.description,observed_at=EXCLUDED.observed_at,issued_at=EXCLUDED.issued_at,
						 valid_from=EXCLUDED.valid_from,valid_until=EXCLUDED.valid_until,lifecycle_status=EXCLUDED.lifecycle_status,
						 verification_status=EXCLUDED.verification_status,accuracy_meters=EXCLUDED.accuracy_meters,
						 raw_payload=EXCLUDED.raw_payload,fetched_at=now(),updated_at=now()
						 WHERE COALESCE(EXCLUDED.issued_at,EXCLUDED.observed_at,'-infinity'::timestamptz)
						 >= COALESCE(external_safety_features.issued_at,external_safety_features.observed_at,'-infinity'::timestamptz)
						 RETURNING id`,
							[
								dto.source,
								input.externalId,
								input.sourceType,
								input.sourceReference,
								dto.permissionReference,
								input.hazardType,
								input.severity,
								JSON.stringify(input.geometry),
								input.geometryRole,
								input.description,
								input.observedAt,
								input.issuedAt,
								input.validFrom,
								input.validUntil,
								input.lifecycleStatus,
								input.verificationStatus,
								input.accuracyMeters,
								JSON.stringify(raw),
							]
						);
						if (rows[0])
							await manager.query(
								`INSERT INTO audit_logs
						 (actor_id,action,target_type,target_id,"after",reason) VALUES ($1,'route_safety.import','external_safety_feature',$2,$3::jsonb,$4)`,
								[
									actorId,
									rows[0].id,
									JSON.stringify({ source: dto.source, externalId: input.externalId }),
									dto.permissionReference,
								]
							);
						return rows.length > 0;
					});
					if (changed) result.accepted++;
					else result.unchanged++;
				} catch (error: unknown) {
					const code =
						error && typeof error === "object" && "code" in error ? String(error.code) : "";
					// Only invalid provider data is quarantined. Infrastructure/transaction errors remain failures.
					if (!["23514", "22023", "22P02"].includes(code)) throw error;
					reason = "INVALID_SPATIAL_RECORD";
				}
			}
			if (reason) {
				await this.db.query(
					`INSERT INTO safety_import_rejections
				 (source,permission_reference,record_index,reason,raw_payload) VALUES ($1,$2,$3,$4,$5::jsonb)`,
					[dto.source, dto.permissionReference, index, reason, JSON.stringify(raw)]
				);
				result.rejected++;
			}
		}
		return result;
	}
}
