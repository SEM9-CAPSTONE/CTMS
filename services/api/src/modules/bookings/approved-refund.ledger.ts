import { createHash } from "node:crypto";
import { type EntityManager, MoreThanOrEqual } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import type { Booking } from "../profiles/entities/booking.entity";
import { minorToMoney, moneyToMinor } from "./cancellation-policy";
import {
	FinancialAdjustment,
	FinancialAdjustmentStatus,
	FinancialAdjustmentType,
} from "./entities/financial-adjustment.entity";
import { HostWallet } from "./entities/host-wallet.entity";
import type { Payment } from "./entities/payment.entity";
import { Payout, PayoutStatus } from "./entities/payout.entity";
import { Settlement } from "./entities/settlement.entity";
import { WalletTransaction, WalletTransactionType } from "./entities/wallet-transaction.entity";

/** Runs inside the approval transaction, under the Trip/Booking/refund locks. */
export async function recordApprovedRefundAdjustment(
	manager: EntityManager,
	refund: Payment,
	booking: Booking,
	actorId: string,
	reason: string
): Promise<FinancialAdjustment | null> {
	const settlement = await manager
		.getRepository(Settlement)
		.findOne({ where: { tripId: booking.tripId } });
	if (!settlement) return null;
	const adjustments = manager.getRepository(FinancialAdjustment);
	const existing = await adjustments.findOne({ where: { refundPaymentId: refund.id } });
	if (existing) return existing;
	const wallets = manager.getRepository(HostWallet);
	let wallet = await wallets.findOne({
		where: { hostId: settlement.hostId },
		lock: { mode: "pessimistic_write" },
	});
	if (!wallet)
		wallet = await wallets.save(wallets.create({ hostId: settlement.hostId, balance: "0.00" }));
	const ledger = manager.getRepository(WalletTransaction);
	const credit = await ledger.findOne({
		where: { settlementId: settlement.id, type: WalletTransactionType.SETTLEMENT_CREDIT },
	});
	// A payout from another former wallet must not be attributed to this settlement.
	const walletIds = [
		...new Set([wallet.id, credit?.walletId].filter((id): id is string => Boolean(id))),
	];
	const payout = await manager.getRepository(Payout).findOne({
		where: walletIds.map((walletId) => ({
			hostId: settlement.hostId,
			walletId,
			status: PayoutStatus.SUCCEEDED,
			createdAt: MoreThanOrEqual(settlement.settledAt),
		})),
		order: { createdAt: "ASC" },
	});
	const amountMinor = moneyToMinor(refund.amount);
	const canDebit = !payout && moneyToMinor(wallet.balance) >= amountMinor;
	if (canDebit) {
		wallet.balance = minorToMoney(moneyToMinor(wallet.balance) - amountMinor);
		await wallets.save(wallet);
	}
	const adjustment = await adjustments.save(
		adjustments.create({
			refundPaymentId: refund.id,
			bookingId: booking.id,
			tripId: booking.tripId,
			hostId: settlement.hostId,
			settlementId: settlement.id,
			payoutId: payout?.id ?? null,
			type: payout
				? FinancialAdjustmentType.POST_PAYOUT_RECOVERY
				: FinancialAdjustmentType.POST_SETTLEMENT_REFUND,
			amount: refund.amount,
			reason,
			actorId,
			status: canDebit ? FinancialAdjustmentStatus.RESOLVED : FinancialAdjustmentStatus.PENDING,
			idempotencyKey: createHash("sha256").update(`approved-refund:${refund.id}`).digest("hex"),
		})
	);
	await ledger.save(
		ledger.create({
			walletId: wallet.id,
			settlementId: settlement.id,
			payoutId: payout?.id ?? null,
			tripId: booking.tripId,
			type: canDebit
				? WalletTransactionType.POST_SETTLEMENT_DEBIT
				: WalletTransactionType.POST_PAYOUT_RECOVERY,
			netAmount: minorToMoney(-amountMinor),
			balanceAfter: wallet.balance,
			description:
				`${canDebit ? "Khấu trừ khoản hoàn đã duyệt" : "Ghi nhận khoản cần thu hồi"}: ${reason}`.slice(
					0,
					255
				),
		})
	);
	await manager.getRepository(AuditLog).save({
		actorId,
		action: "financial.reconciliation_created",
		targetType: "financial_adjustment",
		targetId: adjustment.id,
		after: {
			refundPaymentId: refund.id,
			amount: refund.amount,
			type: adjustment.type,
			status: adjustment.status,
		},
		reason,
	});
	return adjustment;
}
