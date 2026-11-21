import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import type { UpdateSafetyHotspotDto } from "./dto/update-safety-hotspot.dto";

export enum HotspotDetailsErrorCode {
	HOTSPOT_NOT_FOUND = "HOTSPOT_NOT_FOUND",
	HOTSPOT_HAS_CORRECTIONS = "HOTSPOT_HAS_CORRECTIONS",
}

interface LockedDetails {
	id: string;
	routeId: string;
	status: string;
	name: string | null;
	description: string | null;
	severity: string | null;
}

const TARGET_TYPE = "potential_safety_hotspot";

/** Admin edits of a hotspot's name, description and severity, and its permanent removal. */
@Injectable()
export class HotspotDetailsService {
	constructor(private readonly dataSource: DataSource) {}

	async update(actorId: string, id: string, dto: UpdateSafetyHotspotDto): Promise<void> {
		await this.dataSource.transaction(async (manager) => {
			const before = await this.lock(manager, id);
			const after = {
				name: dto.name,
				description: dto.description || null,
				severity: dto.severity,
			};
			await manager.query(
				`UPDATE "potential_safety_hotspots"
				 SET "name" = $2, "description" = $3, "severity" = $4 WHERE "id" = $1`,
				[id, after.name, after.description, after.severity]
			);
			await manager.getRepository(AuditLog).save({
				actorId,
				action: "safety_hotspot.updated",
				targetType: TARGET_TYPE,
				targetId: id,
				before: { name: before.name, description: before.description, severity: before.severity },
				after,
				reason: "admin_edited_safety_hotspot",
			});
		});
	}

	/**
	 * Deletes the hotspot and its review history. A hotspot that already changed Route safety data
	 * stays, because published hazard areas are verified through it.
	 */
	async remove(actorId: string, id: string): Promise<void> {
		await this.dataSource.transaction(async (manager) => {
			const hotspot = await this.lock(manager, id);
			const [{ count }] = (await manager.query(
				`SELECT count(*)::int AS "count" FROM "hotspot_corrective_actions" WHERE "hotspot_id" = $1`,
				[id]
			)) as Array<{ count: number }>;
			if (count > 0) {
				throw new ConflictException({ code: HotspotDetailsErrorCode.HOTSPOT_HAS_CORRECTIONS });
			}
			await manager.query(`DELETE FROM "potential_safety_hotspots" WHERE "id" = $1`, [id]);
			await manager.getRepository(AuditLog).save({
				actorId,
				action: "safety_hotspot.deleted",
				targetType: TARGET_TYPE,
				targetId: id,
				before: {
					routeId: hotspot.routeId,
					status: hotspot.status,
					name: hotspot.name,
					severity: hotspot.severity,
				},
				after: null,
				reason: "admin_deleted_safety_hotspot",
			});
		});
	}

	private async lock(manager: { query: DataSource["query"] }, id: string): Promise<LockedDetails> {
		const [row] = (await manager.query(
			`SELECT "id", "route_id" AS "routeId", "status", "name", "description", "severity"
			 FROM "potential_safety_hotspots" WHERE "id" = $1 FOR UPDATE`,
			[id]
		)) as LockedDetails[];
		if (!row) throw new NotFoundException({ code: HotspotDetailsErrorCode.HOTSPOT_NOT_FOUND });
		return row;
	}
}
