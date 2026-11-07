import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource } from "typeorm";
// biome-ignore lint/style/useImportType: Nest injection
import { DemandInsightsRepository } from "../demand-insights.repository";
@Injectable()
export class PlanningCatalog {
	constructor(
		private readonly db: DataSource,
		private readonly repository: DemandInsightsRepository
	) {}
	async areas(actor: string) {
		return this.db.transaction(async (m) => {
			await this.repository.authorize(m, actor);
			const areas: { code: string; label: string }[] = await m.query(
				"SELECT code,label FROM demand_areas WHERE active ORDER BY code"
			);
			return { areas, provenance: "host_confirmed_catalog" };
		});
	}
	async confirm(actor: string, tripId: string, areaCode: string) {
		return this.db.transaction(async (m) => {
			await this.repository.authorize(m, actor);
			const trips: unknown[] = await m.query(
				"SELECT id FROM trips WHERE id=$1 AND host_id=$2 FOR UPDATE",
				[tripId, actor]
			);
			if (!trips.length) throw new NotFoundException("Trip not found");
			const areas: unknown[] = await m.query(
				"SELECT code FROM demand_areas WHERE code=$1 AND active FOR SHARE",
				[areaCode]
			);
			if (!areas.length) throw new UnprocessableEntityException({ code: "invalid_area" });
			await m.query(
				"INSERT INTO trip_demand_contexts(trip_id,area_code) VALUES($1,$2) ON CONFLICT(trip_id) DO UPDATE SET area_code=EXCLUDED.area_code,confirmed_at=clock_timestamp()",
				[tripId, areaCode]
			);
			return { confirmed: true, appliesTo: "future_booking_snapshots" };
		});
	}
}
