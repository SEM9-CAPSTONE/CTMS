import type { DataSource, EntityManager } from "typeorm";
import { UserRole, UserStatus } from "../../users/entities/user.entity";
import type { UsersRepository } from "../../users/users.repository";
import { PorterAvailabilityStatus, type PorterProfile } from "../entities/porter-profile.entity";
import type { PorterProfilesRepository } from "../repositories/porter-profiles.repository";
import type { PorterVerificationsRepository } from "../repositories/porter-verifications.repository";
import { PorterProfilesService } from "./porter-profiles.service";

const PORTER_ID = "11111111-1111-1111-1111-111111111111";
const FIXED_DATE = new Date("2026-10-06T00:00:00.000Z");

function profile(overrides: Partial<PorterProfile> = {}): PorterProfile {
	return {
		porterId: PORTER_ID,
		experienceYears: 2,
		certifications: ["First Aid"],
		languages: ["Vietnamese"],
		availabilityStatus: PorterAvailabilityStatus.AVAILABLE,
		ratingAvg: 0,
		completedTrips: 0,
		version: 1,
		createdAt: FIXED_DATE,
		updatedAt: FIXED_DATE,
		...overrides,
	} as PorterProfile;
}

describe("PorterProfilesService", () => {
	it("returns a version-zero default without persisting on GET", async () => {
		const profilesRepository = {
			findByPorterId: jest.fn().mockResolvedValue(null),
		};
		const usersRepository = {
			findOneWithRolesById: jest.fn().mockResolvedValue({
				id: PORTER_ID,
				status: UserStatus.ACTIVE,
				role: UserRole.PORTER,
				roleAssignments: [{ role: UserRole.PORTER }],
			}),
			getGrantedRoles: jest.fn().mockReturnValue([UserRole.PORTER]),
		};
		const service = new PorterProfilesService(
			profilesRepository as unknown as PorterProfilesRepository,
			usersRepository as unknown as UsersRepository,
			{} as DataSource,
			{} as PorterVerificationsRepository
		);

		const result = await service.getMyProfile(PORTER_ID);

		expect(result).toMatchObject({ porterId: PORTER_ID, version: 0 });
		expect(profilesRepository).not.toHaveProperty("save");
	});

	it("does not save, increment, or audit a normalized no-op", async () => {
		const existing = profile();
		const transactionalProfiles = {
			findByPorterIdForUpdate: jest.fn().mockResolvedValue(existing),
			save: jest.fn(),
		};
		const transactionalUsers = {
			findOneWithRolesByIdForUpdate: jest.fn().mockResolvedValue({
				id: PORTER_ID,
				status: UserStatus.ACTIVE,
				role: UserRole.PORTER,
				roleAssignments: [{ role: UserRole.PORTER }],
			}),
			getGrantedRoles: jest.fn().mockReturnValue([UserRole.PORTER]),
		};
		const audit = { save: jest.fn() };
		const profilesRepository = {} as PorterProfilesRepository;
		const usersRepository = {} as UsersRepository;
		const manager = {
			withRepository: jest.fn((repository) =>
				repository === profilesRepository ? transactionalProfiles : transactionalUsers
			),
			getRepository: jest.fn().mockReturnValue(audit),
		};
		const dataSource = {
			transaction: jest.fn((callback: (entityManager: EntityManager) => unknown) =>
				callback(manager as unknown as EntityManager)
			),
		};
		const service = new PorterProfilesService(
			profilesRepository,
			usersRepository,
			dataSource as unknown as DataSource,
			{} as PorterVerificationsRepository
		);

		const result = await service.updateMyProfile(PORTER_ID, {
			certifications: [" First Aid ", "first aid"],
			expectedVersion: 1,
		});

		expect(result.version).toBe(1);
		expect(result.updatedAt).toBe(FIXED_DATE);
		expect(transactionalProfiles.save).not.toHaveBeenCalled();
		expect(audit.save).not.toHaveBeenCalled();
	});

	describe("availability requires approved guide certificate verification", () => {
		function setup(approved: boolean) {
			const existing = profile({ availabilityStatus: PorterAvailabilityStatus.UNAVAILABLE });
			const transactionalProfiles = {
				findByPorterIdForUpdate: jest.fn().mockResolvedValue(existing),
				save: jest.fn(async (value: PorterProfile) => value),
			};
			const transactionalUsers = {
				findOneWithRolesByIdForUpdate: jest.fn().mockResolvedValue({
					id: PORTER_ID,
					status: UserStatus.ACTIVE,
					role: UserRole.PORTER,
					roleAssignments: [{ role: UserRole.PORTER }],
				}),
				getGrantedRoles: jest.fn().mockReturnValue([UserRole.PORTER]),
			};
			const transactionalVerifications = { isApproved: jest.fn().mockResolvedValue(approved) };
			const profilesRepository = {} as PorterProfilesRepository;
			const usersRepository = {} as UsersRepository;
			const verificationsRepository = {} as PorterVerificationsRepository;
			const audit = { save: jest.fn() };
			const manager = {
				withRepository: jest.fn((repository) => {
					if (repository === profilesRepository) return transactionalProfiles;
					if (repository === verificationsRepository) return transactionalVerifications;
					return transactionalUsers;
				}),
				getRepository: jest.fn().mockReturnValue(audit),
			};
			const dataSource = {
				transaction: jest.fn((callback: (entityManager: EntityManager) => unknown) =>
					callback(manager as unknown as EntityManager)
				),
			};
			const service = new PorterProfilesService(
				profilesRepository,
				usersRepository,
				dataSource as unknown as DataSource,
				verificationsRepository
			);
			return { service, transactionalProfiles, transactionalVerifications };
		}

		it("rejects switching to available while verification is not approved", async () => {
			const { service, transactionalProfiles } = setup(false);

			await expect(
				service.updateMyProfile(PORTER_ID, {
					availabilityStatus: PorterAvailabilityStatus.AVAILABLE,
					expectedVersion: 1,
				})
			).rejects.toMatchObject({ status: 403 });
			expect(transactionalProfiles.save).not.toHaveBeenCalled();
		});

		it("allows switching to available once verification is approved", async () => {
			const { service, transactionalProfiles } = setup(true);

			const result = await service.updateMyProfile(PORTER_ID, {
				availabilityStatus: PorterAvailabilityStatus.AVAILABLE,
				expectedVersion: 1,
			});

			expect(result.availabilityStatus).toBe(PorterAvailabilityStatus.AVAILABLE);
			expect(transactionalProfiles.save).toHaveBeenCalled();
		});

		it("does not check verification for other profile edits", async () => {
			const { service, transactionalVerifications } = setup(false);

			await service.updateMyProfile(PORTER_ID, { experienceYears: 5, expectedVersion: 1 });

			expect(transactionalVerifications.isApproved).not.toHaveBeenCalled();
		});
	});
});
