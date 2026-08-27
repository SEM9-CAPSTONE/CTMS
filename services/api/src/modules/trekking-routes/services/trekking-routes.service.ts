import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../../auth/entities/audit-log.entity";
import { Campsite } from "../../campsites/entities/campsite.entity";
import type { CreateTrekkingRouteDto } from "../dto/create-trekking-route.dto";
import {
	ReviewTrekkingRouteAction,
	type ReviewTrekkingRouteDto,
} from "../dto/review-trekking-route.dto";
import type { TrekkingRouteResponseDto } from "../dto/trekking-route-response.dto";
import type { TrekkingRouteReviewResponseDto } from "../dto/trekking-route-review-response.dto";
import { type GeoLineString, TrekkingRouteStatus } from "../entities/trekking-route.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { TrekkingRoutesRepository } from "../repositories/trekking-routes.repository";

@Injectable()
export class TrekkingRoutesService {
	constructor(
		private readonly trekkingRoutesRepository: TrekkingRoutesRepository,
		private readonly dataSource: DataSource
	) {}

	async listByCampsite(hostId: string, campsiteId: string): Promise<TrekkingRouteResponseDto[]> {
		const campsite = await this.dataSource.getRepository(Campsite).findOne({
			where: { id: campsiteId },
		});

		if (!campsite) {
			throw new NotFoundException("Campsite not found");
		}
		if (campsite.hostId !== hostId) {
			throw new ForbiddenException("Only the owning Host can view routes for this campsite");
		}

		return this.trekkingRoutesRepository.findByCampsite(campsiteId);
	}

	listPendingReview(): Promise<TrekkingRouteReviewResponseDto[]> {
		return this.trekkingRoutesRepository.findPendingReview();
	}

	async review(
		adminId: string,
		routeId: string,
		dto: ReviewTrekkingRouteDto
	): Promise<TrekkingRouteReviewResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const repository = manager.withRepository(this.trekkingRoutesRepository);
			const current = await repository.findReviewRouteByIdForUpdate(routeId);

			if (!current) {
				throw new NotFoundException("Trekking route not found");
			}
			if (current.status !== TrekkingRouteStatus.PENDING_APPROVAL) {
				throw new ConflictException(
					"Only trekking routes in pending_approval status can be reviewed"
				);
			}

			if (dto.action === ReviewTrekkingRouteAction.APPROVE) {
				const integrity = await repository.validateApprovalIntegrity(routeId);
				const errors: Array<{ field: string; errors: string[] }> = [];
				if (!integrity.geometryValid) {
					errors.push({ field: "geometry", errors: ["stored route geometry is invalid"] });
				}
				if (!integrity.difficultyValid) {
					errors.push({ field: "difficulty", errors: ["stored route difficulty is invalid"] });
				}
				if (!integrity.checkpointsValid) {
					errors.push({ field: "checkpoints", errors: ["stored route checkpoints are invalid"] });
				}
				if (errors.length > 0) {
					throw new UnprocessableEntityException({
						statusCode: 422,
						error: "Unprocessable Entity",
						message: errors,
					});
				}
			}

			const targetStatus = this.reviewTargetStatus(dto.action);
			const updated = await repository.updateStatus(routeId, targetStatus);
			await manager.getRepository(AuditLog).save({
				actorId: adminId,
				action: this.reviewAuditAction(dto.action),
				targetType: "trekking_route",
				targetId: routeId,
				before: { status: current.status },
				after: { status: targetStatus },
				reason: dto.action === ReviewTrekkingRouteAction.APPROVE ? null : (dto.reason ?? null),
			});

			return {
				...updated,
				campsiteName: current.campsiteName,
				checkpoints: current.checkpoints,
			};
		});
	}

	async create(hostId: string, dto: CreateTrekkingRouteDto): Promise<TrekkingRouteResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const campsite = await manager.getRepository(Campsite).findOne({
				where: { id: dto.campsiteId },
				lock: { mode: "pessimistic_read" },
			});

			if (!campsite) {
				throw new NotFoundException("Campsite not found");
			}
			if (campsite.hostId !== hostId) {
				throw new ForbiddenException("Only the owning Host can create a route for this campsite");
			}

			const transactionalRepository = manager.withRepository(this.trekkingRoutesRepository);
			const route = await transactionalRepository.createDraft({
				campsiteId: dto.campsiteId,
				name: dto.name,
				description: dto.description ?? null,
				geometry: dto.geometry,
				difficulty: dto.difficulty,
				expectedDurationMinutes: dto.expectedDurationMinutes,
			});

			await manager.getRepository(AuditLog).save({
				actorId: hostId,
				action: "trekking_route.created",
				targetType: "trekking_route",
				targetId: route.id,
				before: null,
				after: this.buildAuditSnapshot(route),
				reason: "host_create_trekking_route",
			});

			return route;
		});
	}

	private buildAuditSnapshot(route: TrekkingRouteResponseDto): Record<string, unknown> {
		const coordinates = route.geometry.coordinates;
		return {
			id: route.id,
			campsiteId: route.campsiteId,
			name: route.name,
			description: route.description,
			difficulty: route.difficulty,
			expectedDurationMinutes: route.expectedDurationMinutes,
			status: route.status,
			geometry: {
				type: route.geometry.type,
				vertexCount: coordinates.length,
				start: coordinates[0],
				end: coordinates.at(-1),
				lengthMeters: route.lengthMeters,
				boundingBox: boundingBox(route.geometry),
			},
		};
	}

	private reviewTargetStatus(action: ReviewTrekkingRouteAction): TrekkingRouteStatus {
		switch (action) {
			case ReviewTrekkingRouteAction.APPROVE:
				return TrekkingRouteStatus.ACTIVE;
			case ReviewTrekkingRouteAction.DECLINE:
				return TrekkingRouteStatus.DRAFT;
			case ReviewTrekkingRouteAction.NON_OPERABLE:
				return TrekkingRouteStatus.CLOSED;
		}
	}

	private reviewAuditAction(action: ReviewTrekkingRouteAction): string {
		switch (action) {
			case ReviewTrekkingRouteAction.APPROVE:
				return "trekking_route.approved";
			case ReviewTrekkingRouteAction.DECLINE:
				return "trekking_route.declined";
			case ReviewTrekkingRouteAction.NON_OPERABLE:
				return "trekking_route.closed";
		}
	}
}

function boundingBox(geometry: GeoLineString): [number, number, number, number] {
	const longitudes = geometry.coordinates.map(([longitude]) => longitude);
	const latitudes = geometry.coordinates.map(([, latitude]) => latitude);
	return [
		Math.min(...longitudes),
		Math.min(...latitudes),
		Math.max(...longitudes),
		Math.max(...latitudes),
	];
}
