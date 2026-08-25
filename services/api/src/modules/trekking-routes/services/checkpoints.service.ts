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
import type { CheckpointResponseDto } from "../dto/checkpoint-response.dto";
import type { CreateCheckpointDto } from "../dto/create-checkpoint.dto";
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
				radiusMeters: dto.radiusMeters,
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

	private async findOwnedRoute(
		repository: Repository<TrekkingRoute>,
		hostId: string,
		routeId: string,
		lockForCreate = false
	): Promise<TrekkingRoute> {
		const route = lockForCreate
			? await repository
					.createQueryBuilder("route")
					.innerJoinAndSelect("route.campsite", "campsite")
					.where("route.id = :routeId", { routeId })
					.setLock("pessimistic_write")
					.getOne()
			: await repository.findOne({
					where: { id: routeId },
					relations: { campsite: true },
				});
		if (!route) throw new NotFoundException("Trekking route not found");
		if (route.campsite.hostId !== hostId) {
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
