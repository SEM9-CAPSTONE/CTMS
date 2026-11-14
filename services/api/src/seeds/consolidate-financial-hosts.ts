import type { EntityManager } from "typeorm";
import { minorToMoney, moneyToMinor } from "../modules/bookings/cancellation-policy";
import { WalletTransactionType } from "../modules/bookings/entities/wallet-transaction.entity";

interface WalletRow {
	id: string;
	balance: string;
}
interface LegacyHost {
	id: string;
	fullName: string;
}

/** Retire only the four accounts created by the former financial fixture seed. */
export async function consolidateFinancialHosts(
	manager: EntityManager,
	hostId: string,
	adminId: string,
	fixtureId: (group: number, index: number) => string
): Promise<string> {
	await manager.query(
		"INSERT INTO host_wallets (host_id, balance) VALUES ($1, '0.00') ON CONFLICT (host_id) DO NOTHING",
		[hostId]
	);
	const wallets: WalletRow[] = await manager.query(
		"SELECT id, balance FROM host_wallets WHERE host_id = $1 FOR UPDATE",
		[hostId]
	);
	const wallet = wallets[0];
	let balanceMinor = moneyToMinor(wallet.balance);
	for (let index = 1; index <= 4; index++) {
		const hosts: LegacyHost[] = await manager.query(
			`SELECT id, full_name AS "fullName" FROM users
			 WHERE id = $1 AND email = $2 AND status <> 'deleted' FOR UPDATE`,
			[fixtureId(1, index), `host.adjustment.${index}@ctms.local`]
		);
		const legacy = hosts[0];
		if (!legacy) continue;
		const oldWallets: WalletRow[] = await manager.query(
			"SELECT id, balance FROM host_wallets WHERE host_id = $1 FOR UPDATE",
			[legacy.id]
		);
		const oldWallet = oldWallets[0];
		const transferredMinor = oldWallet ? moneyToMinor(oldWallet.balance) : 0n;
		const previousBalance = minorToMoney(balanceMinor);
		if (oldWallet && transferredMinor > 0n) {
			balanceMinor += transferredMinor;
			await manager.query(
				"UPDATE host_wallets SET balance = '0.00', updated_at = now() WHERE id = $1",
				[oldWallet.id]
			);
			await manager.query(
				`INSERT INTO wallet_transactions (id, wallet_id, type, net_amount, balance_after, description, created_at)
				 VALUES ($1, $2, $3, $4, '0.00', 'Chuyển số dư về ví chính', clock_timestamp()),
				 ($5, $6, $7, $8, $9, 'Tiếp nhận số dư vào ví chính', clock_timestamp())`,
				[
					fixtureId(8, 1000 + index),
					oldWallet.id,
					WalletTransactionType.WALLET_TRANSFER_DEBIT,
					minorToMoney(-transferredMinor),
					fixtureId(8, 2000 + index),
					wallet.id,
					WalletTransactionType.WALLET_TRANSFER_CREDIT,
					minorToMoney(transferredMinor),
					minorToMoney(balanceMinor),
				]
			);
		}
		// Keep original ledger entries, bank references and audit snapshots in place.
		for (const table of [
			"trekking_routes",
			"trips",
			"settlements",
			"financial_adjustments",
			"payouts",
		]) {
			await manager.query(`UPDATE "${table}" SET host_id = $1 WHERE host_id = $2`, [
				hostId,
				legacy.id,
			]);
		}
		await manager.query(
			"UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now()) WHERE user_id = $1",
			[legacy.id]
		);
		await manager.query("UPDATE users SET status = 'deleted', updated_at = now() WHERE id = $1", [
			legacy.id,
		]);
		await manager.query(
			`INSERT INTO audit_logs (actor_id, action, target_type, target_id, before, after, reason)
			 VALUES ($1, 'financial.host_account_consolidated', 'host_wallet', $2, $3::jsonb, $4::jsonb,
			 'Chuyển số dư và dữ liệu người tổ chức về tài khoản chính.')`,
			[
				adminId,
				wallet.id,
				JSON.stringify({
					sourceHostId: legacy.id,
					sourceHostName: legacy.fullName,
					walletBalance: previousBalance,
				}),
				JSON.stringify({
					hostId,
					transferredAmount: minorToMoney(transferredMinor),
					walletBalance: minorToMoney(balanceMinor),
				}),
			]
		);
	}
	if (minorToMoney(balanceMinor) !== wallet.balance) {
		await manager.query("UPDATE host_wallets SET balance = $1, updated_at = now() WHERE id = $2", [
			minorToMoney(balanceMinor),
			wallet.id,
		]);
	}
	return wallet.id;
}
