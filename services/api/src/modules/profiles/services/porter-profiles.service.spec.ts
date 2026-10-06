import type { DataSource, EntityManager } from "typeorm";
import { UserRole, UserStatus } from "../../users/entities/user.entity";
import type { UsersRepository } from "../../users/users.repository";
import { PorterAvailabilityStatus, type PorterProfile } from "../entities/porter-profile.entity";
import type { PorterProfilesRepository } from "../repositories/porter-profiles.repository";
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
			{} as DataSource
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
			dataSource as unknown as DataSource
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
});
