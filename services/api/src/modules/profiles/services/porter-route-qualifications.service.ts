import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs runtime metadata
import { DataSource, type EntityManager, QueryFailedError } from "typeorm";
import { AuditLog } from "../../auth/entities/audit-log.entity";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs runtime metadata
import { TrekkingRoutesRepository } from "../../trekking-routes/repositories/trekking-routes.repository";
import { UserRole, UserStatus } from "../../users/entities/user.entity";
import type { User } from "../../users/entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs runtime metadata
import { UsersRepository } from "../../users/users.repository";
import {
	type PorterRouteQualificationResponseDto,
	type RoutePorterQualificationResponseDto,
	toPorterRouteQualificationResponse,
	toRoutePorterQualificationResponse,
} from "../dto/porter-route-qualification-response.dto";
import type { UpsertPorterRouteQualificationDto } from "../dto/upsert-porter-route-qualification.dto";
import type { VerifyPorterRouteQualificationDto } from "../dto/verify-porter-route-qualification.dto";
import type { PorterRouteQualification } from "../entities/porter-route-qualification.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs runtime metadata
import { PorterProfilesRepository } from "../repositories/porter-profiles.repository";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs runtime metadata
import { PorterRouteQualificationsRepository } from "../repositories/porter-route-qualifications.repository";

const UNIQUE_PORTER_ROUTE = "UQ_porter_route_qualifications_porter_route";
const ACTIVE_PORTER_REQUIRED = "An active Porter account is required";
const PROFILE_REQUIRED = "Persisted Porter profile not found";
const ROUTE_NOT_FOUND = "Trekking route not found";
const QUALIFICATION_NOT_FOUND = "Porter Route qualification not found";
const VERSION_REQUIRED = "expectedVersion is required for an existing qualification";
const VERSION_NOT_ALLOWED = "expectedVersion must be absent when creating a qualification";
const STALE_VERSION = "Qualification has changed; reload the latest version";

@Injectable()
export class PorterRouteQualificationsService {
	constructor(
		private readonly qualificationsRepository: PorterRouteQualificationsRepository,
		private readonly porterProfilesRepository: PorterProfilesRepository,
		private readonly trekkingRoutesRepository: TrekkingRoutesRepository,
		private readonly usersRepository: UsersRepository,
		private readonly dataSource: DataSource
	) {}

	async listMine(porterId: string): Promise<PorterRouteQualificationResponseDto[]> {
		await this.requireActivePorter(porterId, this.usersRepository);
		const qualifications = await this.qualificationsRepository.listByPorterId(porterId);
		return qualifications.map(toPorterRouteQualificationResponse);
	}

	async upsertMine(
		porterId: string,
		routeId: string,
		dto: UpsertPorterRouteQualificationDto
	): Promise<PorterRouteQualificationResponseDto> {
		const existedBeforeTransaction = Boolean(
			await this.qualificationsRepository.findOneBy({ porterId, routeId })
		);
		try {
			return await this.dataSource.transaction(async (manager: EntityManager) => {
				const routesRepository = manager.withRepository(this.trekkingRoutesRepository);
				const usersRepository = manager.withRepository(this.usersRepository);
				const profilesRepository = manager.withRepository(this.porterProfilesRepository);
				const qualificationsRepository = manager.withRepository(this.qualificationsRepository);

				const route = await routesRepository.findOneForLifecycleUpdate(routeId);
				if (!route) throw new NotFoundException(ROUTE_NOT_FOUND);
				await this.requireActivePorter(porterId, usersRepository, true);
				const profile = await profilesRepository.findByPorterIdForUpdate(porterId);
				if (!profile) throw new NotFoundException(PROFILE_REQUIRED);
				const current = await qualificationsRepository.findByPorterAndRouteForUpdate(
					porterId,
					routeId
				);

				if (!current) {
					if (dto.expectedVersion !== undefined) {
						throw new UnprocessableEntityException(VERSION_NOT_ALLOWED);
					}
					const created = qualificationsRepository.create({
						porterId,
						routeId,
						proficiency: dto.proficiency,
						timesLed: dto.timesLed,
						verifiedBy: null,
						verifiedAt: null,
						version: 1,
					});
					const saved = await qualificationsRepository.save(created);
					await this.writeQualificationAudit(manager, "created", saved, null, false);
					return toPorterRouteQualificationResponse(saved);
				}

				if (dto.expectedVersion === undefined) {
					if (!existedBeforeTransaction) {
						await qualificationsRepository.insert({
							porterId,
							routeId,
							proficiency: dto.proficiency,
							timesLed: dto.timesLed,
							verifiedBy: null,
							verifiedAt: null,
							version: 1,
						});
					}
					throw new UnprocessableEntityException(VERSION_REQUIRED);
				}
				if (dto.expectedVersion !== current.version) {
					throw new ConflictException(STALE_VERSION);
				}
				if (current.proficiency === dto.proficiency && current.timesLed === dto.timesLed) {
					return toPorterRouteQualificationResponse(current);
				}

				const before = qualificationSnapshot(current);
				const verificationCleared = current.verifiedBy !== null;
				current.proficiency = dto.proficiency;
				current.timesLed = dto.timesLed;
				current.verifiedBy = null;
				current.verifiedAt = null;
				current.version += 1;
				const saved = await qualificationsRepository.save(current);
				await this.writeQualificationAudit(manager, "updated", saved, before, verificationCleared);
				return toPorterRouteQualificationResponse(saved);
			});
		} catch (error: unknown) {
			if (isNamedUniqueViolation(error, UNIQUE_PORTER_ROUTE)) {
				throw new ConflictException("A qualification already exists for this Porter and Route");
			}
			throw error;
		}
	}

	async listForRoute(
		actor: AuthenticatedUser,
		routeId: string
	): Promise<RoutePorterQualificationResponseDto[]> {
		const route = await this.trekkingRoutesRepository.findOneBy({ id: routeId });
		if (!route) throw new NotFoundException(ROUTE_NOT_FOUND);
		const currentActor = await this.usersRepository.findOneWithRolesById(actor.userId);
		this.assertRouteVerifier(currentActor, route.hostId);
		const rows = await this.qualificationsRepository.listByRouteId(routeId);
		return rows.map(toRoutePorterQualificationResponse);
	}

	async verify(
		actor: AuthenticatedUser,
		qualificationId: string,
		dto: VerifyPorterRouteQualificationDto
	): Promise<PorterRouteQualificationResponseDto> {
		const identity = await this.qualificationsRepository.findIdentityById(qualificationId);
		if (!identity) throw new NotFoundException(QUALIFICATION_NOT_FOUND);

		return this.dataSource.transaction(async (manager: EntityManager) => {
			const routesRepository = manager.withRepository(this.trekkingRoutesRepository);
			const usersRepository = manager.withRepository(this.usersRepository);
			const profilesRepository = manager.withRepository(this.porterProfilesRepository);
			const qualificationsRepository = manager.withRepository(this.qualificationsRepository);

			const route = await routesRepository.findOneForLifecycleUpdate(identity.routeId);
			if (!route) throw new NotFoundException(ROUTE_NOT_FOUND);
			const currentActor = await usersRepository.findOneWithRolesById(actor.userId);
			this.assertRouteVerifier(currentActor, route.hostId);

			const porter = await usersRepository.findOneWithRolesByIdForUpdate(identity.porterId);
			if (!this.isActivePorter(porter, usersRepository)) {
				throw new ConflictException("Target Porter is no longer active and eligible");
			}
			const profile = await profilesRepository.findByPorterIdForUpdate(identity.porterId);
			if (!profile) throw new ConflictException("Target Porter profile is no longer valid");
			const qualification = await qualificationsRepository.findByIdForUpdate(qualificationId);
			if (
				!qualification ||
				qualification.routeId !== identity.routeId ||
				qualification.porterId !== identity.porterId
			) {
				throw new NotFoundException(QUALIFICATION_NOT_FOUND);
			}
			if (actor.userId === qualification.porterId) {
				throw new ForbiddenException("A Porter cannot verify their own qualification");
			}
			if (dto.expectedVersion !== qualification.version) {
				throw new ConflictException(STALE_VERSION);
			}
			if (qualification.verifiedBy !== null || qualification.verifiedAt !== null) {
				throw new ConflictException("Qualification is already verified");
			}

			const oldVersion = qualification.version;
			qualification.verifiedBy = actor.userId;
			qualification.verifiedAt = new Date();
			qualification.version += 1;
			const saved = await qualificationsRepository.save(qualification);
			await manager.getRepository(AuditLog).save({
				actorId: actor.userId,
				action: "porter_route_qualification.verified",
				targetType: "porter_route_qualification",
				targetId: saved.id,
				before: {
					porterId: saved.porterId,
					routeId: saved.routeId,
					qualificationId: saved.id,
					version: oldVersion,
				},
				after: {
					porterId: saved.porterId,
					routeId: saved.routeId,
					qualificationId: saved.id,
					verifiedAt: saved.verifiedAt,
					version: saved.version,
				},
				reason: "route_qualification_verification",
			});
			return toPorterRouteQualificationResponse(saved);
		});
	}

	isLeadEligible(porterId: string, routeId: string, manager?: EntityManager): Promise<boolean> {
		return this.qualificationsRepository.isVerifiedLeadQualified(porterId, routeId, manager);
	}

	private async requireActivePorter(
		porterId: string,
		repository: UsersRepository,
		lock = false
	): Promise<void> {
		const porter = lock
			? await repository.findOneWithRolesByIdForUpdate(porterId)
			: await repository.findOneWithRolesById(porterId);
		if (!this.isActivePorter(porter, repository)) {
			throw new ForbiddenException(ACTIVE_PORTER_REQUIRED);
		}
	}

	private isActivePorter(user: User | null, repository: UsersRepository): user is User {
		return Boolean(
			user &&
				user.status === UserStatus.ACTIVE &&
				repository.getGrantedRoles(user).includes(UserRole.PORTER)
		);
	}

	private assertRouteVerifier(actor: User | null, owningHostId: string): void {
		if (!actor || actor.status !== UserStatus.ACTIVE) {
			throw new ForbiddenException("Active Host or Admin account required");
		}
		const roles = this.usersRepository.getGrantedRoles(actor);
		if (roles.includes(UserRole.ADMIN)) return;
		if (!roles.includes(UserRole.HOST) || actor.id !== owningHostId) {
			throw new ForbiddenException("Only the owning Host or an Admin may access qualifications");
		}
	}

	private async writeQualificationAudit(
		manager: EntityManager,
		action: "created" | "updated",
		qualification: PorterRouteQualification,
		before: Record<string, unknown> | null,
		verificationCleared: boolean
	): Promise<void> {
		await manager.getRepository(AuditLog).save({
			actorId: qualification.porterId,
			action: `porter_route_qualification.${action}`,
			targetType: "porter_route_qualification",
			targetId: qualification.id,
			before,
			after: {
				...qualificationSnapshot(qualification),
				verificationCleared,
			},
			reason: "self_service_route_qualification_claim",
		});
	}
}

function qualificationSnapshot(qualification: PorterRouteQualification): Record<string, unknown> {
	return {
		porterId: qualification.porterId,
		routeId: qualification.routeId,
		qualificationId: qualification.id,
		proficiency: qualification.proficiency,
		timesLed: qualification.timesLed,
		version: qualification.version,
	};
}

function isNamedUniqueViolation(error: unknown, constraint: string): boolean {
	if (!(error instanceof QueryFailedError)) return false;
	const driverError = error.driverError as { code?: unknown; constraint?: unknown };
	return driverError.code === "23505" && driverError.constraint === constraint;
}
