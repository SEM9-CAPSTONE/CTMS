import { BadRequestException, ConflictException } from "@nestjs/common";
import type { DataSource, EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { Booking, BookingStatus } from "../profiles/entities/booking.entity";
import { Trip, TripStatus } from "../trips/entities/trip.entity";
import type { BookingsRepository } from "./bookings.repository";
import { FinancialAdjustment } from "./entities/financial-adjustment.entity";
import { HostWallet } from "./entities/host-wallet.entity";
import {
	Payment,
	PaymentStatus,
	PaymentTransaction,
	PaymentTransactionStatus,
	PaymentType,
	RefundReviewStatus,
} from "./entities/payment.entity";
import { Payout, PayoutStatus } from "./entities/payout.entity";
import { Settlement } from "./entities/settlement.entity";
import { WalletTransaction } from "./entities/wallet-transaction.entity";
import type { PaymentsRepository } from "./payments.repository";
import { RefundsService } from "./refunds.service";

describe("Refund request review and linked financial ledger", () => {
	let service: RefundsService;
	let refund: Payment;
	let wallet: HostWallet;
	let settlement: Settlement | null;
	let payout: Payout | null;
	let adjustment: FinancialAdjustment | null;
	let requestPayload: Record<string, unknown>;
	let savedLedger: WalletTransaction[];
	let savedTransactions: PaymentTransaction[];
	let audits: Array<Partial<AuditLog>>;
	let booking: Booking;
	let trip: Trip;
	beforeEach(() => {
		trip = Object.assign(new Trip(), {
			id: "trip",
			hostId: "host",
			status: TripStatus.COMPLETED,
			endsAt: new Date(Date.now() - 7 * 86400000),
		});
		booking = Object.assign(new Booking(), {
			id: "booking",
			tripId: trip.id,
			userId: "camper",
			status: BookingStatus.COMPLETED,
		});
		refund = Object.assign(new Payment(), {
			id: "refund",
			bookingId: booking.id,
			parentPaymentId: "charge",
			amount: "450000.00",
			type: PaymentType.REFUND,
			status: PaymentStatus.PENDING,
			reviewStatus: RefundReviewStatus.PENDING,
			createdAt: new Date(),
		});
		wallet = Object.assign(new HostWallet(), {
			id: "wallet",
			hostId: "host",
			balance: "855000.00",
		});
		settlement = Object.assign(new Settlement(), {
			id: "settlement",
			hostId: "host",
			tripId: "trip",
			settledAt: new Date(Date.now() - 3 * 86400000),
		});
		payout = null;
		adjustment = null;
		savedLedger = [];
		savedTransactions = [];
		audits = [];
		requestPayload = { reason: "Khoản thu thừa đã được đối chiếu.", lateRequest: false };
		const paymentRepo = {
			findOne: jest.fn(async () => refund),
			findForUpdate: jest.fn(async () => refund),
			save: jest.fn(async (p: Payment) => p),
		};
		const repos = new Map<unknown, unknown>([
			[Booking, { findOneByOrFail: async () => booking, findOneOrFail: async () => booking }],
			[Trip, { findOneOrFail: async () => trip }],
			[Settlement, { findOne: async () => settlement }],
			[HostWallet, { findOne: async () => wallet, save: async (w: HostWallet) => w }],
			[Payout, { findOne: async () => payout }],
			[
				FinancialAdjustment,
				{
					findOne: async () => adjustment,
					create: (v: Partial<FinancialAdjustment>) =>
						Object.assign(new FinancialAdjustment(), { id: "adjustment", ...v }),
					save: async (v: FinancialAdjustment) => {
						adjustment = v;
						return v;
					},
				},
			],
			[
				WalletTransaction,
				{
					findOne: async () => ({ walletId: wallet.id }),
					create: (v: Partial<WalletTransaction>) => Object.assign(new WalletTransaction(), v),
					save: async (v: WalletTransaction) => {
						savedLedger.push(v);
						return v;
					},
				},
			],
			[
				PaymentTransaction,
				{
					findOne: async () => ({ rawPayload: requestPayload }),
					create: (v: Partial<PaymentTransaction>) => Object.assign(new PaymentTransaction(), v),
					save: async (v: PaymentTransaction) => {
						savedTransactions.push(v);
						return v;
					},
				},
			],
			[
				AuditLog,
				{
					save: async (v: Partial<AuditLog>) => {
						audits.push(v);
						return v;
					},
				},
			],
		]);
		const manager = {
			getRepository: (entity: unknown) => repos.get(entity),
			withRepository: () => paymentRepo,
		} as unknown as EntityManager;
		const source = {
			transaction: async (fn: (m: EntityManager) => Promise<unknown>) => fn(manager),
		} as unknown as DataSource;
		service = new RefundsService(
			source,
			paymentRepo as unknown as PaymentsRepository,
			{} as BookingsRepository
		);
	});

	it("approves and links one adjustment without claiming money was transferred", async () => {
		await service.approveRefund("admin", refund.id, {});
		expect(refund.reviewStatus).toBe(RefundReviewStatus.APPROVED);
		expect(refund.status).toBe(PaymentStatus.PENDING);
		expect(wallet.balance).toBe("405000.00");
		expect(adjustment).toMatchObject({
			refundPaymentId: refund.id,
			amount: refund.amount,
			status: "resolved",
		});
		expect(savedLedger).toHaveLength(1);
		expect(savedTransactions[0].status).toBe(PaymentTransactionStatus.PENDING);
	});
	it("replaying approval does not debit the wallet or create another adjustment", async () => {
		await service.approveRefund("admin", refund.id, {});
		await service.approveRefund("admin", refund.id, {});
		expect(savedLedger).toHaveLength(1);
		expect(wallet.balance).toBe("405000.00");
		expect(audits.filter((a) => a.action === "booking.refund_approved")).toHaveLength(1);
	});
	it("records recovery after payout and leaves the wallet balance unchanged", async () => {
		wallet.balance = "0.00";
		payout = Object.assign(new Payout(), { id: "payout", status: PayoutStatus.SUCCEEDED });
		await service.approveRefund("admin", refund.id, {});
		expect(wallet.balance).toBe("0.00");
		expect(adjustment).toMatchObject({
			refundPaymentId: refund.id,
			payoutId: "payout",
			status: "pending",
			type: "post_payout_recovery",
		});
		expect(savedLedger[0].balanceAfter).toBe("0.00");
	});
	it("records insufficient wallet funds for manual recovery without creating a negative balance", async () => {
		wallet.balance = "100000.00";
		await service.approveRefund("admin", refund.id, {});
		expect(wallet.balance).toBe("100000.00");
		expect(adjustment).toMatchObject({ status: "pending", amount: "450000.00" });
	});
	it("requires a reason when approving a late request, before changing financial state", async () => {
		requestPayload.lateRequest = true;
		await expect(service.approveRefund("admin", refund.id, {})).rejects.toThrow(
			BadRequestException
		);
		expect(adjustment).toBeNull();
		expect(wallet.balance).toBe("855000.00");
		await service.approveRefund("admin", refund.id, { note: "Đã xác minh khoản thu thừa." });
		expect(refund.reviewStatus).toBe(RefundReviewStatus.APPROVED);
	});
	it("rejects a request without touching the host ledger and prevents later approval", async () => {
		await service.rejectRefund("admin", refund.id, { rejectionReason: "Không có khoản thu thừa." });
		expect(refund.reviewStatus).toBe(RefundReviewStatus.REJECTED);
		expect(savedLedger).toHaveLength(0);
		await expect(service.approveRefund("admin", refund.id, {})).rejects.toThrow(ConflictException);
	});
	it("blocks transfer confirmation until the request is approved", async () => {
		await expect(
			service.confirmManualRefund("admin", refund.id, { transactionRef: "FT2611131001" })
		).rejects.toThrow(ConflictException);
		expect(refund.status).toBe(PaymentStatus.PENDING);
	});
	it("confirms the approved refund without debiting the host a second time", async () => {
		await service.approveRefund("admin", refund.id, {});
		await service.confirmManualRefund("admin", refund.id, { transactionRef: "FT2611131001" });
		expect(refund.status).toBe(PaymentStatus.SUCCEEDED);
		expect(refund.providerReference).toBe("FT2611131001");
		expect(wallet.balance).toBe("405000.00");
		expect(savedLedger).toHaveLength(1);
	});
	it("does not allow rejecting an already approved refund", async () => {
		await service.approveRefund("admin", refund.id, {});
		await expect(
			service.rejectRefund("admin", refund.id, { rejectionReason: "Đổi ý" })
		).rejects.toThrow(ConflictException);
	});
	it("approves a pre-settlement request without creating a host debit", async () => {
		settlement = null;
		await service.approveRefund("admin", refund.id, {});
		expect(adjustment).toBeNull();
		expect(savedLedger).toHaveLength(0);
		expect(refund.reviewStatus).toBe(RefundReviewStatus.APPROVED);
	});
});
