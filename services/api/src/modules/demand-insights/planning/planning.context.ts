import type { EntityManager } from "typeorm";
import { type DemandRelease, type DemandSource, fingerprint } from "../demand-insights.policy";
import { type PlanningSource, buildPlanningContext } from "./planning.policy";
export async function planningSources(
	m: EntityManager,
	rows: DemandSource[]
): Promise<PlanningSource[]> {
	const snapshots: {
		booking: string;
		snapshotType: string;
		snapshotDifficulty: string;
		priceBand: string | null;
		capacityBand: string | null;
		durationBand: string | null;
		areaCode: string | null;
		areaLabel: string | null;
		areaActive: boolean | null;
	}[] = rows.length
		? await m.query(
				`SELECT s.booking_id AS booking,s.trip_type AS "snapshotType",s.difficulty AS "snapshotDifficulty",s.price_band AS "priceBand",s.capacity_band AS "capacityBand",s.duration_band AS "durationBand",s.area_code AS "areaCode",a.label AS "areaLabel",a.active AS "areaActive" FROM booking_demand_snapshots s LEFT JOIN demand_areas a ON a.code=s.area_code WHERE s.booking_id=ANY($1::uuid[]) ORDER BY s.booking_id`,
				[rows.map((r) => r.booking)]
			)
		: [];
	const byBooking = new Map(snapshots.map((s) => [s.booking, s]));
	return rows.map((row) => ({
		...row,
		snapshotType: null,
		snapshotDifficulty: null,
		priceBand: null,
		capacityBand: null,
		durationBand: null,
		areaCode: null,
		areaLabel: null,
		areaActive: null,
		...byBooking.get(row.booking),
	}));
}
export async function freezePlanningContext(
	m: EntityManager,
	reportId: string,
	release: DemandRelease,
	rows: DemandSource[]
): Promise<void> {
	const sources = await planningSources(m, rows);
	const context = buildPlanningContext(release, sources);
	await m.query(
		"INSERT INTO demand_planning_contexts(report_id,source_hash,context) VALUES($1,$2,$3)",
		[reportId, fingerprint(sources), JSON.stringify(context)]
	);
}
