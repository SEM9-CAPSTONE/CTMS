import {
	ConflictException,
	ForbiddenException,
	Injectable,
	UnprocessableEntityException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs runtime metadata
import { DataSource, type EntityManager, QueryFailedError } from "typeorm";
import { AuditLog } from "../../auth/entities/audit-log.entity";
import { UserRole, UserStatus } from "../../users/entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs runtime metadata
import { UsersRepository } from "../../users/users.repository";
import { normalizeStringArray } from "../dto/normalized-string-array.validator";
import {
	type PorterProfileResponseDto,
	defaultPorterProfileResponse,
	toPorterProfileResponse,
} from "../dto/porter-profile-response.dto";
import type { UpdatePorterProfileDto } from "../dto/update-porter-profile.dto";
import { PorterAvailabilityStatus, type PorterProfile } from "../entities/porter-profile.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs runtime metadata
import { PorterProfilesRepository } from "../repositories/porter-profiles.repository";

const PROFILE_VERSION_REQUIRED = "expectedVersion is required for an existing Porter profile";
const PROFILE_VERSION_NOT_ALLOWED = "expectedVersion must be absent when creating a Porter profile";
const PROFILE_STALE = "Porter profile has changed; reload the latest version";
const ACTIVE_PORTER_REQUIRED = "An active Porter account is required";
const PROFILE_PRIMARY_KEY = "PK_porter_profiles_porter_id";

interface ProfileWritableSnapshot extends Record<string, unknown> {
	experienceYears: number;
	certifications: string[];
	languages: string[];
	availabilityStatus: PorterAvailabilityStatus;
}

@Injectable()
export class PorterProfilesService {
	constructor(
		private readonly porterProfilesRepository: PorterProfilesRepository,
		private readonly usersRepository: UsersRepository,
		private readonly dataSource: DataSource
	) {}

	async getMyProfile(porterId: string): Promise<PorterProfileResponseDto> {
		await this.requireActivePorter(porterId, this.usersRepository);
		const profile = await this.porterProfilesRepository.findByPorterId(porterId);
		return profile ? toPorterProfileResponse(profile) : defaultPorterProfileResponse(porterId);
	}

	async updateMyProfile(
		porterId: string,
		dto: UpdatePorterProfileDto
	): Promise<PorterProfileResponseDto> {
		try {
			return await this.dataSource.transaction(async (manager: EntityManager) => {
				const usersRepository = manager.withRepository(this.usersRepository);
				const profilesRepository = manager.withRepository(this.porterProfilesRepository);
				await this.requireActivePorter(porterId, usersRepository, true);
				const current = await profilesRepository.findByPorterIdForUpdate(porterId);

				if (!current) {
					if (dto.expectedVersion !== undefined) {
						throw new UnprocessableEntityException(PROFILE_VERSION_NOT_ALLOWED);
					}
					const created = profilesRepository.create({
						porterId,
						experienceYears: dto.experienceYears ?? 0,
						certifications: normalizeStringArray(dto.certifications ?? []),
						languages: normalizeStringArray(dto.languages ?? []),
						availabilityStatus: dto.availabilityStatus ?? PorterAvailabilityStatus.UNAVAILABLE,
						ratingAvg: 0,
						completedTrips: 0,
						version: 1,
					});
					const saved = await profilesRepository.save(created);
					await this.writeAudit(manager, porterId, null, this.snapshot(saved), 0, 1);
					return toPorterProfileResponse(saved);
				}

				if (dto.expectedVersion === undefined) {
					throw new UnprocessableEntityException(PROFILE_VERSION_REQUIRED);
				}
				if (dto.expectedVersion !== current.version) {
					throw new ConflictException(PROFILE_STALE);
				}

				const before = this.snapshot(current);
				const next = this.merge(current, dto);
				const after = this.snapshot(next);
				const [beforeChanges, afterChanges] = changedFields(before, after);
				if (Object.keys(afterChanges).length === 0) {
					return toPorterProfileResponse(current);
				}

				const oldVersion = current.version;
				next.version = oldVersion + 1;
				const saved = await profilesRepository.save(next);
				await this.writeAudit(
					manager,
					porterId,
					beforeChanges,
					afterChanges,
					oldVersion,
					saved.version
				);
				return toPorterProfileResponse(saved);
			});
		} catch (error: unknown) {
			if (isNamedUniqueViolation(error, PROFILE_PRIMARY_KEY)) {
				throw new ConflictException("Porter profile was created concurrently; reload and retry");
			}
			throw error;
		}
	}

	private async requireActivePorter(
		porterId: string,
		repository: UsersRepository,
		lock = false
	): Promise<void> {
		const user = lock
			? await repository.findOneWithRolesByIdForUpdate(porterId)
			: await repository.findOneWithRolesById(porterId);
		if (
			!user ||
			user.status !== UserStatus.ACTIVE ||
			!repository.getGrantedRoles(user).includes(UserRole.PORTER)
		) {
			throw new ForbiddenException(ACTIVE_PORTER_REQUIRED);
		}
	}

	private merge(profile: PorterProfile, dto: UpdatePorterProfileDto): PorterProfile {
		if (dto.experienceYears !== undefined) profile.experienceYears = dto.experienceYears;
		if (dto.certifications !== undefined) {
			profile.certifications = normalizeStringArray(dto.certifications);
		}
		if (dto.languages !== undefined) profile.languages = normalizeStringArray(dto.languages);
		if (dto.availabilityStatus !== undefined) {
			profile.availabilityStatus = dto.availabilityStatus;
		}
		return profile;
	}

	private snapshot(profile: PorterProfile): ProfileWritableSnapshot {
		return {
			experienceYears: profile.experienceYears,
			certifications: [...profile.certifications],
			languages: [...profile.languages],
			availabilityStatus: profile.availabilityStatus,
		};
	}

	private async writeAudit(
		manager: EntityManager,
		porterId: string,
		before: Record<string, unknown> | null,
		after: Record<string, unknown>,
		oldVersion: number,
		newVersion: number
	): Promise<void> {
		await manager.getRepository(AuditLog).save({
			actorId: porterId,
			action: "porter_profile.updated",
			targetType: "porter_profile",
			targetId: porterId,
			before: before ? { porterId, ...before, version: oldVersion } : null,
			after: { porterId, ...after, version: newVersion },
			reason: "self_service_porter_profile_update",
		});
	}
}

function changedFields(
	before: ProfileWritableSnapshot,
	after: ProfileWritableSnapshot
): [Record<string, unknown>, Record<string, unknown>] {
	const beforeChanges: Record<string, unknown> = {};
	const afterChanges: Record<string, unknown> = {};
	for (const key of Object.keys(before) as Array<keyof ProfileWritableSnapshot>) {
		if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
			beforeChanges[key] = before[key];
			afterChanges[key] = after[key];
		}
	}
	return [beforeChanges, afterChanges];
}

function isNamedUniqueViolation(error: unknown, constraint: string): boolean {
	if (!(error instanceof QueryFailedError)) return false;
	const driverError = error.driverError as { code?: unknown; constraint?: unknown };
	return driverError.code === "23505" && driverError.constraint === constraint;
}
