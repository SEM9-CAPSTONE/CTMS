import {
	ConflictException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { DataSource, EntityManager } from "typeorm";
import { AuditLog } from "../../auth/entities/audit-log.entity";
import { type User, UserRole, UserStatus } from "../../users/entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { UsersRepository } from "../../users/users.repository";
import type { UpdateHealthProfileDto } from "../dto/update-health-profile.dto";
import { Booking } from "../entities/booking.entity";
import type { HealthProfile } from "../entities/health-profile.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { HealthProfileRepository } from "../repositories/health-profile.repository";

const ACCOUNT_NOT_ACTIVE_MESSAGE = "Account is not active";
const ACCESS_DENIED_MESSAGE = "Access denied";
const CONFLICT_MESSAGE = "CONFLICT";

@Injectable()
export class CamperHealthProfileService {
	private readonly logger = new Logger(CamperHealthProfileService.name);

	constructor(
		private readonly healthProfileRepository: HealthProfileRepository,
		private readonly usersRepository: UsersRepository,
		private readonly dataSource: DataSource
	) {}

	private async verifyUserIsActive(userId: string, manager?: EntityManager): Promise<User> {
		const repo = manager ? manager.withRepository(this.usersRepository) : this.usersRepository;
		const user = await repo.findOneWithRolesById(userId);
		if (!user) {
			throw new NotFoundException("User not found");
		}
		if (user.status !== UserStatus.ACTIVE) {
			throw new ForbiddenException(ACCOUNT_NOT_ACTIVE_MESSAGE);
		}
		return user;
	}

	async getOrCreateProfile(userId: string): Promise<HealthProfile> {
		// Enforce active account check (BR-202)
		const user = await this.verifyUserIsActive(userId);

		const profile = await this.healthProfileRepository.findByUserId(userId);
		if (profile) {
			return profile;
		}

		// Run inside transaction to create default profile (BR-207)
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const transactionalHpRepository = manager.withRepository(this.healthProfileRepository);
			const existing = await transactionalHpRepository.findOne({
				where: { userId },
				relations: { user: true },
			});
			if (existing) {
				return existing;
			}

			const newProfile = transactionalHpRepository.create({
				userId,
				allergies: [],
				medicalConditions: [],
				isConsentGranted: false,
			});

			const saved = await transactionalHpRepository.save(newProfile);
			saved.user = user; // attach user back
			return saved;
		});
	}

	async updateProfile(
		userId: string,
		dto: UpdateHealthProfileDto,
		clientVersion: number
	): Promise<HealthProfile> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			// Enforce active account check (BR-202)
			await this.verifyUserIsActive(userId, manager);

			const hpRepository = manager.withRepository(this.healthProfileRepository);
			const auditLogRepository = manager.getRepository(AuditLog);

			const profile = await hpRepository.findOne({
				where: { userId },
				relations: { user: true },
			});

			if (!profile) {
				throw new NotFoundException("Health profile not found");
			}

			// Optimistic Locking Concurrency Control (BR-242)
			if (clientVersion < profile.version) {
				throw new ConflictException(CONFLICT_MESSAGE);
			}

			const before = this.snapshot(profile);

			// Map updates
			profile.bloodType = dto.bloodType;
			profile.physicalFitnessLevel = dto.physicalFitnessLevel;
			profile.dietaryRestrictions = dto.dietaryRestrictions || null;
			profile.emergencyNotes = dto.emergencyNotes || null;
			profile.allergies = dto.allergies;
			profile.medicalConditions = dto.medicalConditions;

			if (profile.isConsentGranted !== dto.isConsentGranted) {
				profile.isConsentGranted = dto.isConsentGranted;
				if (dto.isConsentGranted) {
					profile.consentGrantedAt = new Date();
				} else {
					profile.consentRevokedAt = new Date();
				}
			}

			profile.version = profile.version + 1;

			const saved = await hpRepository.save(profile);
			const after = this.snapshot(saved);

			// Write audit log (BR-223)
			await auditLogRepository.save({
				actorId: userId,
				action: "health_profile.updated",
				targetType: "user",
				targetId: userId,
				before,
				after,
				reason: "self_service_health_profile_update",
			});

			return saved;
		});
	}

	async grantConsent(userId: string): Promise<HealthProfile> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			await this.verifyUserIsActive(userId, manager);

			const hpRepository = manager.withRepository(this.healthProfileRepository);
			const auditLogRepository = manager.getRepository(AuditLog);

			let profile = await hpRepository.findOne({
				where: { userId },
				relations: { user: true },
			});

			if (!profile) {
				const user = await this.verifyUserIsActive(userId, manager);
				profile = hpRepository.create({
					userId,
					allergies: [],
					medicalConditions: [],
					isConsentGranted: false,
					version: 0,
				});
				profile.user = user;
			}

			const before = this.snapshot(profile);

			profile.isConsentGranted = true;
			profile.consentGrantedAt = new Date();
			profile.version = profile.version + 1;

			const saved = await hpRepository.save(profile);
			const after = this.snapshot(saved);

			await auditLogRepository.save({
				actorId: userId,
				action: "health_profile.consent_granted",
				targetType: "user",
				targetId: userId,
				before,
				after,
				reason: "self_service_health_consent_grant",
			});

			return saved;
		});
	}

	async revokeConsent(userId: string): Promise<HealthProfile> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			await this.verifyUserIsActive(userId, manager);

			const hpRepository = manager.withRepository(this.healthProfileRepository);
			const auditLogRepository = manager.getRepository(AuditLog);

			let profile = await hpRepository.findOne({
				where: { userId },
				relations: { user: true },
			});

			if (!profile) {
				const user = await this.verifyUserIsActive(userId, manager);
				profile = hpRepository.create({
					userId,
					allergies: [],
					medicalConditions: [],
					isConsentGranted: false,
					version: 0,
				});
				profile.user = user;
			}

			const before = this.snapshot(profile);

			profile.isConsentGranted = false;
			profile.consentRevokedAt = new Date();
			profile.version = profile.version + 1;

			const saved = await hpRepository.save(profile);
			const after = this.snapshot(saved);

			await auditLogRepository.save({
				actorId: userId,
				action: "health_profile.consent_revoked",
				targetType: "user",
				targetId: userId,
				before,
				after,
				reason: "self_service_health_consent_revoke",
			});

			return saved;
		});
	}

	async getCamperProfile(
		callerId: string,
		camperId: string
	): Promise<{ profile: HealthProfile; activeTripTitle?: string }> {
		// Caller must be an active account (BR-202)
		const caller = await this.verifyUserIsActive(callerId);

		const profile = await this.healthProfileRepository.findByUserId(camperId);
		if (!profile) {
			throw new NotFoundException("Health profile not found");
		}

		// Owner can always access
		if (callerId === camperId) {
			// Find active trip title if exists
			const activeBooking = await this.dataSource
				.getRepository(Booking)
				.createQueryBuilder("booking")
				.innerJoinAndSelect("booking.trip", "trip")
				.where("booking.userId = :camperId", { camperId })
				.getOne();

			return { profile, activeTripTitle: activeBooking?.trip.title };
		}

		// Check if consent has been granted (BR-025 / BR-218)
		if (!profile.isConsentGranted) {
			throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
		}

		// Validate caller relationship to Camper via a Trip (BR-025 / BR-204)
		let booking: Booking | null = null;

		const callerRoles = this.usersRepository.getGrantedRoles(caller);

		if (callerRoles.includes(UserRole.ADMIN)) {
			booking = await this.dataSource
				.getRepository(Booking)
				.createQueryBuilder("booking")
				.innerJoinAndSelect("booking.trip", "trip")
				.where("booking.userId = :camperId", { camperId })
				.getOne();
		} else if (callerRoles.includes(UserRole.HOST)) {
			// Check if host is associated with a Trip this Camper booked
			booking = await this.dataSource
				.getRepository(Booking)
				.createQueryBuilder("booking")
				.innerJoinAndSelect("booking.trip", "trip")
				.where("booking.userId = :camperId", { camperId })
				.andWhere("trip.hostId = :callerId", { callerId })
				.getOne();
		} else if (callerRoles.includes(UserRole.PORTER)) {
			// Check if porter is assigned to a Trip this Camper booked
			booking = await this.dataSource
				.getRepository(Booking)
				.createQueryBuilder("booking")
				.innerJoinAndSelect("booking.trip", "trip")
				.innerJoin("trip_porters", "tp", "tp.trip_id = trip.id")
				.where("booking.userId = :camperId", { camperId })
				.andWhere("tp.porter_id = :callerId", { callerId })
				.getOne();
		}

		if (!booking) {
			throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
		}

		return { profile, activeTripTitle: booking.trip.title };
	}

	private snapshot(entity: HealthProfile) {
		return {
			bloodType: entity.bloodType,
			physicalFitnessLevel: entity.physicalFitnessLevel,
			dietaryRestrictions: entity.dietaryRestrictions,
			emergencyNotes: entity.emergencyNotes,
			allergies: entity.allergies,
			medicalConditions: entity.medicalConditions,
			isConsentGranted: entity.isConsentGranted,
			version: entity.version,
		};
	}
}
