import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import { AuditLog } from "../auth/entities/audit-log.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { RouteDangerZonesService } from "../trekking-routes/services/route-danger-zones.service";
import { DANGER_ZONE_PROPOSAL_LIST_LIMIT } from "./danger-zone-proposals.constants";
import {
	DangerZoneProposalErrorCode,
	DangerZoneProposalStatus,
} from "./danger-zone-proposals.enums";
import {
	type DangerZoneProposalRow,
	// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
	DangerZoneProposalsRepository,
	type LockedProposal,
} from "./danger-zone-proposals.repository";
import type {
	ApproveDangerZoneProposalDto,
	CreateDangerZoneProposalDto,
	RejectDangerZoneProposalDto,
} from "./dto/danger-zone-proposals.dto";

const PROPOSAL_TARGET = "danger_zone_proposal";

/**
 * Host and field-incident danger-zone proposals with Admin review (CTMS-117 amendment). Proposing
 * never changes authoritative safety data; only an Admin approval creates the hazard area, and the
 * shared map publishes it only while the zone still matches the approved snapshot.
 */
@Injectable()
export class DangerZoneProposalsService {
	constructor(
		private readonly repository: DangerZoneProposalsRepository,
		private readonly dangerZones: RouteDangerZonesService
	) {}

	async createForHost(
		hostId: string,
		routeId: string,
		dto: CreateDangerZoneProposalDto
	): Promise<DangerZoneProposalRow> {
		await this.assertRouteOwner(hostId, routeId);
		const radiusMeters = dto.geometry.type === "Point" ? (dto.radiusMeters ?? null) : null;
		const id = await this.repository.transaction(async (manager) => {
			const proposalId = await this.repository.insertHostProposal(manager, {
				routeId,
				proposerId: hostId,
				hazardType: dto.hazardType,
				geometry: dto.geometry,
				radiusMeters,
				severity: dto.severity,
				description: dto.description,
			});
			await manager.getRepository(AuditLog).save({
				actorId: hostId,
				action: "danger_zone_proposal.submitted",
				targetType: PROPOSAL_TARGET,
				targetId: proposalId,
				before: null,
				after: { routeId, hazardType: dto.hazardType, severity: dto.severity, radiusMeters },
				reason: "host_proposed_danger_zone",
			});
			return proposalId;
		});
		return this.getById(id);
	}

	async listForHost(hostId: string, routeId: string): Promise<DangerZoneProposalRow[]> {
		await this.assertRouteOwner(hostId, routeId);
		return this.repository.list({ routeId, limit: DANGER_ZONE_PROPOSAL_LIST_LIMIT });
	}

	listForAdmin(status?: DangerZoneProposalStatus): Promise<DangerZoneProposalRow[]> {
		return this.repository.list({ status, limit: DANGER_ZONE_PROPOSAL_LIST_LIMIT });
	}

	async getById(id: string): Promise<DangerZoneProposalRow> {
		const proposal = await this.repository.findById(id);
		if (!proposal) {
			throw new NotFoundException({ code: DangerZoneProposalErrorCode.PROPOSAL_NOT_FOUND });
		}
		return proposal;
	}

	async approve(
		adminId: string,
		id: string,
		dto: ApproveDangerZoneProposalDto
	): Promise<DangerZoneProposalRow> {
		await this.repository.transaction(async (manager) => {
			const proposal = await this.lockPending(manager, id);
			const radiusMeters = approvedRadius(proposal, dto.radiusMeters);
			const change = await this.dangerZones.createCorrective(manager, proposal.routeId, {
				geometry: proposal.geometry,
				radiusMeters: radiusMeters ?? undefined,
				description: dto.description,
				severity: dto.severity,
			});
			const reason = dto.reason?.length ? dto.reason : null;
			await this.repository.markApproved(manager, id, {
				reviewerId: adminId,
				reason,
				dangerZoneId: change.result.id,
			});
			await manager.getRepository(AuditLog).save({
				actorId: adminId,
				action: "danger_zone_proposal.approved",
				targetType: "trekking_route_danger_zone",
				targetId: change.result.id,
				before: null,
				after: { ...change.after, proposalId: id, source: proposal.source },
				reason: (reason ?? "admin_approved_danger_zone_proposal").slice(0, 255),
			});
		});
		return this.getById(id);
	}

	async reject(
		adminId: string,
		id: string,
		dto: RejectDangerZoneProposalDto
	): Promise<DangerZoneProposalRow> {
		await this.repository.transaction(async (manager) => {
			await this.lockPending(manager, id);
			await this.repository.markRejected(manager, id, { reviewerId: adminId, reason: dto.reason });
			await manager.getRepository(AuditLog).save({
				actorId: adminId,
				action: "danger_zone_proposal.rejected",
				targetType: PROPOSAL_TARGET,
				targetId: id,
				before: { status: DangerZoneProposalStatus.PENDING },
				after: { status: DangerZoneProposalStatus.REJECTED },
				reason: dto.reason.slice(0, 255),
			});
		});
		return this.getById(id);
	}

	private async lockPending(
		manager: Parameters<DangerZoneProposalsRepository["lockProposal"]>[0],
		id: string
	): Promise<LockedProposal> {
		const proposal = await this.repository.lockProposal(manager, id);
		if (!proposal) {
			throw new NotFoundException({ code: DangerZoneProposalErrorCode.PROPOSAL_NOT_FOUND });
		}
		if (proposal.status !== DangerZoneProposalStatus.PENDING) {
			throw new ConflictException({
				code: DangerZoneProposalErrorCode.PROPOSAL_ALREADY_DECIDED,
				status: proposal.status,
			});
		}
		return proposal;
	}

	private async assertRouteOwner(hostId: string, routeId: string): Promise<void> {
		const ownerId = await this.repository.findRouteOwner(routeId);
		if (!ownerId) throw new NotFoundException("Trekking route not found");
		if (ownerId !== hostId) {
			throw new ForbiddenException("Only the owning Host can propose danger zones for this route");
		}
	}
}

/** A point keeps its proposed radius unless the Admin records a different one; an area has none. */
export function approvedRadius(
	proposal: Pick<LockedProposal, "geometry" | "radiusMeters">,
	requested: number | undefined
): number | null {
	if (proposal.geometry.type === "Polygon") {
		if (requested !== undefined) {
			throw new UnprocessableEntityException({
				code: DangerZoneProposalErrorCode.RADIUS_NOT_ALLOWED,
			});
		}
		return null;
	}
	const radius = requested ?? proposal.radiusMeters;
	if (radius === null || radius <= 0) {
		throw new UnprocessableEntityException({ code: DangerZoneProposalErrorCode.RADIUS_REQUIRED });
	}
	return radius;
}
