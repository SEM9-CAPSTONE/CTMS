import { BadRequestException, ConflictException } from "@nestjs/common";
import type { DataSource, EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { Booking } from "../profiles/entities/booking.entity";
import { Trip, TripStatus } from "../trips/entities/trip.entity";
import { User } from "../users/entities/user.entity";
import {
	FinancialAdjustment,
	FinancialAdjustmentStatus,
	FinancialAdjustmentType,
} from "./entities/financial-adjustment.entity";
import { HostWallet } from "./entities/host-wallet.entity";
import { Payment, PaymentStatus, PaymentType, RefundReviewStatus } from "./entities/payment.entity";
import { Payout, PayoutStatus } from "./entities/payout.entity";
import { Settlement } from "./entities/settlement.entity";
import { WalletTransaction, WalletTransactionType } from "./entities/wallet-transaction.entity";
import type { PaymentsRepository } from "./payments.repository";
import { SettlementsService } from "./settlements.service";

describe("SettlementsService (CTMS-112 / CTMS-300 / CTMS-421)", () => {
	let service: SettlementsService;
	let dataSource: DataSource;
	let manager: EntityManager;

	let paymentsRepo: {
		findPaymentsByTripId: jest.Mock;
	};
	let tripRepo: {
		findOne: jest.Mock;
		findOneOrFail: jest.Mock;
		createQueryBuilder: jest.Mock;
	};
	let settlementRepo: {
		findOne: jest.Mock;
		create: jest.Mock;
		save: jest.Mock;
	};
	let walletRepo: {
		findOne: jest.Mock;
		create: jest.Mock;
		save: jest.Mock;
	};
	let payoutRepo: {
		findOne: jest.Mock;
		create: jest.Mock;
		save: jest.Mock;
		find: jest.Mock;
		createQueryBuilder: jest.Mock;
	};
	let walletTxnRepo: {
		find: jest.Mock;
		findOne: jest.Mock;
		create: jest.Mock;
		save: jest.Mock;
	};
	let reportRepo: {
		find: jest.Mock;
	};
	let auditRepo: {
		save: jest.Mock;
	};
	let userRepo: {
		findOne: jest.Mock;
	};
	let bookingRepo: {
		findOne: jest.Mock;
	};
	let paymentRepo: {
		find: jest.Mock;
		findOne: jest.Mock;
	};
	let adjustmentRepo: {
		findOne: jest.Mock;
		findOneOrFail: jest.Mock;
		find: jest.Mock;
		create: jest.Mock;
		save: jest.Mock;
		createQueryBuilder: jest.Mock;
	};

	let trip: Trip;
	let host: User;
	const fixedNow = new Date("2030-05-15T12:00:00Z");

	beforeEach(() => {
		jest.useFakeTimers().setSystemTime(fixedNow);

		host = Object.assign(new User(), {
			id: "host-uuid-1",
			fullName: "Nguyen Host",
			email: "host@test.com",
		});

		trip = Object.assign(new Trip(), {
			id: "trip-uuid-1",
			hostId: "host-uuid-1",
			host,
			title: "Trekking Fansipan",
			status: TripStatus.COMPLETED,
			startsAt: new Date("2030-05-10T08:00:00Z"),
			endsAt: new Date("2030-05-11T12:00:00Z"), // Completed 96h ago (>72h)
			updatedAt: new Date("2030-05-11T12:00:00Z"),
		});

		paymentsRepo = {
			findPaymentsByTripId: jest.fn().mockResolvedValue([
				Object.assign(new Payment(), {
					id: "charge-1",
					amount: "10000000.00",
					type: PaymentType.CHARGE,
					status: PaymentStatus.SUCCEEDED,
				}),
			]),
		};

		tripRepo = {
			findOneOrFail: jest.fn().mockImplementation(async () => trip),
			findOne: jest.fn().mockResolvedValue(trip),
			createQueryBuilder: jest.fn(),
		};

		settlementRepo = {
			findOne: jest.fn().mockResolvedValue(null),
			create: jest.fn().mockImplementation((val) => ({ id: "settlement-uuid-1", ...val })),
			save: jest
				.fn()
				.mockImplementation((val) => Promise.resolve({ id: "settlement-uuid-1", ...val })),
		};

		walletRepo = {
			findOne: jest.fn().mockResolvedValue(
				Object.assign(new HostWallet(), {
					id: "wallet-uuid-1",
					hostId: "host-uuid-1",
					balance: "0.00",
				})
			),
			create: jest.fn().mockImplementation((val) => ({ id: "wallet-uuid-1", ...val })),
			save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
		};

		payoutRepo = {
			findOne: jest.fn().mockResolvedValue(null),
			create: jest.fn().mockImplementation((val) => ({ id: "payout-uuid-1", ...val })),
			save: jest.fn().mockImplementation((val) => Promise.resolve({ id: "payout-uuid-1", ...val })),
			find: jest.fn().mockResolvedValue([]),
			createQueryBuilder: jest.fn(),
		};

		walletTxnRepo = {
			findOne: jest.fn().mockResolvedValue(null),
			find: jest.fn().mockResolvedValue([]),
			create: jest.fn().mockImplementation((val) => ({ id: "wtxn-uuid-1", ...val })),
			save: jest.fn().mockImplementation((val) => Promise.resolve({ id: "wtxn-uuid-1", ...val })),
		};

		reportRepo = {
			find: jest.fn().mockResolvedValue([]),
		};

		auditRepo = {
			save: jest.fn().mockResolvedValue({ id: "audit-1" }),
		};

		userRepo = {
			findOne: jest.fn().mockResolvedValue(host),
		};

		bookingRepo = {
			findOne: jest.fn(),
		};

		paymentRepo = {
			findOne: jest.fn().mockResolvedValue({
				id: "refund-approved-1",
				bookingId: "booking-uuid-1",
				amount: "1000000.00",
				type: PaymentType.REFUND,
				status: PaymentStatus.PENDING,
				reviewStatus: RefundReviewStatus.APPROVED,
			}),
			find: jest.fn(),
		};

		adjustmentRepo = {
			findOneOrFail: jest
				.fn()
				.mockImplementation(
					async () =>
						adjustmentRepo.save.mock.results.at(-1)?.value ??
						adjustmentRepo.findOne.mock.results.at(-1)?.value
				),
			findOne: jest.fn().mockResolvedValue(null),
			find: jest.fn().mockResolvedValue([]),
			create: jest.fn().mockImplementation((val) => ({ id: "adj-uuid-1", ...val })),
			save: jest.fn().mockImplementation((val) => Promise.resolve({ id: "adj-uuid-1", ...val })),
			createQueryBuilder: jest.fn(),
		};

		manager = {
			getRepository: jest.fn((entity) => {
				if (entity === Trip) return tripRepo;
				if (entity === Settlement) return settlementRepo;
				if (entity === HostWallet) return walletRepo;
				if (entity === Payout) return payoutRepo;
				if (entity === WalletTransaction) return walletTxnRepo;
				if (entity === User) return userRepo;
				if (entity === Booking) return bookingRepo;
				if (entity === Payment) return paymentRepo;
				if (entity === FinancialAdjustment) return adjustmentRepo;
				if (entity === AuditLog) return auditRepo;
				if (entity?.name === "ContentReport") return reportRepo;
				return auditRepo;
			}),
			withRepository: jest.fn((repo) => repo),
			// Weather penalty deduction (policy §6): no outstanding penalty in these cases.
			query: jest.fn().mockResolvedValue([]),
		} as unknown as EntityManager;

		dataSource = {
			transaction: jest.fn((cb) => cb(manager)),
			getRepository: jest.fn((entity) => {
				if (entity === Trip) return tripRepo;
				if (entity === Settlement) return settlementRepo;
				if (entity === HostWallet) return walletRepo;
				if (entity === Payout) return payoutRepo;
				if (entity === User) return userRepo;
				if (entity === WalletTransaction) return walletTxnRepo;
				if (entity === Booking) return bookingRepo;
				if (entity === Payment) return paymentRepo;
				if (entity === FinancialAdjustment) return adjustmentRepo;
				if (entity === AuditLog) return auditRepo;
				return reportRepo;
			}),
		} as unknown as DataSource;

		service = new SettlementsService(dataSource, paymentsRepo as unknown as PaymentsRepository);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("evaluateTripSettlement (PB AC-1 to PB AC-7)", () => {
		it("evaluates eligible trip > 72h with 5% platform fee and 95% host net", async () => {
			const evaluation = await service.evaluateTripSettlement("trip-uuid-1");

			expect(evaluation.isCompleted).toBe(true);
			expect(evaluation.isHoldPeriodSatisfied).toBe(true);
			expect(evaluation.isComplaintWindowSatisfied).toBe(true);
			expect(evaluation.isBlocked).toBe(false);
			expect(evaluation.isEligible).toBe(true);
			expect(evaluation.isSettled).toBe(false);

			expect(evaluation.settlementBase).toBe("10000000.00");
			expect(evaluation.commissionRate).toBe("0.0500");
			// 5% of 10,000,000 is 500,000
			expect(evaluation.platformFee).toBe("500000.00");
			// 95% of 10,000,000 is 9,500,000
			expect(evaluation.hostNetAmount).toBe("9500000.00");
		});

		it("marks not eligible if trip completed < 72h ago (PB AC-2)", async () => {
			trip.endsAt = new Date("2030-05-14T00:00:00Z"); // 36 hours ago (<72h)

			const evaluation = await service.evaluateTripSettlement("trip-uuid-1");

			expect(evaluation.isHoldPeriodSatisfied).toBe(false);
			expect(evaluation.isEligible).toBe(false);
			expect(evaluation.blockingReasons).toEqual(
				expect.arrayContaining([expect.stringContaining("72-hour hold period has not elapsed yet")])
			);
		});

		it("marks not eligible if trip is not completed (PB AC-1)", async () => {
			trip.status = TripStatus.ONGOING;

			const evaluation = await service.evaluateTripSettlement("trip-uuid-1");

			expect(evaluation.isCompleted).toBe(false);
			expect(evaluation.isEligible).toBe(false);
		});

		it("detects blocking pending refunds (PB AC-4)", async () => {
			paymentsRepo.findPaymentsByTripId.mockResolvedValue([
				Object.assign(new Payment(), {
					id: "charge-1",
					amount: "10000000.00",
					type: PaymentType.CHARGE,
					status: PaymentStatus.SUCCEEDED,
				}),
				Object.assign(new Payment(), {
					id: "refund-pending-1",
					amount: "2000000.00",
					type: PaymentType.REFUND,
					status: PaymentStatus.PENDING,
				}),
			]);

			const evaluation = await service.evaluateTripSettlement("trip-uuid-1");

			expect(evaluation.isBlocked).toBe(true);
			expect(evaluation.isEligible).toBe(false);
			expect(evaluation.blockingReasons).toEqual(
				expect.arrayContaining([
					expect.stringContaining("is pending provider execution/settlement"),
				])
			);
		});

		it("reduces settlement base by succeeded refunds (BR-336)", async () => {
			paymentsRepo.findPaymentsByTripId.mockResolvedValue([
				Object.assign(new Payment(), {
					id: "charge-1",
					amount: "10000000.00",
					type: PaymentType.CHARGE,
					status: PaymentStatus.SUCCEEDED,
				}),
				Object.assign(new Payment(), {
					id: "refund-succeeded-1",
					amount: "2000000.00",
					type: PaymentType.REFUND,
					status: PaymentStatus.SUCCEEDED,
				}),
			]);

			const evaluation = await service.evaluateTripSettlement("trip-uuid-1");

			expect(evaluation.settlementBase).toBe("8000000.00");
			expect(evaluation.platformFee).toBe("400000.00"); // 5% of 8M
			expect(evaluation.hostNetAmount).toBe("7600000.00"); // 95% of 8M
		});
	});

	describe("settleTrip (BR-332, BR-334, BR-338)", () => {
		it("successfully settles trip, credits host wallet, and writes ledger + audit log", async () => {
			const result = await service.settleTrip("trip-uuid-1", "admin-uuid-1");

			expect(result.tripId).toBe("trip-uuid-1");
			expect(result.settlementBase).toBe("10000000.00");
			expect(result.platformFee).toBe("500000.00");
			expect(result.netAmount).toBe("9500000.00");
			expect(result.walletBalanceAfter).toBe("9500000.00");

			expect(settlementRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					tripId: "trip-uuid-1",
					hostId: "host-uuid-1",
					commissionRate: "0.0500",
					platformFee: "500000.00",
					netAmount: "9500000.00",
				})
			);

			expect(walletRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					balance: "9500000.00",
				})
			);

			expect(walletTxnRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					type: WalletTransactionType.SETTLEMENT_CREDIT,
					netAmount: "9500000.00",
					balanceAfter: "9500000.00",
				})
			);
		});

		it("is idempotent: returns existing settlement on duplicate attempt (PB AC-8, BR-332)", async () => {
			settlementRepo.findOne.mockResolvedValue(
				Object.assign(new Settlement(), {
					id: "existing-settlement-id",
					tripId: "trip-uuid-1",
					hostId: "host-uuid-1",
					settlementBase: "10000000.00",
					commissionRate: "0.0500",
					platformFee: "500000.00",
					netAmount: "9500000.00",
					settledAt: new Date("2030-05-14T10:00:00Z"),
				})
			);

			const result = await service.settleTrip("trip-uuid-1", "admin-uuid-1");

			expect(result.id).toBe("existing-settlement-id");
			expect(settlementRepo.save).not.toHaveBeenCalled();
		});

		it("aborts if 72-hour hold period has not elapsed", async () => {
			trip.endsAt = new Date("2030-05-14T00:00:00Z"); // 36 hours ago

			await expect(service.settleTrip("trip-uuid-1", "admin-uuid-1")).rejects.toThrow(
				ConflictException
			);
		});
	});

	describe("Host Payout Full-Amount Policy ('Rút hết, không cho tự nhập số tiền')", () => {
		it("requests full wallet withdrawal and locks wallet balance to 0", async () => {
			walletRepo.findOne.mockResolvedValue(
				Object.assign(new HostWallet(), {
					id: "wallet-uuid-1",
					hostId: "host-uuid-1",
					balance: "9500000.00",
				})
			);

			const payout = await service.requestHostPayout("host-uuid-1", {
				bankName: "Vietcombank",
				accountNumber: "0123456789",
				accountHolderName: "Nguyen Host",
			});

			expect(payout.amount).toBe("9500000.00");
			expect(payout.status).toBe(PayoutStatus.PENDING);
			expect(payout.accountHolderName).toBe("NGUYEN HOST");

			// Wallet balance must be locked to 0
			expect(walletRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					balance: "0.00",
				})
			);

			// Ledger transaction for payout debit
			expect(walletTxnRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					type: WalletTransactionType.PAYOUT_DEBIT,
					netAmount: "-9500000.00",
					balanceAfter: "0.00",
				})
			);
		});

		it("rejects payout request if wallet balance is 0", async () => {
			walletRepo.findOne.mockResolvedValue(
				Object.assign(new HostWallet(), {
					id: "wallet-uuid-1",
					hostId: "host-uuid-1",
					balance: "0.00",
				})
			);

			await expect(
				service.requestHostPayout("host-uuid-1", {
					bankName: "Vietcombank",
					accountNumber: "0123456789",
					accountHolderName: "Nguyen Host",
				})
			).rejects.toThrow(ConflictException);
		});

		it("rejects payout request if an existing pending payout already exists", async () => {
			walletRepo.findOne.mockResolvedValue(
				Object.assign(new HostWallet(), {
					id: "wallet-uuid-1",
					hostId: "host-uuid-1",
					balance: "5000000.00",
				})
			);
			payoutRepo.findOne.mockResolvedValue(
				Object.assign(new Payout(), {
					id: "existing-pending-payout",
					status: PayoutStatus.PENDING,
				})
			);

			await expect(
				service.requestHostPayout("host-uuid-1", {
					bankName: "Vietcombank",
					accountNumber: "0123456789",
					accountHolderName: "Nguyen Host",
				})
			).rejects.toThrow("Bạn đang có một yêu cầu rút tiền đang chờ xử lý");
		});

		it("rejects payout request if Host has no registered fullName", async () => {
			walletRepo.findOne.mockResolvedValue(
				Object.assign(new HostWallet(), {
					id: "wallet-uuid-1",
					hostId: "host-uuid-1",
					balance: "5000000.00",
				})
			);
			payoutRepo.findOne.mockResolvedValue(null);
			userRepo.findOne.mockResolvedValue({
				id: "host-uuid-1",
				fullName: "",
			});

			await expect(
				service.requestHostPayout("host-uuid-1", {
					bankName: "Vietcombank",
					accountNumber: "0123456789",
					accountHolderName: "Nguyen Host",
				})
			).rejects.toThrow(BadRequestException);
		});

		it("rejects payout request if accountHolderName does not match Host registered fullName (BR-351)", async () => {
			walletRepo.findOne.mockResolvedValue(
				Object.assign(new HostWallet(), {
					id: "wallet-uuid-1",
					hostId: "host-uuid-1",
					balance: "5000000.00",
				})
			);
			payoutRepo.findOne.mockResolvedValue(null);
			userRepo.findOne.mockResolvedValue({
				id: "host-uuid-1",
				fullName: "Nguyen Host",
			});

			await expect(
				service.requestHostPayout("host-uuid-1", {
					bankName: "Vietcombank",
					accountNumber: "0123456789",
					accountHolderName: "Le Van Other",
				})
			).rejects.toThrow(BadRequestException);
		});

		it("rejecting payout restores balance to Host Wallet", async () => {
			const pendingPayout = Object.assign(new Payout(), {
				id: "payout-uuid-1",
				hostId: "host-uuid-1",
				walletId: "wallet-uuid-1",
				amount: "9500000.00",
				status: PayoutStatus.PENDING,
			});
			payoutRepo.findOne.mockResolvedValue(pendingPayout);
			walletRepo.findOne.mockResolvedValue(
				Object.assign(new HostWallet(), {
					id: "wallet-uuid-1",
					hostId: "host-uuid-1",
					balance: "0.00",
				})
			);

			await service.rejectHostPayout("payout-uuid-1", "admin-uuid-1", {
				rejectionReason: "Sai số tài khoản thụ hưởng",
			});

			expect(pendingPayout.status).toBe(PayoutStatus.FAILED);
			expect(pendingPayout.rejectionReason).toBe("Sai số tài khoản thụ hưởng");

			// Wallet balance restored
			expect(walletRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					balance: "9500000.00",
				})
			);

			// Ledger refund transaction recorded
			expect(walletTxnRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					type: WalletTransactionType.PAYOUT_REFUND,
					netAmount: "9500000.00",
					balanceAfter: "9500000.00",
				})
			);
		});

		it("confirming payout marks status succeeded with transaction reference", async () => {
			const pendingPayout = Object.assign(new Payout(), {
				id: "payout-uuid-1",
				hostId: "host-uuid-1",
				walletId: "wallet-uuid-1",
				amount: "9500000.00",
				status: PayoutStatus.PENDING,
			});
			payoutRepo.findOne.mockResolvedValue(pendingPayout);

			await service.confirmHostPayout("payout-uuid-1", "admin-uuid-1", {
				transactionRef: "FT2610149999",
				adminNotes: "Chuyển khoản thành công qua VCB DigiBiz",
			});

			expect(pendingPayout.status).toBe(PayoutStatus.SUCCEEDED);
			expect(pendingPayout.transactionRef).toBe("FT2610149999");
			expect(pendingPayout.adminNotes).toBe("Chuyển khoản thành công qua VCB DigiBiz");
		});
	});

	describe("Reconcile Financial Exceptions after Settlement or Payout (CTMS-114 / BR-345)", () => {
		let booking: Booking;
		let chargePayment: Payment;
		let settlement: Settlement;

		beforeEach(() => {
			booking = Object.assign(new Booking(), {
				id: "booking-uuid-1",
				tripId: "trip-uuid-1",
				trip,
			});

			chargePayment = Object.assign(new Payment(), {
				id: "payment-uuid-1",
				bookingId: "booking-uuid-1",
				amount: "1000000.00",
				type: PaymentType.CHARGE,
				status: PaymentStatus.SUCCEEDED,
			});

			settlement = Object.assign(new Settlement(), {
				id: "settlement-uuid-1",
				tripId: "trip-uuid-1",
				hostId: "host-uuid-1",
				host,
				settlementBase: "10000000.00",
				commissionRate: "0.0500",
				platformFee: "500000.00",
				netAmount: "9500000.00",
				settledAt: new Date("2030-05-12T12:00:00Z"),
			});

			bookingRepo.findOne.mockResolvedValue(booking);
			paymentRepo.find.mockResolvedValue([chargePayment]);
			settlementRepo.findOne.mockResolvedValue(settlement);
			adjustmentRepo.find.mockResolvedValue([]);
			adjustmentRepo.findOne.mockResolvedValue(null);
			payoutRepo.findOne.mockResolvedValue(null);
		});

		it("throws ConflictException when no settlement exists for the trip", async () => {
			settlementRepo.findOne.mockResolvedValue(null);

			await expect(
				service.reconcileFinancialException("booking-uuid-1", "admin-uuid-1", {
					bookingId: "booking-uuid-1",
					reason: "Medical emergency after trip end",
				})
			).rejects.toThrow(ConflictException);
		});

		it("creates POST_SETTLEMENT_REFUND, debits host wallet and marks resolved when wallet has balance", async () => {
			walletRepo.findOne.mockResolvedValue(
				Object.assign(new HostWallet(), {
					id: "wallet-uuid-1",
					hostId: "host-uuid-1",
					balance: "2000000.00",
				})
			);

			const result = await service.reconcileFinancialException("booking-uuid-1", "admin-uuid-1", {
				bookingId: "booking-uuid-1",
				reason: "Camper verified emergency post settlement",
			});

			expect(result.type).toBe(FinancialAdjustmentType.POST_SETTLEMENT_REFUND);
			expect(result.status).toBe(FinancialAdjustmentStatus.RESOLVED);
			expect(result.amount).toBe("1000000.00");
			expect(result.settlementId).toBe("settlement-uuid-1");
			expect(result.payoutId).toBeNull();

			// Host wallet debited
			expect(walletRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					balance: "1000000.00",
				})
			);

			// WalletTransaction posted
			expect(walletTxnRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					type: WalletTransactionType.POST_SETTLEMENT_DEBIT,
					netAmount: "-1000000.00",
					balanceAfter: "1000000.00",
				})
			);

			// AuditLog written
			expect(auditRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					action: "financial.reconciliation_created",
					targetType: "financial_adjustment",
				})
			);
		});

		it("creates POST_SETTLEMENT_REFUND with status pending and does not debit wallet when wallet balance is insufficient", async () => {
			walletRepo.findOne.mockResolvedValue(
				Object.assign(new HostWallet(), {
					id: "wallet-uuid-1",
					hostId: "host-uuid-1",
					balance: "500000.00", // Less than 1,000,000
				})
			);

			const result = await service.reconcileFinancialException("booking-uuid-1", "admin-uuid-1", {
				bookingId: "booking-uuid-1",
				reason: "Insufficient wallet balance case",
			});

			expect(result.type).toBe(FinancialAdjustmentType.POST_SETTLEMENT_REFUND);
			expect(result.status).toBe(FinancialAdjustmentStatus.PENDING);
			expect(walletRepo.save).not.toHaveBeenCalled();
			expect(walletTxnRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					type: WalletTransactionType.POST_PAYOUT_RECOVERY,
					balanceAfter: "500000.00",
				})
			);
		});

		it("creates POST_PAYOUT_RECOVERY and logs debt transaction without changing wallet balance when host has succeeded payout post-settlement", async () => {
			const succeededPayout = Object.assign(new Payout(), {
				id: "payout-uuid-1",
				hostId: "host-uuid-1",
				status: PayoutStatus.SUCCEEDED,
				createdAt: new Date("2030-05-13T12:00:00Z"), // After settlement at May 12
			});
			payoutRepo.findOne.mockResolvedValue(succeededPayout);

			walletRepo.findOne.mockResolvedValue(
				Object.assign(new HostWallet(), {
					id: "wallet-uuid-1",
					hostId: "host-uuid-1",
					balance: "0.00",
				})
			);

			const result = await service.reconcileFinancialException("booking-uuid-1", "admin-uuid-1", {
				bookingId: "booking-uuid-1",
				reason: "Host already withdrew funds post settlement",
			});

			expect(result.type).toBe(FinancialAdjustmentType.POST_PAYOUT_RECOVERY);
			expect(result.status).toBe(FinancialAdjustmentStatus.PENDING);
			expect(result.payoutId).toBe("payout-uuid-1");
			expect(result.settlementId).toBe("settlement-uuid-1");

			// Wallet balance NOT deducted (no negative balance per BR-345)
			expect(walletRepo.save).not.toHaveBeenCalled();

			// Recorded as recovery debt in wallet transactions
			expect(walletTxnRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					type: WalletTransactionType.POST_PAYOUT_RECOVERY,
					netAmount: "-1000000.00",
					balanceAfter: "0.00",
				})
			);

			// Audit logged
			expect(auditRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					action: "financial.reconciliation_created",
				})
			);
		});

		it("is idempotent: returns existing adjustment on duplicate call with same key", async () => {
			const existing = Object.assign(new FinancialAdjustment(), {
				id: "adj-existing-1",
				bookingId: "booking-uuid-1",
				tripId: "trip-uuid-1",
				trip,
				hostId: "host-uuid-1",
				host,
				amount: "1000000.00",
				reason: "Duplicate test",
				status: FinancialAdjustmentStatus.RESOLVED,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			adjustmentRepo.findOne.mockResolvedValue(existing);

			const result = await service.reconcileFinancialException("booking-uuid-1", "admin-uuid-1", {
				bookingId: "booking-uuid-1",
				reason: "Duplicate test",
			});

			expect(result.id).toBe("adj-existing-1");
			expect(adjustmentRepo.save).not.toHaveBeenCalled();
			expect(auditRepo.save).not.toHaveBeenCalled();
		});

		it("lists adjustments with filters and pagination", async () => {
			const bookingCreatedAt = new Date("2030-05-01T05:00:00Z");
			const mockAdjustments = [
				Object.assign(new FinancialAdjustment(), {
					id: "adj-1",
					bookingId: "booking-uuid-1",
					booking: Object.assign(booking, {
						user: Object.assign(new User(), { fullName: "Nguyễn Văn An" }),
						createdAt: bookingCreatedAt,
					}),
					settlement,
					tripId: "trip-uuid-1",
					trip,
					hostId: "host-uuid-1",
					host,
					type: FinancialAdjustmentType.POST_SETTLEMENT_REFUND,
					amount: "1000000.00",
					reason: "List test",
					status: FinancialAdjustmentStatus.PENDING,
					createdAt: new Date(),
					updatedAt: new Date(),
				}),
			];

			const mockQb = {
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				skip: jest.fn().mockReturnThis(),
				take: jest.fn().mockReturnThis(),
				getManyAndCount: jest.fn().mockResolvedValue([mockAdjustments, 1]),
			};
			adjustmentRepo.createQueryBuilder.mockReturnValue(mockQb);

			const result = await service.listFinancialAdjustments({
				status: "pending",
				type: "post_settlement_refund",
				page: 1,
				limit: 10,
			});

			expect(result.total).toBe(1);
			expect(result.items).toHaveLength(1);
			expect(result.items[0].id).toBe("adj-1");
			expect(result.items[0].camperName).toBe("Nguyễn Văn An");
			expect(result.items[0].bookingCreatedAt).toEqual(bookingCreatedAt);
			expect(result.items[0].settledAt).toEqual(settlement.settledAt);
			expect(result.items[0].payoutRequestedAt).toBeNull();
			expect(mockQb.andWhere).toHaveBeenCalledWith("adj.type = :type", {
				type: "post_settlement_refund",
			});
			expect(mockQb.andWhere).toHaveBeenCalledWith("adj.status = :status", {
				status: "pending",
			});
		});

		it("resolves a pending financial adjustment and logs audit", async () => {
			const pendingAdj = Object.assign(new FinancialAdjustment(), {
				id: "adj-to-resolve",
				bookingId: "booking-uuid-1",
				tripId: "trip-uuid-1",
				trip,
				hostId: "host-uuid-1",
				host,
				type: FinancialAdjustmentType.POST_PAYOUT_RECOVERY,
				amount: "1000000.00",
				reason: "Recovery needed",
				status: FinancialAdjustmentStatus.PENDING,
				notes: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			adjustmentRepo.findOne.mockResolvedValue(pendingAdj);

			const result = await service.resolveFinancialAdjustment("adj-to-resolve", "admin-uuid-1", {
				notes: "Host transferred cash manually",
			});

			expect(result.status).toBe(FinancialAdjustmentStatus.RESOLVED);
			expect(pendingAdj.status).toBe(FinancialAdjustmentStatus.RESOLVED);
			expect(pendingAdj.notes).toContain("Host transferred cash manually");
			expect(adjustmentRepo.save).toHaveBeenCalledWith(pendingAdj);
			expect(auditRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					action: "financial.reconciliation_resolved",
					targetType: "financial_adjustment",
				})
			);
		});
	});
});
