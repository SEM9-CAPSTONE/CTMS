import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager, type Repository } from "typeorm";
import { AuditLog } from "../../auth/entities/audit-log.entity";
import { CHECKPOINT_RADIUS_METERS } from "../constants";
import type { CheckpointResponseDto } from "../dto/checkpoint-response.dto";
import type { CreateCheckpointDto } from "../dto/create-checkpoint.dto";
import type { UpdateCheckpointDto } from "../dto/update-checkpoint.dto";
import { TrekkingRoute, TrekkingRouteStatus } from "../entities/trekking-route.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { CheckpointsRepository } from "../repositories/checkpoints.repository";

@Injectable()
export class CheckpointsService {
	constructor(
		private readonly checkpointsRepository: CheckpointsRepository,
		private readonly dataSource: DataSource
	) {}

	async list(hostId: string, routeId: string): Promise<CheckpointResponseDto[]> {
		await this.findOwnedRoute(this.dataSource.getRepository(TrekkingRoute), hostId, routeId);
		return this.checkpointsRepository.findByRoute(routeId);
	}

	async create(
		hostId: string,
		routeId: string,
		dto: CreateCheckpointDto
	): Promise<CheckpointResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const route = await this.findOwnedRoute(
				manager.getRepository(TrekkingRoute),
				hostId,
				routeId,
				true
			);

			if (route.status !== TrekkingRouteStatus.DRAFT) {
				throw new ConflictException(
					"Checkpoints can only be created while the route is in draft status"
				);
			}
			if (dto.expectedArrivalOffset > route.expectedDurationMinutes) {
				throw new UnprocessableEntityException({
					statusCode: 422,
					error: "Unprocessable Entity",
					message: [
						{
							field: "expectedArrivalOffset",
							errors: ["expected arrival offset cannot exceed the route duration"],
						},
					],
				});
			}

			const repository = manager.withRepository(this.checkpointsRepository);
			const checkpoint = await repository.createForRoute({
				routeId,
				name: dto.name,
				location: dto.location,
				radiusMeters: CHECKPOINT_RADIUS_METERS,
				type: dto.type,
				expectedArrivalOffset: dto.expectedArrivalOffset,
				instructions: dto.instructions,
				nearbyWaterOrShelter: dto.nearbyWaterOrShelter,
			});

			await manager.getRepository(AuditLog).save({
				actorId: hostId,
				action: "trekking_route_checkpoint.created",
				targetType: "trekking_route_checkpoint",
				targetId: checkpoint.id,
				before: null,
				after: this.buildAuditSnapshot(checkpoint),
				reason: "host_create_trekking_route_checkpoint",
			});

			return checkpoint;
		});
	}

	async update(
		hostId: string,
		routeId: string,
		checkpointId: string,
		dto: UpdateCheckpointDto
	): Promise<CheckpointResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const route = await this.findOwnedRoute(
				manager.getRepository(TrekkingRoute),
				hostId,
				routeId,
				true
			);

			if (route.status !== TrekkingRouteStatus.DRAFT) {
				throw new ConflictException(
					"Checkpoints can only be updated while the route is in draft status"
				);
			}

			const repository = manager.withRepository(this.checkpointsRepository);
			const existing = await repository.findOneForUpdate(routeId, checkpointId);
			if (!existing) throw new NotFoundException("Checkpoint not found");

			if (dto.expectedArrivalOffset > route.expectedDurationMinutes) {
				throw new UnprocessableEntityException({
					statusCode: 422,
					error: "Unprocessable Entity",
					message: [
						{
							field: "expectedArrivalOffset",
							errors: ["expected arrival offset cannot exceed the route duration"],
						},
					],
				});
			}

			const checkpoint = await repository.updateForRoute({
				routeId,
				checkpointId,
				name: dto.name,
				location: dto.location,
				radiusMeters: CHECKPOINT_RADIUS_METERS,
				type: dto.type,
				expectedArrivalOffset: dto.expectedArrivalOffset,
				instructions: dto.instructions,
				nearbyWaterOrShelter: dto.nearbyWaterOrShelter,
			});

			await manager.getRepository(AuditLog).save({
				actorId: hostId,
				action: "trekking_route_checkpoint.updated",
				targetType: "trekking_route_checkpoint",
				targetId: checkpoint.id,
				before: this.buildAuditSnapshot(existing),
				after: this.buildAuditSnapshot(checkpoint),
				reason: "host_update_trekking_route_checkpoint",
			});

			return checkpoint;
		});
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
			throw new ForbiddenException("Only the owning Host can manage checkpoints for this route");
		}
		return route;
	}

	private buildAuditSnapshot(checkpoint: CheckpointResponseDto): Record<string, unknown> {
		return {
			id: checkpoint.id,
			routeId: checkpoint.routeId,
			name: checkpoint.name,
			location: checkpoint.location,
			radiusMeters: checkpoint.radiusMeters,
			type: checkpoint.type,
			expectedArrivalOffset: checkpoint.expectedArrivalOffset,
			instructions: checkpoint.instructions,
			nearbyWaterOrShelter: checkpoint.nearbyWaterOrShelter,
			routePosition: checkpoint.routePosition,
		};
	}
}
