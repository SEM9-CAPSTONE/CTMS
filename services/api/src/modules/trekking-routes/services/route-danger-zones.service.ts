import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager, type Repository } from "typeorm";
import { AuditLog } from "../../auth/entities/audit-log.entity";
import type { CreateRouteDangerZoneDto } from "../dto/create-route-danger-zone.dto";
import type { RouteDangerZoneResponseDto } from "../dto/route-danger-zone-response.dto";
import { TrekkingRoute, TrekkingRouteStatus } from "../entities/trekking-route.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { RouteDangerZonesRepository } from "../repositories/route-danger-zones.repository";

/** Result of a corrective change plus the audit snapshots around it. */
export interface CorrectiveChange<T> {
	result: T;
	before: Record<string, unknown> | null;
	after: Record<string, unknown>;
}

@Injectable()
export class RouteDangerZonesService {
	constructor(
		private readonly routeDangerZonesRepository: RouteDangerZonesRepository,
		private readonly dataSource: DataSource
	) {}

	async list(hostId: string, routeId: string): Promise<RouteDangerZoneResponseDto[]> {
		await this.findOwnedRoute(this.dataSource.getRepository(TrekkingRoute), hostId, routeId);
		return this.routeDangerZonesRepository.findByRoute(routeId);
	}

	async create(
		hostId: string,
		routeId: string,
		dto: CreateRouteDangerZoneDto
	): Promise<RouteDangerZoneResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const route = await this.findOwnedRoute(
				manager.getRepository(TrekkingRoute),
				hostId,
				routeId,
				true
			);

			if (route.status !== TrekkingRouteStatus.DRAFT) {
				throw new ConflictException(
					"Hazard areas can only be created while the route is in draft status"
				);
			}

			const repository = manager.withRepository(this.routeDangerZonesRepository);
			const dangerZone = await repository.createForRoute({
				routeId,
				geometry: dto.geometry,
				radiusMeters: dto.geometry.type === "Point" ? (dto.radiusMeters ?? null) : null,
				description: dto.description,
				severity: dto.severity,
			});

			await manager.getRepository(AuditLog).save({
				actorId: hostId,
				action: "trekking_route_danger_zone.created",
				targetType: "trekking_route_danger_zone",
				targetId: dangerZone.id,
				before: null,
				after: this.buildAuditSnapshot(dangerZone),
				reason: "host_create_trekking_route_danger_zone",
			});

			return dangerZone;
		});
	}

	/**
	 * CTMS-118: hazard-area correction from a CONFIRMED safety hotspot. Runs in the caller's
	 * transaction, which has already authorized the Admin and locked the Route; geometry is still
	 * validated by the same DTO and PostGIS rules as Host creation. The DRAFT gate does not apply
	 * because only safety data changes, never Route geometry or checkpoint order.
	 */
	async createCorrective(
		manager: EntityManager,
		routeId: string,
		dto: CreateRouteDangerZoneDto
	): Promise<CorrectiveChange<RouteDangerZoneResponseDto>> {
		const dangerZone = await manager
			.withRepository(this.routeDangerZonesRepository)
			.createForRoute(this.toInput(routeId, dto));
		return { result: dangerZone, before: null, after: this.buildAuditSnapshot(dangerZone) };
	}

	async updateCorrective(
		manager: EntityManager,
		routeId: string,
		dangerZoneId: string,
		dto: CreateRouteDangerZoneDto
	): Promise<CorrectiveChange<RouteDangerZoneResponseDto> | null> {
		const repository = manager.withRepository(this.routeDangerZonesRepository);
		const existing = await repository.findOneForUpdate(routeId, dangerZoneId);
		if (!existing) return null;
		const updated = await repository.updateForRoute(dangerZoneId, this.toInput(routeId, dto));
		return {
			result: updated,
			before: this.buildAuditSnapshot(existing),
			after: this.buildAuditSnapshot(updated),
		};
	}

	private toInput(routeId: string, dto: CreateRouteDangerZoneDto) {
		return {
			routeId,
			geometry: dto.geometry,
			radiusMeters: dto.geometry.type === "Point" ? (dto.radiusMeters ?? null) : null,
			description: dto.description,
			severity: dto.severity,
		};
	}

	private async findOwnedRoute(
		repository: Repository<TrekkingRoute>,
		hostId: string,
		routeId: string,
		lockForCreate = false
	): Promise<TrekkingRoute> {
		const route = lockForCreate
			? await repository
					.createQueryBuilder("route")
					.where("route.id = :routeId", { routeId })
					.setLock("pessimistic_write")
					.getOne()
			: await repository.findOne({
					where: { id: routeId },
				});
		if (!route) throw new NotFoundException("Trekking route not found");
		if (route.hostId !== hostId) {
			throw new ForbiddenException("Only the owning Host can manage hazard areas for this route");
		}
		return route;
	}

	private buildAuditSnapshot(dangerZone: RouteDangerZoneResponseDto): Record<string, unknown> {
		return {
			id: dangerZone.id,
			routeId: dangerZone.routeId,
			geometry: dangerZone.geometry,
			radiusMeters: dangerZone.radiusMeters,
			description: dangerZone.description,
			severity: dangerZone.severity,
		};
	}
}
