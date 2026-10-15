import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { DataSource, type EntityManager } from "typeorm";
import { User, UserStatus } from "../../users/entities/user.entity";
import {
	type BankAccountResponseDto,
	toBankAccountResponse,
} from "../dto/bank-account-response.dto";
import type { CreateBankAccountDto } from "../dto/create-bank-account.dto";
import { UserBankAccount } from "../entities/user-bank-account.entity";
import { validateAccountHolderNameMatch } from "../utils/vietnamese-name.util";

@Injectable()
export class UserBankAccountsService {
	constructor(private readonly dataSource: DataSource) {}

	async getBankAccounts(userId: string): Promise<BankAccountResponseDto[]> {
		const repo = this.dataSource.getRepository(UserBankAccount);
		const accounts = await repo.find({
			where: { userId },
			order: { isDefault: "DESC", createdAt: "ASC" },
		});
		return accounts.map(toBankAccountResponse);
	}

	async addBankAccount(userId: string, dto: CreateBankAccountDto): Promise<BankAccountResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const usersRepo = manager.getRepository(User);
			const bankAccountsRepo = manager.getRepository(UserBankAccount);

			const user = await usersRepo.findOneBy({ id: userId });
			if (!user) {
				throw new NotFoundException("Người dùng không tồn tại");
			}
			if (user.status !== UserStatus.ACTIVE) {
				throw new ForbiddenException("Tài khoản chưa được kích hoạt");
			}

			// Precondition: user profile must have registered fullName
			if (!user.fullName || !user.fullName.trim()) {
				throw new BadRequestException(
					"Vui lòng cập nhật họ và tên trong hồ sơ trước khi thêm tài khoản ngân hàng"
				);
			}

			// BR-351: Strict Account Holder Name Matching
			const isNameMatch = validateAccountHolderNameMatch(user.fullName, dto.accountHolderName);
			if (!isNameMatch) {
				throw new BadRequestException(
					`Tên chủ tài khoản không khớp với họ tên đăng ký (${user.fullName}). Vui lòng nhập đúng tên đăng ký.`
				);
			}

			const cleanBankName = dto.bankName.trim();
			const cleanAccountNumber = dto.accountNumber.trim();
			const cleanAccountHolderName = dto.accountHolderName.trim().toUpperCase();

			// Check duplicate account
			const existing = await bankAccountsRepo.findOne({
				where: {
					userId,
					bankName: cleanBankName,
					accountNumber: cleanAccountNumber,
				},
			});
			if (existing) {
				throw new ConflictException("Tài khoản ngân hàng này đã được liên kết trên hệ thống");
			}

			// BR-350: Check if this is the first bank account -> automatically becomes default
			const existingCount = await bankAccountsRepo.count({ where: { userId } });
			const shouldBeDefault = existingCount === 0 || Boolean(dto.isDefault);

			if (shouldBeDefault && existingCount > 0) {
				await bankAccountsRepo.update({ userId }, { isDefault: false });
			}

			const newAccount = bankAccountsRepo.create({
				userId,
				bankName: cleanBankName,
				accountNumber: cleanAccountNumber,
				accountHolderName: cleanAccountHolderName,
				isDefault: shouldBeDefault,
			});

			const saved = await bankAccountsRepo.save(newAccount);
			return toBankAccountResponse(saved);
		});
	}

	async deleteBankAccount(userId: string, id: string): Promise<{ success: boolean }> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const bankAccountsRepo = manager.getRepository(UserBankAccount);
			const account = await bankAccountsRepo.findOne({
				where: { id, userId },
			});
			if (!account) {
				throw new NotFoundException("Không tìm thấy tài khoản ngân hàng");
			}

			const wasDefault = account.isDefault;
			await bankAccountsRepo.delete({ id: account.id });

			// BR-350: If default account is deleted, promote the oldest remaining account to default
			if (wasDefault) {
				const nextAccount = await bankAccountsRepo.findOne({
					where: { userId },
					order: { createdAt: "ASC" },
				});
				if (nextAccount) {
					nextAccount.isDefault = true;
					await bankAccountsRepo.save(nextAccount);
				}
			}

			return { success: true };
		});
	}

	async setDefaultBankAccount(userId: string, id: string): Promise<BankAccountResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const bankAccountsRepo = manager.getRepository(UserBankAccount);
			const account = await bankAccountsRepo.findOne({
				where: { id, userId },
			});
			if (!account) {
				throw new NotFoundException("Không tìm thấy tài khoản ngân hàng");
			}

			// Unset all other default accounts
			await bankAccountsRepo.update({ userId }, { isDefault: false });

			// Set target account as default
			account.isDefault = true;
			const updated = await bankAccountsRepo.save(account);

			return toBankAccountResponse(updated);
		});
	}
}
