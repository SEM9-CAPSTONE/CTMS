import type {
	PlatformBankAccountDto,
	PlatformBankAccountPurpose,
	PlatformPaymentAccountDto,
} from "./platform-bank-account.dto";

interface Queryable {
	query(sql: string, parameters?: unknown[]): Promise<unknown>;
}

interface PlatformBankAccountRow {
	purpose: PlatformBankAccountPurpose;
	bank_name: string;
	account_number: string;
	account_holder_name: string;
	updated_at: Date | string;
	updated_by_name: string | null;
}

/** The platform account for `purpose`, or null while no Admin has set it. */
export async function readPlatformBankAccount(
	db: Queryable,
	purpose: PlatformBankAccountPurpose
): Promise<PlatformBankAccountDto | null> {
	const rows = (await db.query(
		`SELECT account."purpose", account."bank_name", account."account_number",
		        account."account_holder_name", account."updated_at", admin."full_name" AS "updated_by_name"
		 FROM "platform_bank_accounts" account
		 LEFT JOIN "users" admin ON admin."id" = account."updated_by"
		 WHERE account."purpose" = $1`,
		[purpose]
	)) as PlatformBankAccountRow[];
	const row = rows[0];
	if (!row) return null;
	return {
		purpose: row.purpose,
		bankName: row.bank_name,
		accountNumber: row.account_number,
		accountHolderName: row.account_holder_name,
		updatedAt: new Date(row.updated_at).toISOString(),
		updatedByName: row.updated_by_name,
	};
}

/** The transfer details only, for the payer (no Admin name or history). */
export function toPaymentAccount(
	account: PlatformBankAccountDto | null
): PlatformPaymentAccountDto | null {
	if (!account) return null;
	return {
		bankName: account.bankName,
		accountNumber: account.accountNumber,
		accountHolderName: account.accountHolderName,
	};
}
