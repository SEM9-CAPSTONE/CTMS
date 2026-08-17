import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { DataSource, EntityManager } from "typeorm";
import { UserGender, UserRole, UserStatus } from "../../users/entities/user.entity";
import type { User } from "../../users/entities/user.entity";
import type { UsersRepository } from "../../users/users.repository";
import type { UpdateProfileDto } from "../dto/update-profile.dto";
import type { EmergencyContact } from "../entities/emergency-contact.entity";
import type { EmergencyContactsRepository } from "../repositories/emergency-contacts.repository";
import { ProfilesService } from "./profiles.service";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const FIXED_DATE = new Date("2026-08-08T00:00:00.000Z");

type MockUsersRepository = {
	findOneBy: jest.Mock;
	findOneByOrFail: jest.Mock;
	update: jest.Mock;
};

type MockContactsRepository = {
	findByUserId: jest.Mock;
	delete: jest.Mock;
	save: jest.Mock;
	create: jest.Mock;
};

function buildUser(overrides: Partial<User> = {}): User {
	return {
		id: USER_ID,
		email: "camper@example.com",
		phone: "+84912345678",
		passwordHash: "hashed",
		role: UserRole.CAMPER,
		status: UserStatus.ACTIVE,
		fullName: null,
		dateOfBirth: null,
		gender: null,
		address: null,
		bio: null,
		createdAt: FIXED_DATE,
		updatedAt: FIXED_DATE,
		...overrides,
	};
}

function buildContact(overrides: Partial<EmergencyContact> = {}): EmergencyContact {
	return {
		id: "22222222-2222-2222-2222-222222222222",
		userId: USER_ID,
		user: buildUser(),
		name: "Nguyen Van A",
		relationship: "father",
		phone: "+84987654321",
		email: null,
		createdAt: FIXED_DATE,
		updatedAt: FIXED_DATE,
		...overrides,
	};
}

describe("ProfilesService", () => {
	let service: ProfilesService;
	let usersRepository: MockUsersRepository;
	let transactionalUsersRepository: MockUsersRepository;
	let contactsRepository: MockContactsRepository;
	let transactionalContactsRepository: MockContactsRepository;
	let auditLogRepository: { save: jest.Mock };
	let manager: { withRepository: jest.Mock; getRepository: jest.Mock };
	let dataSource: { transaction: jest.Mock };

	beforeEach(() => {
		usersRepository = {
			findOneBy: jest.fn(),
			findOneByOrFail: jest.fn(),
			update: jest.fn(),
		};
		transactionalUsersRepository = {
			findOneBy: jest.fn(),
			findOneByOrFail: jest.fn(),
			update: jest.fn(),
		};
		contactsRepository = {
			findByUserId: jest.fn(),
			delete: jest.fn(),
			save: jest.fn(),
			create: jest.fn((input) => input),
		};
		transactionalContactsRepository = {
			findByUserId: jest.fn(),
			delete: jest.fn(),
			save: jest.fn(),
			create: jest.fn((input) => input),
		};
		auditLogRepository = { save: jest.fn() };
		manager = {
			withRepository: jest.fn((repository) => {
				if (repository === usersRepository) {
					return transactionalUsersRepository;
				}
				return transactionalContactsRepository;
			}),
			getRepository: jest.fn().mockReturnValue(auditLogRepository),
		};
		dataSource = {
			transaction: jest.fn(async (callback: (manager: EntityManager) => unknown) =>
				callback(manager as unknown as EntityManager)
			),
		};

		service = new ProfilesService(
			usersRepository as unknown as UsersRepository,
			contactsRepository as unknown as EmergencyContactsRepository,
			dataSource as unknown as DataSource
		);
	});

	describe("getMyProfile", () => {
		it("returns only the authenticated user's mapped profile fields", async () => {
			const user = buildUser({ fullName: "Nguyen Van B" });
			usersRepository.findOneBy.mockResolvedValue(user);
			contactsRepository.findByUserId.mockResolvedValue([buildContact()]);

			const result = await service.getMyProfile(USER_ID);

			expect(usersRepository.findOneBy).toHaveBeenCalledWith({ id: USER_ID });
			expect(result).toMatchObject({
				id: USER_ID,
				fullName: "Nguyen Van B",
				emergencyContacts: [{ name: "Nguyen Van A", phone: "+84987654321" }],
			});
			expect(Object.hasOwn(result, "passwordHash")).toBe(false);
		});

		it.each([UserStatus.PENDING_VERIFICATION, UserStatus.SUSPENDED, UserStatus.DELETED])(
			"throws ForbiddenException when account status is %s",
			async (status) => {
				usersRepository.findOneBy.mockResolvedValue(buildUser({ status }));

				await expect(service.getMyProfile(USER_ID)).rejects.toBeInstanceOf(ForbiddenException);

				expect(contactsRepository.findByUserId).not.toHaveBeenCalled();
			}
		);

		it("throws NotFoundException when the authenticated user no longer exists", async () => {
			usersRepository.findOneBy.mockResolvedValue(null);

			await expect(service.getMyProfile(USER_ID)).rejects.toBeInstanceOf(NotFoundException);
		});
	});

	describe("updateMyProfile", () => {
		it("updates profile fields and replaces emergency contacts in one transaction", async () => {
			const existingUser = buildUser();
			const updatedUser = buildUser({
				fullName: "Nguyen Van B",
				dateOfBirth: "1995-04-12",
				gender: UserGender.MALE,
				address: "Da Lat, Lam Dong",
				bio: "Weekend trekker",
			});
			const savedContacts = [
				buildContact({ name: "Tran Thi C", relationship: "mother", email: "mom@example.com" }),
			];
			transactionalUsersRepository.findOneBy.mockResolvedValue(existingUser);
			transactionalUsersRepository.findOneByOrFail.mockResolvedValue(updatedUser);
			transactionalContactsRepository.findByUserId.mockResolvedValue([]);
			transactionalContactsRepository.save.mockResolvedValue(savedContacts);

			const dto: UpdateProfileDto = {
				fullName: "Nguyen Van B",
				dateOfBirth: "1995-04-12",
				gender: UserGender.MALE,
				address: "Da Lat, Lam Dong",
				bio: "Weekend trekker",
				emergencyContacts: [
					{
						name: "Tran Thi C",
						relationship: "mother",
						phone: "+84911111111",
						email: "mom@example.com",
					},
				],
			};

			const result = await service.updateMyProfile(USER_ID, dto);

			expect(dataSource.transaction).toHaveBeenCalledTimes(1);
			expect(transactionalUsersRepository.update).toHaveBeenCalledWith(
				USER_ID,
				expect.objectContaining({ fullName: "Nguyen Van B", gender: UserGender.MALE })
			);
			expect(transactionalContactsRepository.delete).toHaveBeenCalledWith({ userId: USER_ID });
			expect(transactionalContactsRepository.save).toHaveBeenCalledWith([
				expect.objectContaining({ userId: USER_ID, name: "Tran Thi C" }),
			]);
			expect(auditLogRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					actorId: USER_ID,
					action: "profile.updated",
					targetType: "user",
					targetId: USER_ID,
				})
			);
			expect(result.emergencyContacts).toHaveLength(1);
		});

		it("does not write an audit log when the submitted state is unchanged", async () => {
			const user = buildUser({ fullName: "Nguyen Van B" });
			const contacts = [buildContact()];
			transactionalUsersRepository.findOneBy.mockResolvedValue(user);
			transactionalUsersRepository.findOneByOrFail.mockResolvedValue(user);
			transactionalContactsRepository.findByUserId.mockResolvedValue(contacts);

			await service.updateMyProfile(USER_ID, { fullName: "Nguyen Van B" });

			expect(auditLogRepository.save).not.toHaveBeenCalled();
		});

		it("rejects non-active accounts before profile side effects", async () => {
			transactionalUsersRepository.findOneBy.mockResolvedValue(
				buildUser({ status: UserStatus.SUSPENDED })
			);

			await expect(
				service.updateMyProfile(USER_ID, { fullName: "Nguyen Van B" })
			).rejects.toBeInstanceOf(ForbiddenException);

			expect(transactionalUsersRepository.update).not.toHaveBeenCalled();
			expect(transactionalContactsRepository.delete).not.toHaveBeenCalled();
			expect(auditLogRepository.save).not.toHaveBeenCalled();
		});

		it("rejects a future date of birth before opening a transaction", async () => {
			await expect(
				service.updateMyProfile(USER_ID, { dateOfBirth: "2999-01-01" })
			).rejects.toBeInstanceOf(ForbiddenException);

			expect(dataSource.transaction).not.toHaveBeenCalled();
		});
	});
});
