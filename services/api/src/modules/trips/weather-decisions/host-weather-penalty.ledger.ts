import type { EntityManager } from "typeorm";
import { minorToMoney, moneyToMinor } from "../../bookings/cancellation-policy";
import { WalletTransactionType } from "../../bookings/entities/wallet-transaction.entity";

/**
 * Money side of the weather penalty (policy §6): deducted from the Host wallet right after a
 * settlement credit, oldest first; what does not fit stays as the Host's debt for the next one.
 * Plain functions on the caller's transaction so the settlement and the deduction commit together.
 */

interface OutstandingPenaltyRow {
	id: string;
	trip_title: string;
	outstanding: string;
}

export interface PenaltyDeductionResult {
	balanceAfter: string;
	deductedTotal: string;
	deductions: Array<{ penaltyId: string; amount: string }>;
}

/**
 * Deducts outstanding applied penalties of `hostId` from the locked wallet whose balance is
 * `balance`. Writes one `penalty_debit` ledger row per penalty and returns the new balance; the
 * caller stores the balance on its wallet entity.
 */
export async function deductOutstandingWeatherPenalties(
	manager: EntityManager,
	input: { hostId: string; walletId: string; balance: string; tripId: string }
): Promise<PenaltyDeductionResult> {
	const rows = (await manager.query(
		`SELECT penalty."id", penalty."trip_title",
		        (penalty."amount" - penalty."deducted_amount")::text AS "outstanding"
		 FROM "host_weather_penalties" penalty
		 WHERE penalty."host_id" = $1 AND penalty."status" = 'applied'
		   AND penalty."amount" > penalty."deducted_amount"
		 ORDER BY penalty."created_at" ASC, penalty."id" ASC
		 FOR UPDATE`,
		[input.hostId]
	)) as OutstandingPenaltyRow[];

	let balanceMinor = moneyToMinor(input.balance);
	let deductedMinor = 0n;
	const deductions: PenaltyDeductionResult["deductions"] = [];
	for (const row of rows) {
		if (balanceMinor <= 0n) break;
		const outstandingMinor = moneyToMinor(row.outstanding);
		const takeMinor = outstandingMinor < balanceMinor ? outstandingMinor : balanceMinor;
		balanceMinor -= takeMinor;
		deductedMinor += takeMinor;
		const amount = minorToMoney(takeMinor);
		await manager.query(
			`UPDATE "host_weather_penalties"
			 SET "deducted_amount" = "deducted_amount" + $2::numeric, "updated_at" = now()
			 WHERE "id" = $1`,
			[row.id, amount]
		);
		await insertLedgerRow(manager, {
			walletId: input.walletId,
			tripId: input.tripId,
			type: WalletTransactionType.PENALTY_DEBIT,
			netAmount: `-${amount}`,
			balanceAfter: minorToMoney(balanceMinor),
			description: `Trừ phạt thời tiết: ${row.trip_title}`,
		});
		deductions.push({ penaltyId: row.id, amount });
	}
	if (deductedMinor > 0n) {
		await manager.query(
			`UPDATE "host_wallets" SET "balance" = $2::numeric, "updated_at" = now() WHERE "id" = $1`,
			[input.walletId, minorToMoney(balanceMinor)]
		);
	}
	return {
		balanceAfter: minorToMoney(balanceMinor),
		deductedTotal: minorToMoney(deductedMinor),
		deductions,
	};
}

/** Gives a waived penalty's deducted amount back to the Host wallet (policy §6 waiver). */
export async function refundWaivedWeatherPenalty(
	manager: EntityManager,
	input: { hostId: string; tripId: string; tripTitle: string; amount: string }
): Promise<string | null> {
	if (moneyToMinor(input.amount) <= 0n) return null;
	const wallets = (await manager.query(
		`SELECT "id", "balance"::text AS "balance" FROM "host_wallets" WHERE "host_id" = $1 FOR UPDATE`,
		[input.hostId]
	)) as Array<{ id: string; balance: string }>;
	const wallet = wallets[0];
	// A deduction always went through the wallet, so it exists whenever there is money to return.
	if (!wallet) throw new Error("Host wallet not found for a deducted weather penalty");
	const balanceAfter = minorToMoney(moneyToMinor(wallet.balance) + moneyToMinor(input.amount));
	await manager.query(
		`UPDATE "host_wallets" SET "balance" = $2::numeric, "updated_at" = now() WHERE "id" = $1`,
		[wallet.id, balanceAfter]
	);
	await insertLedgerRow(manager, {
		walletId: wallet.id,
		tripId: input.tripId,
		type: WalletTransactionType.PENALTY_REFUND,
		netAmount: input.amount,
		balanceAfter,
		description: `Hoàn phạt thời tiết đã miễn: ${input.tripTitle}`,
	});
	return balanceAfter;
}

async function insertLedgerRow(
	manager: EntityManager,
	row: {
		walletId: string;
		tripId: string;
		type: WalletTransactionType;
		netAmount: string;
		balanceAfter: string;
		description: string;
	}
): Promise<void> {
	await manager.query(
		`INSERT INTO "wallet_transactions"
		   ("wallet_id", "trip_id", "type", "base_amount", "fee_amount", "net_amount", "balance_after", "description")
		 VALUES ($1, $2, $3, 0, 0, $4::numeric, $5::numeric, $6)`,
		[
			row.walletId,
			row.tripId,
			row.type,
			row.netAmount,
			row.balanceAfter,
			row.description.slice(0, 255),
		]
	);
}
