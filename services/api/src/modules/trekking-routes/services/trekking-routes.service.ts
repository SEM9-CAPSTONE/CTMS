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
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
import type { CreateTrekkingRouteDto } from "../dto/create-trekking-route.dto";
import type { ListRouteReviewsQueryDto } from "../dto/list-route-reviews-query.dto";
import {
	ALL_TREKKING_ROUTE_STATUSES,
	type ListTrekkingRoutesQueryDto,
} from "../dto/list-trekking-routes-query.dto";
import {
	ReviewTrekkingRouteAction,
	type ReviewTrekkingRouteDto,
} from "../dto/review-trekking-route.dto";
import type { RouteStatusReasonDto } from "../dto/route-status-reason.dto";
import type {
	PaginatedTrekkingRoutesResponseDto,
	TrekkingRouteResponseDto,
} from "../dto/trekking-route-response.dto";
import type {
	PaginatedRouteReviewsResponseDto,
	TrekkingRouteReviewResponseDto,
} from "../dto/trekking-route-review-response.dto";
import { type GeoLineString, TrekkingRouteStatus } from "../entities/trekking-route.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { TrekkingRoutesRepository } from "../repositories/trekking-routes.repository";

@Injectable()
export class TrekkingRoutesService {
	constructor(
		private readonly trekkingRoutesRepository: TrekkingRoutesRepository,
		private readonly dataSource: DataSource
	) {}

	async listByHost(hostId: string): Promise<TrekkingRouteResponseDto[]> {
		return this.trekkingRoutesRepository.findByHost(hostId);
	}

	async getOwnedById(hostId: string, routeId: string): Promise<TrekkingRouteResponseDto> {
		const route = await this.trekkingRoutesRepository.findRouteById(routeId);
		if (!route) throw new NotFoundException("Trekking route not found");
		if (route.hostId !== hostId) {
			throw new ForbiddenException("Only the owning Host can view this trekking route");
		}
		return route;
	}

	async listByHostPaginated(
		hostId: string,
		query: ListTrekkingRoutesQueryDto
	): Promise<PaginatedTrekkingRoutesResponseDto> {
		const status = query.status === ALL_TREKKING_ROUTE_STATUSES ? null : query.status;
		const { items, total, statusCounts } = await this.trekkingRoutesRepository.findByHostPaginated(
			hostId,
			query.page,
			query.limit,
			status,
			query.search ?? "",
			query.sort ?? "newest"
		);
		return {
			items,
			statusCounts,
			pagination: {
				page: query.page,
				limit: query.limit,
				total,
				totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
			},
		};
	}

	listPendingReview(): Promise<TrekkingRouteReviewResponseDto[]> {
		return this.trekkingRoutesRepository.findPendingReview();
	}

	async listAdminReviews(
		query: ListRouteReviewsQueryDto
	): Promise<PaginatedRouteReviewsResponseDto> {
		const { items, total } = await this.trekkingRoutesRepository.findAdminReviews(
			query.reviewOutcome,
			query.page,
			query.limit
		);
		return {
			items,
			pagination: {
				page: query.page,
				limit: query.limit,
				total,
				totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
			},
		};
	}

	async submitForApproval(hostId: string, routeId: string): Promise<TrekkingRouteResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const repository = manager.withRepository(this.trekkingRoutesRepository);
			const lockedRoute = await repository.findOneForLifecycleUpdate(routeId);

			if (!lockedRoute) {
				throw new NotFoundException("Trekking route not found");
			}
			if (lockedRoute.hostId !== hostId) {
				throw new ForbiddenException("Only the owning Host can submit this trekking route");
			}
			if (lockedRoute.route.status !== TrekkingRouteStatus.DRAFT) {
				throw new ConflictException("Only draft trekking routes can be submitted for approval");
			}
			if (!lockedRoute.integrityValid) {
				throw this.submissionValidationException([
					{ field: "route", errors: ["stored route data is invalid"] },
				]);
			}

			const updated = await repository.updateStatus(routeId, TrekkingRouteStatus.PENDING_APPROVAL);
			await manager.getRepository(AuditLog).save({
				actorId: hostId,
				action: "trekking_route.submitted_for_approval",
				targetType: "trekking_route",
				targetId: routeId,
				before: { status: TrekkingRouteStatus.DRAFT },
				after: { status: TrekkingRouteStatus.PENDING_APPROVAL },
				reason: "host_submit_trekking_route_for_approval",
			});

			return updated;
		});
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
				checkpoints: current.checkpoints,
				dangerZones: current.dangerZones,
			};
		});
	}

	async create(hostId: string, dto: CreateTrekkingRouteDto): Promise<TrekkingRouteResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const transactionalRepository = manager.withRepository(this.trekkingRoutesRepository);
			const route = await transactionalRepository.createDraft({
				hostId,
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

	async updateDraft(
		hostId: string,
		routeId: string,
		dto: CreateTrekkingRouteDto
	): Promise<TrekkingRouteResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const repository = manager.withRepository(this.trekkingRoutesRepository);
			const locked = await repository.findOneForLifecycleUpdate(routeId);
			if (!locked) throw new NotFoundException("Trekking route not found");
			if (locked.hostId !== hostId) {
				throw new ForbiddenException("Only the owning Host can edit this trekking route");
			}
			if (locked.route.status !== TrekkingRouteStatus.DRAFT) {
				throw new ConflictException("Only draft trekking routes can be edited");
			}
			// A previously published route can return to draft after reopening/review.
			// Without route version snapshots, editing it would also alter linked Trips.
			if (await repository.hasTripReferences(routeId)) {
				throw new ConflictException("Routes already referenced by Trips cannot be edited in place");
			}
			const updated = await repository.updateDraft(routeId, {
				...dto,
				hostId,
				description: dto.description ?? null,
			});
			await manager.getRepository(AuditLog).save({
				actorId: hostId,
				action: "trekking_route.updated",
				targetType: "trekking_route",
				targetId: routeId,
				before: this.buildAuditSnapshot(locked.route),
				after: this.buildAuditSnapshot(updated),
				reason: "host_update_draft_trekking_route",
			});
			return updated;
		});
	}

	close(
		actor: AuthenticatedUser,
		routeId: string,
		dto: RouteStatusReasonDto
	): Promise<TrekkingRouteResponseDto> {
		return this.changeStatus(
			actor,
			routeId,
			TrekkingRouteStatus.ACTIVE,
			TrekkingRouteStatus.CLOSED,
			"trekking_route.closed",
			dto.reason
		);
	}

	reopen(
		actor: AuthenticatedUser,
		routeId: string,
		dto: RouteStatusReasonDto
	): Promise<TrekkingRouteResponseDto> {
		return this.changeStatus(
			actor,
			routeId,
			TrekkingRouteStatus.CLOSED,
			TrekkingRouteStatus.PENDING_APPROVAL,
			"trekking_route.reopened",
			dto.reason,
			true
		);
	}

	private async changeStatus(
		actor: AuthenticatedUser,
		routeId: string,
		expectedStatus: TrekkingRouteStatus,
		nextStatus: TrekkingRouteStatus,
		action: string,
		reason: string,
		validateIntegrity = false
	): Promise<TrekkingRouteResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const repository = manager.withRepository(this.trekkingRoutesRepository);
			const lockedRoute = await repository.findOneForLifecycleUpdate(routeId);
			if (!lockedRoute) {
				throw new NotFoundException("Trekking route not found");
			}

			this.assertLifecycleActor(actor, lockedRoute.hostId);
			if (lockedRoute.route.status !== expectedStatus) {
				throw new ConflictException("Trekking route status transition is not allowed");
			}
			if (validateIntegrity && !lockedRoute.integrityValid) {
				throw new ConflictException("Trekking route data must be valid before reopening");
			}

			const before = { status: lockedRoute.route.status };
			const updatedRoute = await repository.updateStatus(routeId, nextStatus);

			await manager.getRepository(AuditLog).save({
				actorId: actor.userId,
				action,
				targetType: "trekking_route",
				targetId: routeId,
				before,
				after: { status: updatedRoute.status },
				reason,
			});

			return updatedRoute;
		});
	}

	private assertLifecycleActor(actor: AuthenticatedUser, owningHostId: string): void {
		if (actor.roles.includes(UserRole.ADMIN)) return;
		if (!actor.roles.includes(UserRole.HOST)) {
			throw new ForbiddenException("Only a Host or Admin can change trekking route status");
		}
		if (actor.userId !== owningHostId) {
			throw new ForbiddenException("Only the owning Host can change this trekking route status");
		}
	}

	private submissionValidationException(
		message: Array<{ field: string; errors: string[] }>
	): UnprocessableEntityException {
		return new UnprocessableEntityException({
			statusCode: 422,
			error: "Unprocessable Entity",
			message,
		});
	}

	private buildAuditSnapshot(route: TrekkingRouteResponseDto): Record<string, unknown> {
		const coordinates = route.geometry.coordinates;
		return {
			id: route.id,
			hostId: route.hostId,
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
