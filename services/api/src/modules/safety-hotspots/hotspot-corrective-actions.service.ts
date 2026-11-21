import {
	ConflictException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { TrekkingRouteStatus } from "../trekking-routes/entities/trekking-route.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { CheckpointsService } from "../trekking-routes/services/checkpoints.service";
import {
	type CorrectiveChange,
	// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
	RouteDangerZonesService,
} from "../trekking-routes/services/route-danger-zones.service";
import type { CreateCorrectiveActionDto } from "./dto/corrective-action.dto";
import {
	type CorrectiveActionRow,
	// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
	HotspotCorrectiveActionsRepository,
	type RouteSafetyTargets,
} from "./hotspot-corrective-actions.repository";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import {
	HotspotPackageImpactDispatcher,
	correctionImpactId,
} from "./hotspot-package-impact.dispatcher";
import { CorrectiveActionType, PackageImpact, SafetyHotspotStatus } from "./safety-hotspots.enums";

export enum CorrectiveActionErrorCode {
	HOTSPOT_NOT_FOUND = "HOTSPOT_NOT_FOUND",
	HOTSPOT_NOT_CONFIRMED = "HOTSPOT_NOT_CONFIRMED",
	ROUTE_CLOSED = "ROUTE_CLOSED",
	TARGET_NOT_ON_ROUTE = "TARGET_NOT_ON_ROUTE",
	HUMAN_ACTOR_REQUIRED = "HUMAN_ACTOR_REQUIRED",
}

const CHECKPOINT_TARGET = "trekking_route_checkpoint";
const HAZARD_TARGET = "trekking_route_danger_zone";

/**
 * BR-359 package impact. Packages read checkpoints (incl. instructions) from the Route; Route
 * hazard areas are not package input yet, so changing them does not alter package content. Change
 * this mapping when route_danger_zones become a package source.
 */
export function packageImpactOf(actionType: CorrectiveActionType): PackageImpact {
	return actionType === CorrectiveActionType.UPDATE_CHECKPOINT_INSTRUCTIONS
		? PackageImpact.AFFECTED
		: PackageImpact.NOT_AFFECTED;
}

interface AppliedChange {
	targetType: string | null;
	targetId: string | null;
	before: Record<string, unknown> | null;
	after: Record<string, unknown> | null;
}

/**
 * CTMS-118: an authorized Admin corrects authoritative Route safety data on the basis of a
 * CONFIRMED PotentialSafetyHotspot (BR-358). The change, its audit entry and its link to the
 * hotspot evidence are written in one transaction (BR-191, BR-419); package-affecting changes are
 * then handed to the package generator for a new version (BR-359). Only the Admin controller calls
 * this service; analytics and workers never inject it (BR-356).
 */
@Injectable()
export class HotspotCorrectiveActionsService {
	constructor(
		private readonly repository: HotspotCorrectiveActionsRepository,
		private readonly checkpoints: CheckpointsService,
		private readonly dangerZones: RouteDangerZonesService,
		private readonly impacts: HotspotPackageImpactDispatcher
	) {}

	async create(
		actorId: string | null | undefined,
		hotspotId: string,
		dto: CreateCorrectiveActionDto,
		now: Date = new Date()
	): Promise<CorrectiveActionRow> {
		if (!actorId) {
			throw new ConflictException({ code: CorrectiveActionErrorCode.HUMAN_ACTOR_REQUIRED });
		}
		const { actionId, packageImpact, impactTripIds } = await this.repository.transaction(
			async (manager) => {
				const hotspot = await this.repository.lockHotspot(manager, hotspotId);
				if (!hotspot) {
					throw new NotFoundException({ code: CorrectiveActionErrorCode.HOTSPOT_NOT_FOUND });
				}
				if (hotspot.status !== SafetyHotspotStatus.CONFIRMED) {
					throw new ConflictException({
						code: CorrectiveActionErrorCode.HOTSPOT_NOT_CONFIRMED,
						status: hotspot.status,
					});
				}
				const routeStatus = await this.repository.lockRouteStatus(manager, hotspot.routeId);
				if (routeStatus === null || routeStatus === TrekkingRouteStatus.CLOSED) {
					throw new ConflictException({ code: CorrectiveActionErrorCode.ROUTE_CLOSED });
				}

				const change = await this.apply(manager, hotspot.routeId, dto);
				const packageImpact =
					packageImpactOf(dto.actionType) === PackageImpact.AFFECTED &&
					change.before?.instructions !== change.after?.instructions
						? PackageImpact.AFFECTED
						: PackageImpact.NOT_AFFECTED;
				const tripIds =
					packageImpact === PackageImpact.AFFECTED
						? await this.repository.findPublishedTripIds(manager, hotspot.routeId)
						: [];

				const id = await this.repository.insert(manager, {
					hotspotId: hotspot.id,
					routeId: hotspot.routeId,
					actionType: dto.actionType,
					targetType: change.targetType,
					targetId: change.targetId,
					reason: dto.reason,
					before: change.before,
					after: change.after,
					hotspotStatusChangedAt: hotspot.statusChangedAt,
					hotspotEvidenceHash: hotspot.evidenceHash,
					hotspotRouteVersion: hotspot.routeVersion,
					packageImpact,
					impactTripIds: tripIds,
					actorId,
				});
				if (tripIds.length)
					await this.repository.recordPackageImpacts(manager, tripIds, correctionImpactId(id));
				await manager.getRepository(AuditLog).save({
					actorId,
					action: "safety_hotspot.corrective_action",
					targetType: change.targetType ?? "potential_safety_hotspot",
					targetId: change.targetId ?? hotspot.id,
					before: change.before,
					after: {
						...(change.after ?? {}),
						correctiveActionId: id,
						actionType: dto.actionType,
						hotspotId: hotspot.id,
						hotspotEvidenceHash: hotspot.evidenceHash,
						packageImpact,
						impactTripCount: tripIds.length,
					},
					reason: dto.reason.slice(0, 255),
				});
				return { actionId: id, packageImpact, impactTripIds: tripIds };
			}
		);

		// After commit: a failed hand-over stays pending and the worker retries it.
		if (packageImpact === PackageImpact.AFFECTED) {
			await this.impacts.dispatch(actionId, impactTripIds, now);
		}

		const created = await this.repository.findById(actionId);
		if (!created)
			throw new NotFoundException({ code: CorrectiveActionErrorCode.HOTSPOT_NOT_FOUND });
		return created;
	}

	async listByHotspot(hotspotId: string): Promise<CorrectiveActionRow[]> {
		return this.repository.listByHotspot(hotspotId);
	}

	async targets(routeId: string): Promise<RouteSafetyTargets> {
		return this.repository.findRouteSafetyTargets(routeId);
	}

	private async apply(
		manager: EntityManager,
		routeId: string,
		dto: CreateCorrectiveActionDto
	): Promise<AppliedChange> {
		switch (dto.actionType) {
			case CorrectiveActionType.ADD_HAZARD_AREA: {
				const change = await this.dangerZones.createCorrective(
					manager,
					routeId,
					required(dto.hazardArea)
				);
				return fromChange(HAZARD_TARGET, change.result.id, change);
			}
			case CorrectiveActionType.UPDATE_HAZARD_AREA: {
				const change = await this.dangerZones.updateCorrective(
					manager,
					routeId,
					required(dto.hazardAreaId),
					required(dto.hazardArea)
				);
				if (!change) throw targetNotOnRoute("hazardAreaId");
				return fromChange(HAZARD_TARGET, change.result.id, change);
			}
			case CorrectiveActionType.UPDATE_CHECKPOINT_INSTRUCTIONS: {
				// The correction's durable handoff carries its evidence reference.
				await manager.query("SELECT set_config('ctms.package_hotspot_correction','on',true)");
				const change = await this.checkpoints.updateSafetyInstructionsCorrective(
					manager,
					routeId,
					required(dto.checkpointId),
					required(dto.instructions)
				);
				if (!change) throw targetNotOnRoute("checkpointId");
				return fromChange(CHECKPOINT_TARGET, change.result.id, change);
			}
			case CorrectiveActionType.NO_DATA_CHANGE:
			case CorrectiveActionType.OTHER:
				return { targetType: null, targetId: null, before: null, after: null };
		}
	}
}

function fromChange<T>(
	targetType: string,
	targetId: string,
	change: CorrectiveChange<T>
): AppliedChange {
	return { targetType, targetId, before: change.before, after: change.after };
}

/** DTO validation guarantees presence per action type; this only narrows the type. */
function required<T>(value: T | undefined): T {
	if (value === undefined) {
		throw new UnprocessableEntityException({ statusCode: 422, error: "Unprocessable Entity" });
	}
	return value;
}

function targetNotOnRoute(field: string): NotFoundException {
	return new NotFoundException({ code: CorrectiveActionErrorCode.TARGET_NOT_ON_ROUTE, field });
}
