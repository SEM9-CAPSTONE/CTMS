import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import type {
	PlatformBankAccountDto,
	PlatformBankAccountPurpose,
	UpsertPlatformBankAccountDto,
} from "./platform-bank-account.dto";
import { readPlatformBankAccount } from "./platform-bank-account.reader";

/** Admin-managed accounts the platform receives money on (policy §6: weather penalties). */
@Injectable()
export class PlatformBankAccountsService {
	constructor(private readonly dataSource: DataSource) {}

	get(purpose: PlatformBankAccountPurpose): Promise<PlatformBankAccountDto | null> {
		return readPlatformBankAccount(this.dataSource, purpose);
	}

	/** Creates or replaces the account for `purpose`; the old and new values are audited. */
	async upsert(
		adminId: string,
		purpose: PlatformBankAccountPurpose,
		dto: UpsertPlatformBankAccountDto
	): Promise<PlatformBankAccountDto> {
		return this.dataSource.transaction(async (manager) => {
			const before = await readPlatformBankAccount(manager, purpose);
			const saved = (await manager.query(
				`INSERT INTO "platform_bank_accounts"
				   ("purpose", "bank_name", "account_number", "account_holder_name", "updated_by")
				 VALUES ($1, $2, $3, $4, $5)
				 ON CONFLICT ("purpose") DO UPDATE SET
				   "bank_name" = EXCLUDED."bank_name", "account_number" = EXCLUDED."account_number",
				   "account_holder_name" = EXCLUDED."account_holder_name",
				   "updated_by" = EXCLUDED."updated_by", "updated_at" = now()
				 RETURNING "id"`,
				[purpose, dto.bankName, dto.accountNumber, dto.accountHolderName, adminId]
			)) as Array<{ id: string }>;
			const after = (await readPlatformBankAccount(manager, purpose)) as PlatformBankAccountDto;
			const snapshot = (account: PlatformBankAccountDto | null) =>
				account && {
					bankName: account.bankName,
					accountNumber: account.accountNumber,
					accountHolderName: account.accountHolderName,
				};
			await manager.getRepository(AuditLog).save({
				actorId: adminId,
				action: "platform.bank_account_updated",
				targetType: "platform_bank_account",
				targetId: saved[0].id,
				before: snapshot(before),
				after: { purpose, ...snapshot(after) },
				reason: `Platform bank account for ${purpose}`,
			});
			return after;
		});
	}
}
