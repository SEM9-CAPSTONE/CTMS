import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import type { ReviewSafetyHotspotDto } from "./dto/review-safety-hotspot.dto";
import { SafetyHotspotStatus } from "./safety-hotspots.enums";

export enum HotspotReviewErrorCode {
	HOTSPOT_NOT_FOUND = "HOTSPOT_NOT_FOUND",
	INVALID_TRANSITION = "INVALID_TRANSITION",
}

export interface HotspotReviewRow {
	id: string;
	fromStatus: SafetyHotspotStatus;
	toStatus: SafetyHotspotStatus;
	reason: string;
	actorName: string;
	createdAt: Date;
}

/** New candidates start UNDER_REVIEW; DETECTED remains actionable for legacy records. */
const ALLOWED_TRANSITIONS: Record<SafetyHotspotStatus, readonly SafetyHotspotStatus[]> = {
	[SafetyHotspotStatus.DETECTED]: [SafetyHotspotStatus.CONFIRMED, SafetyHotspotStatus.DISMISSED],
	[SafetyHotspotStatus.UNDER_REVIEW]: [
		SafetyHotspotStatus.CONFIRMED,
		SafetyHotspotStatus.DISMISSED,
	],
	[SafetyHotspotStatus.CONFIRMED]: [],
	[SafetyHotspotStatus.DISMISSED]: [],
};

export function isAllowedHotspotTransition(
	from: SafetyHotspotStatus,
	to: SafetyHotspotStatus
): boolean {
	return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * CTMS-117: an Admin moves a hotspot through review. Each transition stores actor, statuses,
 * reason, time and the evidence it was decided on (BR-424) and is audited (BR-191). Review does
 * not change Route safety data; a CONFIRMED hotspot only becomes eligible for CTMS-118.
 */
@Injectable()
export class HotspotReviewService {
	constructor(private readonly dataSource: DataSource) {}

	async review(actorId: string, hotspotId: string, dto: ReviewSafetyHotspotDto): Promise<void> {
		await this.dataSource.transaction(async (manager) => {
			const rows = (await manager.query(
				`SELECT "status", "evidence_hash" AS "evidenceHash"
				 FROM "potential_safety_hotspots" WHERE "id" = $1 FOR UPDATE`,
				[hotspotId]
			)) as Array<{ status: SafetyHotspotStatus; evidenceHash: string }>;
			const hotspot = rows[0];
			if (!hotspot) {
				throw new NotFoundException({ code: HotspotReviewErrorCode.HOTSPOT_NOT_FOUND });
			}
			if (!isAllowedHotspotTransition(hotspot.status, dto.status)) {
				throw new ConflictException({
					code: HotspotReviewErrorCode.INVALID_TRANSITION,
					status: hotspot.status,
				});
			}
			await manager.query(
				`UPDATE "potential_safety_hotspots" SET "status" = $2, "status_changed_at" = now()
				 WHERE "id" = $1`,
				[hotspotId, dto.status]
			);
			await manager.query(
				`INSERT INTO "hotspot_reviews"
					("hotspot_id", "actor_id", "from_status", "to_status", "reason", "evidence_hash")
				 VALUES ($1, $2, $3, $4, $5, $6)`,
				[hotspotId, actorId, hotspot.status, dto.status, dto.reason, hotspot.evidenceHash]
			);
			await manager.getRepository(AuditLog).save({
				actorId,
				action: "safety_hotspot.reviewed",
				targetType: "potential_safety_hotspot",
				targetId: hotspotId,
				before: { status: hotspot.status },
				after: { status: dto.status, evidenceHash: hotspot.evidenceHash },
				reason: dto.reason.slice(0, 255),
			});
		});
	}

	async list(hotspotId: string): Promise<HotspotReviewRow[]> {
		return (await this.dataSource.query(
			`SELECT review."id", review."from_status" AS "fromStatus", review."to_status" AS "toStatus",
				review."reason", actor."full_name" AS "actorName", review."created_at" AS "createdAt"
			 FROM "hotspot_reviews" review
			 JOIN "users" actor ON actor."id" = review."actor_id"
			 WHERE review."hotspot_id" = $1
			 ORDER BY review."created_at" DESC, review."id" DESC`,
			[hotspotId]
		)) as HotspotReviewRow[];
	}
}
