import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import type { DataSource } from "typeorm";
import { User, UserRole, UserStatus } from "../../users/entities/user.entity";
import type { CreateBankAccountDto } from "../dto/create-bank-account.dto";
import { UserBankAccount } from "../entities/user-bank-account.entity";
import { UserBankAccountsService } from "./user-bank-accounts.service";

describe("UserBankAccountsService", () => {
	let service: UserBankAccountsService;
	let mockDataSource: {
		getRepository: jest.Mock;
		transaction: jest.Mock;
	};
	let mockEntityManager: {
		getRepository: jest.Mock;
	};
	let mockUsersRepo: {
		findOneBy: jest.Mock;
	};
	let mockBankAccountsRepo: {
		find: jest.Mock;
		findOne: jest.Mock;
		count: jest.Mock;
		create: jest.Mock;
		save: jest.Mock;
		update: jest.Mock;
		delete: jest.Mock;
	};

	const testUser: User = {
		id: "user-123",
		email: "user@example.com",
		phone: "0901234567",
		fullName: "Nguyễn Văn A",
		role: UserRole.CAMPER,
		status: UserStatus.ACTIVE,
		createdAt: new Date(),
		updatedAt: new Date(),
	} as User;

	beforeEach(() => {
		mockUsersRepo = {
			findOneBy: jest.fn(),
		};

		mockBankAccountsRepo = {
			find: jest.fn(),
			findOne: jest.fn(),
			count: jest.fn(),
			create: jest.fn((dto: unknown) => dto),
			save: jest.fn((entity: Record<string, unknown>) =>
				Promise.resolve({
					id: "bank-acc-1",
					createdAt: new Date(),
					updatedAt: new Date(),
					...entity,
				})
			),
			update: jest.fn().mockResolvedValue({ affected: 1 }),
			delete: jest.fn().mockResolvedValue({ affected: 1 }),
		};

		mockEntityManager = {
			getRepository: jest.fn((entityTarget: unknown) => {
				if (entityTarget === User) return mockUsersRepo;
				if (entityTarget === UserBankAccount) return mockBankAccountsRepo;
				throw new Error("Unknown repo");
			}),
		};

		mockDataSource = {
			getRepository: jest.fn((entityTarget: unknown) => {
				if (entityTarget === UserBankAccount) return mockBankAccountsRepo;
				throw new Error("Unknown repo");
			}),
			transaction: jest.fn((cb: (manager: unknown) => Promise<unknown>) => cb(mockEntityManager)),
		};

		service = new UserBankAccountsService(mockDataSource as unknown as DataSource);
	});

	describe("getBankAccounts", () => {
		it("should return bank accounts ordered by isDefault DESC, createdAt ASC", async () => {
			const accounts = [
				{
					id: "acc-1",
					userId: "user-123",
					bankName: "Vietcombank",
					accountNumber: "123456",
					accountHolderName: "NGUYEN VAN A",
					isDefault: true,
					createdAt: new Date("2026-01-01"),
					updatedAt: new Date("2026-01-01"),
				},
				{
					id: "acc-2",
					userId: "user-123",
					bankName: "Techcombank",
					accountNumber: "654321",
					accountHolderName: "NGUYEN VAN A",
					isDefault: false,
					createdAt: new Date("2026-01-02"),
					updatedAt: new Date("2026-01-02"),
				},
			];

			mockBankAccountsRepo.find.mockResolvedValue(accounts);

			const result = await service.getBankAccounts("user-123");
			expect(result).toHaveLength(2);
			expect(result[0].isDefault).toBe(true);
			expect(result[0].bankName).toBe("Vietcombank");
		});
	});

	describe("addBankAccount (BR-350 & BR-351)", () => {
		const validDto: CreateBankAccountDto = {
			bankName: "MBBank",
			accountNumber: "99998888",
			accountHolderName: "NGUYEN VAN A",
			isDefault: false,
		};

		it("should reject when user has no registered fullName", async () => {
			mockUsersRepo.findOneBy.mockResolvedValue({
				...testUser,
				fullName: "",
			});

			await expect(service.addBankAccount("user-123", validDto)).rejects.toThrow(
				BadRequestException
			);
		});

		it("should reject when accountHolderName does not match registered fullName (BR-351)", async () => {
			mockUsersRepo.findOneBy.mockResolvedValue(testUser);

			const invalidDto: CreateBankAccountDto = {
				...validDto,
				accountHolderName: "TRAN VAN B",
			};

			await expect(service.addBankAccount("user-123", invalidDto)).rejects.toThrow(
				BadRequestException
			);
		});

		it("should automatically set isDefault = true when adding the first account (BR-350)", async () => {
			mockUsersRepo.findOneBy.mockResolvedValue(testUser);
			mockBankAccountsRepo.findOne.mockResolvedValue(null);
			mockBankAccountsRepo.count.mockResolvedValue(0);

			const result = await service.addBankAccount("user-123", validDto);

			expect(result.isDefault).toBe(true);
			expect(result.accountHolderName).toBe("NGUYEN VAN A");
		});

		it("should reject duplicate bank account with 409 Conflict", async () => {
			mockUsersRepo.findOneBy.mockResolvedValue(testUser);
			mockBankAccountsRepo.findOne.mockResolvedValue({
				id: "existing-acc",
				userId: "user-123",
				bankName: "MBBank",
				accountNumber: "99998888",
			});

			await expect(service.addBankAccount("user-123", validDto)).rejects.toThrow(ConflictException);
		});

		it("should unset other default accounts if new account is marked as default", async () => {
			mockUsersRepo.findOneBy.mockResolvedValue(testUser);
			mockBankAccountsRepo.findOne.mockResolvedValue(null);
			mockBankAccountsRepo.count.mockResolvedValue(2);

			const newDefaultDto: CreateBankAccountDto = {
				...validDto,
				isDefault: true,
			};

			const result = await service.addBankAccount("user-123", newDefaultDto);

			expect(mockBankAccountsRepo.update).toHaveBeenCalledWith(
				{ userId: "user-123" },
				{ isDefault: false }
			);
			expect(result.isDefault).toBe(true);
		});
	});

	describe("deleteBankAccount (BR-350)", () => {
		it("should promote next oldest account to default when default account is deleted", async () => {
			const defaultAccount = {
				id: "acc-default",
				userId: "user-123",
				isDefault: true,
			};

			const nextOldestAccount = {
				id: "acc-second",
				userId: "user-123",
				isDefault: false,
			};

			mockBankAccountsRepo.findOne
				.mockResolvedValueOnce(defaultAccount)
				.mockResolvedValueOnce(nextOldestAccount);

			const result = await service.deleteBankAccount("user-123", "acc-default");

			expect(mockBankAccountsRepo.delete).toHaveBeenCalledWith({ id: "acc-default" });
			expect(mockBankAccountsRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({ id: "acc-second", isDefault: true })
			);
			expect(result.success).toBe(true);
		});

		it("should throw NotFoundException if account does not exist", async () => {
			mockBankAccountsRepo.findOne.mockResolvedValue(null);

			await expect(service.deleteBankAccount("user-123", "non-existent")).rejects.toThrow(
				NotFoundException
			);
		});
	});

	describe("setDefaultBankAccount", () => {
		it("should unset other defaults and set target account as default", async () => {
			const targetAccount = {
				id: "acc-target",
				userId: "user-123",
				isDefault: false,
			};

			mockBankAccountsRepo.findOne.mockResolvedValue(targetAccount);

			const result = await service.setDefaultBankAccount("user-123", "acc-target");

			expect(mockBankAccountsRepo.update).toHaveBeenCalledWith(
				{ userId: "user-123" },
				{ isDefault: false }
			);
			expect(result.isDefault).toBe(true);
		});
	});
});
