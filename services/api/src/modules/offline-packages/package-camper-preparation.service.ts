import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource, type EntityManager } from "typeorm";

export const CAMPER_OFFLINE_NOTICE = "offline-limitations-v1";

interface PreparationRow {
	status: string;
	startsAt: Date;
	packageId: string | null;
	packageVersion: number | null;
	confirmedAt: Date | null;
}

@Injectable()
export class PackageCamperPreparationService {
	constructor(private readonly db: DataSource) {}

	private async context(m: EntityManager, tripId: string, userId: string, lockParticipant = false) {
		const [row]: PreparationRow[] = await m.query(
			`SELECT t.status,t.starts_at AS "startsAt",p.id AS "packageId",p.package_version AS "packageVersion",
			        a.confirmed_at AS "confirmedAt"
			 FROM trips t
			 LEFT JOIN offline_package_requirements r ON r.trip_id=t.id
			 LEFT JOIN offline_package_departures d ON d.trip_id=t.id AND d.locked_at IS NOT NULL
			 LEFT JOIN offline_packages p ON p.trip_id=t.id
			   AND p.id=CASE WHEN t.status='ongoing' THEN d.package_id ELSE r.package_id END
			 LEFT JOIN offline_package_camper_acknowledgements a ON a.trip_id=t.id AND a.user_id=$2
			   AND a.policy_version=$3 AND a.package_id IS NOT DISTINCT FROM p.id
			 WHERE t.id=$1 AND t.status IN ('published','ongoing') AND EXISTS(
			   SELECT 1 FROM booking_members bm JOIN bookings b ON b.id=bm.booking_id
			   WHERE b.trip_id=t.id AND bm.user_id=$2 AND b.status='confirmed'
			   AND bm.member_status IN ('registered','joined') AND bm.left_at IS NULL
			   ${lockParticipant ? "FOR SHARE OF bm,b" : ""}
			 )`,
			[tripId, userId, CAMPER_OFFLINE_NOTICE]
		);
		if (!row) throw new NotFoundException({ code: "TRIP_NOT_ACCESSIBLE" });
		return { ...row, policyVersion: CAMPER_OFFLINE_NOTICE };
	}

	read(tripId: string, userId: string) {
		return this.context(this.db.manager, tripId, userId);
	}

	confirm(tripId: string, userId: string, packageId: string | null, policyVersion: string) {
		return this.db.transaction(async (m) => {
			await this.context(m, tripId, userId);
			await m.query("SELECT id FROM trips WHERE id=$1 FOR UPDATE", [tripId]);
			const context = await this.context(m, tripId, userId, true);
			if (packageId !== context.packageId || policyVersion !== context.policyVersion)
				throw new ConflictException({ code: "PREPARATION_CONTEXT_CHANGED" });
			const [inserted]: Array<{ id: string }> = await m.query(
				`WITH acknowledged AS (
				   INSERT INTO offline_package_camper_acknowledgements(trip_id,user_id,package_id,policy_version)
				   VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id
				 ) SELECT id FROM acknowledged`,
				[tripId, userId, packageId, policyVersion]
			);
			if (inserted)
				await m.query(
					`INSERT INTO audit_logs(actor_id,action,target_type,target_id,"after",reason)
					 VALUES($1,'offline_package.limitations_acknowledged','trip',$2,
					   jsonb_build_object('acknowledgementId',$3::uuid,'packageId',$4::uuid,'policyVersion',$5::text),
					   'informed_offline_limitations')`,
					[userId, tripId, inserted.id, packageId, policyVersion]
				);
			return this.context(m, tripId, userId);
		});
	}
}
