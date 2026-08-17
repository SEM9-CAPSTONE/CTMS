import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource } from "typeorm";
import type { EntityManager } from "typeorm";
import { AuditLog } from "../../auth/entities/audit-log.entity";
import { type User, UserStatus } from "../../users/entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { UsersRepository } from "../../users/users.repository";
import type { ProfileResponseDto } from "../dto/profile-response.dto";
import { toProfileResponse } from "../dto/profile-response.dto";
import type { UpdateProfileDto } from "../dto/update-profile.dto";
import type { EmergencyContact } from "../entities/emergency-contact.entity";
import type { EmergencyContactSnapshot, ProfileSnapshot } from "../profile.types";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { EmergencyContactsRepository } from "../repositories/emergency-contacts.repository";

const ACTIVE_ACCOUNT_REQUIRED_MESSAGE = "Account must be active";
const PROFILE_NOT_FOUND_MESSAGE = "Profile not found";
const DOB_IN_FUTURE_MESSAGE = "dateOfBirth must not be in the future";

@Injectable()
export class ProfilesService {
	constructor(
		private readonly usersRepository: UsersRepository,
		private readonly emergencyContactsRepository: EmergencyContactsRepository,
		private readonly dataSource: DataSource
	) {}

	async getMyProfile(userId: string): Promise<ProfileResponseDto> {
		const user = await this.findActiveUser(userId);
		const contacts = await this.emergencyContactsRepository.findByUserId(user.id);
		return toProfileResponse(user, contacts);
	}

	async updateMyProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileResponseDto> {
		this.assertDateOfBirthIsNotFuture(dto.dateOfBirth);

		return this.dataSource.transaction(async (manager: EntityManager) => {
			const usersRepository = manager.withRepository(this.usersRepository);
			const contactsRepository = manager.withRepository(this.emergencyContactsRepository);
			const auditLogRepository = manager.getRepository<AuditLog>(AuditLog);

			const user = await this.findActiveUser(userId, usersRepository);
			const existingContacts = await contactsRepository.findByUserId(user.id);
			const before = this.snapshot(user, existingContacts);

			const userPatch = this.toUserPatch(dto);
			if (Object.keys(userPatch).length > 0) {
				await usersRepository.update(user.id, userPatch);
			}

			let contacts = existingContacts;
			if (dto.emergencyContacts) {
				await contactsRepository.delete({ userId: user.id });
				contacts = await contactsRepository.save(
					dto.emergencyContacts.map((contact) =>
						contactsRepository.create({
							userId: user.id,
							name: contact.name,
							relationship: contact.relationship,
							phone: contact.phone,
							email: contact.email ?? null,
						})
					)
				);
			}

			const updatedUser = await usersRepository.findOneByOrFail({ id: user.id });
			const after = this.snapshot(updatedUser, contacts);

			if (JSON.stringify(before) !== JSON.stringify(after)) {
				await auditLogRepository.save({
					actorId: user.id,
					action: "profile.updated",
					targetType: "user",
					targetId: user.id,
					before,
					after,
					reason: "self_service_profile_update",
				});
			}

			return toProfileResponse(updatedUser, contacts);
		});
	}

	private async findActiveUser(
		userId: string,
		usersRepository: UsersRepository = this.usersRepository
	): Promise<User> {
		const user = await usersRepository.findOneBy({ id: userId });
		if (!user) {
			throw new NotFoundException(PROFILE_NOT_FOUND_MESSAGE);
		}
		if (user.status !== UserStatus.ACTIVE) {
			throw new ForbiddenException(ACTIVE_ACCOUNT_REQUIRED_MESSAGE);
		}
		return user;
	}

	private assertDateOfBirthIsNotFuture(dateOfBirth: string | undefined): void {
		if (!dateOfBirth) {
			return;
		}

		const submitted = new Date(`${dateOfBirth}T00:00:00.000Z`);
		const today = new Date();
		const todayUtc = new Date(
			Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
		);

		if (submitted.getTime() > todayUtc.getTime()) {
			throw new ForbiddenException(DOB_IN_FUTURE_MESSAGE);
		}
	}

	private toUserPatch(dto: UpdateProfileDto): Partial<User> {
		const patch: Partial<User> = {};
		if (dto.fullName !== undefined) {
			patch.fullName = dto.fullName;
		}
		if (dto.dateOfBirth !== undefined) {
			patch.dateOfBirth = dto.dateOfBirth;
		}
		if (dto.gender !== undefined) {
			patch.gender = dto.gender;
		}
		if (dto.address !== undefined) {
			patch.address = dto.address;
		}
		if (dto.bio !== undefined) {
			patch.bio = dto.bio;
		}
		return patch;
	}

	private snapshot(user: User, contacts: EmergencyContact[]): ProfileSnapshot {
		return {
			fullName: user.fullName,
			dateOfBirth: user.dateOfBirth,
			gender: user.gender,
			address: user.address,
			bio: user.bio,
			emergencyContacts: contacts.map(
				(contact): EmergencyContactSnapshot => ({
					name: contact.name,
					relationship: contact.relationship,
					phone: contact.phone,
					email: contact.email,
				})
			),
		};
	}
}
