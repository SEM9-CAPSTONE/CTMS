import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { DataSource, EntityManager } from "typeorm";
import { UserRole, UserStatus } from "../../users/entities/user.entity";
import type { User } from "../../users/entities/user.entity";
import type { UsersRepository } from "../../users/users.repository";
import { HealthProfile, BloodType, FitnessLevel } from "../entities/health-profile.entity";
import type { HealthProfileRepository } from "../repositories/health-profile.repository";
import { CamperHealthProfileService } from "./camper-health-profile.service";
import type { UpdateHealthProfileDto } from "../dto/update-health-profile.dto";

const CAMPER_ID = "11111111-1111-1111-1111-111111111111";
const CALLER_ID = "22222222-2222-2222-2222-222222222222";
const FIXED_DATE = new Date("2026-08-08T00:00:00.000Z");

type MockUsersRepository = {
	findOneBy: jest.Mock;
};

type MockHealthProfileRepository = {
	findByUserId: jest.Mock;
	findOne: jest.Mock;
	create: jest.Mock;
	save: jest.Mock;
};

function buildUser(overrides: Partial<User> = {}): User {
	return {
		id: CAMPER_ID,
		email: "camper@example.com",
		phone: "+84912345678",
		passwordHash: "hashed",
		role: UserRole.CAMPER,
		status: UserStatus.ACTIVE,
		fullName: "Nguyen Van B",
		dateOfBirth: null,
		gender: null,
		address: null,
		bio: null,
		createdAt: FIXED_DATE,
		updatedAt: FIXED_DATE,
		...overrides,
	};
}

function buildHealthProfile(overrides: Partial<HealthProfile> = {}): HealthProfile {
	const hp = new HealthProfile();
	hp.id = "hp-1111";
	hp.userId = CAMPER_ID;
	hp.bloodType = BloodType.UNKNOWN;
	hp.physicalFitnessLevel = FitnessLevel.BEGINNER;
	hp.dietaryRestrictions = null;
	hp.emergencyNotes = null;
	hp.allergies = [];
	hp.medicalConditions = [];
	hp.isConsentGranted = false;
	hp.consentGrantedAt = null;
	hp.consentRevokedAt = null;
	hp.version = 1;
	hp.createdAt = FIXED_DATE;
	hp.updatedAt = FIXED_DATE;
	hp.user = buildUser();

	Object.assign(hp, overrides);
	return hp;
}

describe("CamperHealthProfileService", () => {
	let service: CamperHealthProfileService;
	let usersRepository: MockUsersRepository;
	let transactionalUsersRepository: MockUsersRepository;
	let healthProfileRepository: MockHealthProfileRepository;
	let transactionalHealthProfileRepository: MockHealthProfileRepository;
	let auditLogRepository: { save: jest.Mock };
	let bookingRepository: { createQueryBuilder: jest.Mock };
	let manager: { withRepository: jest.Mock; getRepository: jest.Mock };
	let dataSource: { transaction: jest.Mock };

	beforeEach(() => {
		usersRepository = {
			findOneBy: jest.fn(),
		};
		transactionalUsersRepository = {
			findOneBy: jest.fn(),
		};
		healthProfileRepository = {
			findByUserId: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn((input) => input),
			save: jest.fn((input) => Promise.resolve(input)),
		};
		transactionalHealthProfileRepository = {
			findByUserId: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn((input) => input),
			save: jest.fn((input) => Promise.resolve(input)),
		};
		auditLogRepository = { save: jest.fn() };
		bookingRepository = {
			createQueryBuilder: jest.fn(),
		};

		manager = {
			withRepository: jest.fn((repository) => {
				if (repository === usersRepository) {
					return transactionalUsersRepository;
				}
				return transactionalHealthProfileRepository;
			}),
			getRepository: jest.fn().mockImplementation((entityClass) => {
				if (entityClass.name === "AuditLog") {
					return auditLogRepository;
				}
				return bookingRepository;
			}),
		};

		dataSource = {
			transaction: jest.fn(async (callback: (manager: EntityManager) => unknown) =>
				callback(manager as unknown as EntityManager)
			),
			getRepository: jest.fn().mockImplementation((entityClass) => {
				if (entityClass.name === "Booking") {
					return bookingRepository;
				}
				return null;
			}),
		};

		service = new CamperHealthProfileService(
			healthProfileRepository as unknown as HealthProfileRepository,
			usersRepository as unknown as UsersRepository,
			dataSource as unknown as DataSource
		);
	});

	describe("getOrCreateProfile", () => {
		it("returns existing profile if found", async () => {
			const existingProfile = buildHealthProfile();
			usersRepository.findOneBy.mockResolvedValue(buildUser());
			healthProfileRepository.findByUserId.mockResolvedValue(existingProfile);

			const result = await service.getOrCreateProfile(CAMPER_ID);

			expect(healthProfileRepository.findByUserId).toHaveBeenCalledWith(CAMPER_ID);
			expect(result).toBe(existingProfile);
		});

		it("creates default profile inside a transaction if not found", async () => {
			usersRepository.findOneBy.mockResolvedValue(buildUser());
			healthProfileRepository.findByUserId.mockResolvedValue(null);
			transactionalHealthProfileRepository.findOne.mockResolvedValue(null);

			const result = await service.getOrCreateProfile(CAMPER_ID);

			expect(dataSource.transaction).toHaveBeenCalledTimes(1);
			expect(transactionalHealthProfileRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: CAMPER_ID,
					allergies: [],
					medicalConditions: [],
					isConsentGranted: false,
				})
			);
			expect(result.userId).toBe(CAMPER_ID);
		});

		it.each([UserStatus.PENDING_VERIFICATION, UserStatus.SUSPENDED, UserStatus.DELETED])(
			"throws ForbiddenException when user status is %s",
			async (status) => {
				usersRepository.findOneBy.mockResolvedValue(buildUser({ status }));

				await expect(service.getOrCreateProfile(CAMPER_ID)).rejects.toBeInstanceOf(
					ForbiddenException
				);
			}
		);
	});

	describe("updateProfile", () => {
		it("updates profile values, increments version and writes audit log in transaction", async () => {
			const activeUser = buildUser();
			const existingProfile = buildHealthProfile();
			transactionalUsersRepository.findOneBy.mockResolvedValue(activeUser);
			transactionalHealthProfileRepository.findOne.mockResolvedValue(existingProfile);

			const dto: UpdateHealthProfileDto = {
				bloodType: BloodType.O_PLUS,
				physicalFitnessLevel: FitnessLevel.INTERMEDIATE,
				dietaryRestrictions: "No gluten",
				emergencyNotes: "No known issues",
				allergies: [{ id: "alg-1", name: "Gluten", severity: "LOW", reaction: "Rash" }],
				medicalConditions: [],
				isConsentGranted: true,
			};

			const result = await service.updateProfile(CAMPER_ID, dto, 1);

			expect(result.bloodType).toBe(BloodType.O_PLUS);
			expect(result.physicalFitnessLevel).toBe(FitnessLevel.INTERMEDIATE);
			expect(result.dietaryRestrictions).toBe("No gluten");
			expect(result.version).toBe(2);
			expect(result.isConsentGranted).toBe(true);
			expect(result.consentGrantedAt).toBeInstanceOf(Date);
			expect(auditLogRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					actorId: CAMPER_ID,
					action: "health_profile.updated",
					targetType: "user",
					targetId: CAMPER_ID,
					reason: "self_service_health_profile_update",
				})
			);
		});

		it("throws ConflictException on stale client version (optimistic locking)", async () => {
			const activeUser = buildUser();
			const existingProfile = buildHealthProfile({ version: 2 });
			transactionalUsersRepository.findOneBy.mockResolvedValue(activeUser);
			transactionalHealthProfileRepository.findOne.mockResolvedValue(existingProfile);

			const dto: UpdateHealthProfileDto = {
				bloodType: BloodType.O_PLUS,
				physicalFitnessLevel: FitnessLevel.INTERMEDIATE,
				dietaryRestrictions: null,
				emergencyNotes: null,
				allergies: [],
				medicalConditions: [],
				isConsentGranted: false,
			};

			await expect(service.updateProfile(CAMPER_ID, dto, 1)).rejects.toBeInstanceOf(
				ConflictException
			);
		});
	});

	describe("grantConsent & revokeConsent", () => {
		it("grants consent and increments version and logs audit", async () => {
			const activeUser = buildUser();
			const existingProfile = buildHealthProfile();
			transactionalUsersRepository.findOneBy.mockResolvedValue(activeUser);
			transactionalHealthProfileRepository.findOne.mockResolvedValue(existingProfile);

			const result = await service.grantConsent(CAMPER_ID);

			expect(result.isConsentGranted).toBe(true);
			expect(result.consentGrantedAt).toBeInstanceOf(Date);
			expect(result.version).toBe(2);
			expect(auditLogRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					action: "health_profile.consent_granted",
				})
			);
		});

		it("revokes consent and logs audit", async () => {
			const activeUser = buildUser();
			const existingProfile = buildHealthProfile({ isConsentGranted: true });
			transactionalUsersRepository.findOneBy.mockResolvedValue(activeUser);
			transactionalHealthProfileRepository.findOne.mockResolvedValue(existingProfile);

			const result = await service.revokeConsent(CAMPER_ID);

			expect(result.isConsentGranted).toBe(false);
			expect(result.consentRevokedAt).toBeInstanceOf(Date);
			expect(result.version).toBe(2);
			expect(auditLogRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					action: "health_profile.consent_revoked",
				})
			);
		});
	});

	describe("getCamperProfile", () => {
		it("allows camper to view own health profile", async () => {
			const activeUser = buildUser();
			usersRepository.findOneBy.mockResolvedValue(activeUser);
			healthProfileRepository.findByUserId.mockResolvedValue(buildHealthProfile());

			// Mock Booking Query Builder return empty
			const mockQueryBuilder = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			};
			bookingRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

			const { profile } = await service.getCamperProfile(CAMPER_ID, CAMPER_ID);

			expect(profile.userId).toBe(CAMPER_ID);
		});

		it("allows Host to view camper's profile when booking relationship exists and consent is granted", async () => {
			const hostUser = buildUser({ id: CALLER_ID, role: UserRole.HOST });
			const camperProfile = buildHealthProfile({ isConsentGranted: true });
			usersRepository.findOneBy.mockResolvedValue(hostUser);
			healthProfileRepository.findByUserId.mockResolvedValue(camperProfile);

			// Mock booking relation matching
			const mockQueryBuilder = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue({
					trip: { title: "Mount Everest Expedition" },
				}),
			};
			bookingRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

			const { profile, activeTripTitle } = await service.getCamperProfile(CALLER_ID, CAMPER_ID);

			expect(profile.userId).toBe(CAMPER_ID);
			expect(activeTripTitle).toBe("Mount Everest Expedition");
		});

		it("denies access to Host when consent is revoked (isConsentGranted = false)", async () => {
			const hostUser = buildUser({ id: CALLER_ID, role: UserRole.HOST });
			const camperProfile = buildHealthProfile({ isConsentGranted: false });
			usersRepository.findOneBy.mockResolvedValue(hostUser);
			healthProfileRepository.findByUserId.mockResolvedValue(camperProfile);

			await expect(service.getCamperProfile(CALLER_ID, CAMPER_ID)).rejects.toBeInstanceOf(
				ForbiddenException
			);
		});

		it("denies access to Host when no booking relation exists", async () => {
			const hostUser = buildUser({ id: CALLER_ID, role: UserRole.HOST });
			const camperProfile = buildHealthProfile({ isConsentGranted: true });
			usersRepository.findOneBy.mockResolvedValue(hostUser);
			healthProfileRepository.findByUserId.mockResolvedValue(camperProfile);

			// Mock booking relation not matching
			const mockQueryBuilder = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			};
			bookingRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

			await expect(service.getCamperProfile(CALLER_ID, CAMPER_ID)).rejects.toBeInstanceOf(
				ForbiddenException
			);
		});

		it("denies access to unrelated camper", async () => {
			const otherCamper = buildUser({ id: CALLER_ID, role: UserRole.CAMPER });
			const camperProfile = buildHealthProfile({ isConsentGranted: true });
			usersRepository.findOneBy.mockResolvedValue(otherCamper);
			healthProfileRepository.findByUserId.mockResolvedValue(camperProfile);

			await expect(service.getCamperProfile(CALLER_ID, CAMPER_ID)).rejects.toBeInstanceOf(
				ForbiddenException
			);
		});
	});
});
