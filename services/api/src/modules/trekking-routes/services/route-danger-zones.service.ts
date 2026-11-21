import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager, type Repository } from "typeorm";
import type { CreateRouteDangerZoneDto } from "../dto/create-route-danger-zone.dto";
import type { RouteDangerZoneResponseDto } from "../dto/route-danger-zone-response.dto";
import { TrekkingRoute } from "../entities/trekking-route.entity";
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

	/**
	 * CTMS-118: hazard-area correction from a CONFIRMED safety hotspot. Runs in the caller's
	 * transaction, which has already authorized the Admin and locked the Route; geometry is still
	 * validated by the shared hazard-area DTO and PostGIS rules. Only safety data changes, never
	 * Route geometry or checkpoint order.
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
		routeId: string
	): Promise<TrekkingRoute> {
		const route = await repository.findOne({ where: { id: routeId } });
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
