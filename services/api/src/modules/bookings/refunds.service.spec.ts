import { ConflictException } from "@nestjs/common";
import type { DataSource, EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { Booking, BookingPaymentStatus, BookingStatus } from "../profiles/entities/booking.entity";
import { Trip, TripStatus } from "../trips/entities/trip.entity";
import type { BookingsRepository } from "./bookings.repository";
import {
	Payment,
	PaymentStatus,
	PaymentTransaction,
	PaymentTransactionStatus,
	PaymentType,
} from "./entities/payment.entity";
import type { PaymentsRepository } from "./payments.repository";
import { RefundOrigin } from "./refund-policy";
import { RefundsService } from "./refunds.service";

describe("RefundsService (CTMS-035)", () => {
	let service: RefundsService;
	let dataSource: DataSource;
	let paymentsRepo: {
		findByBookingForUpdate: jest.Mock;
		findByIdempotencyKey: jest.Mock;
		findForUpdate: jest.Mock;
		lockIdempotencyKey: jest.Mock;
		create: jest.Mock;
		save: jest.Mock;
		findPaymentsByTripId: jest.Mock;
	};
	let bookingsRepo: {
		findOne: jest.Mock;
		findForUpdate: jest.Mock;
		save: jest.Mock;
	};
	let tripsRepo: {
		findOne: jest.Mock;
	};
	let auditRepo: {
		save: jest.Mock;
	};
	let txnRepo: {
		findOne: jest.Mock;
		create: jest.Mock;
		save: jest.Mock;
	};

	let trip: Trip;
	let booking: Booking;
	let charge: Payment;
	const fixedNow = new Date("2030-05-01T12:00:00Z");

	beforeEach(() => {
		jest.useFakeTimers().setSystemTime(fixedNow);

		trip = Object.assign(new Trip(), {
			id: "trip-uuid-1",
			status: TripStatus.PUBLISHED,
			startsAt: new Date("2030-05-10T08:00:00Z"),
			endsAt: new Date("2030-05-12T18:00:00Z"),
		});

		booking = Object.assign(new Booking(), {
			id: "booking-uuid-1",
			tripId: "trip-uuid-1",
			userId: "camper-uuid-1",
			status: BookingStatus.CANCELLED,
			paymentStatus: BookingPaymentStatus.PAID,
			cancelledAt: new Date("2030-05-01T10:00:00Z"), // 2 hours before fixedNow
			tripStartsAtSnapshot: new Date("2030-05-10T08:00:00Z"),
			tripEndsAtSnapshot: new Date("2030-05-12T18:00:00Z"),
		});

		charge = Object.assign(new Payment(), {
			id: "charge-uuid-1",
			bookingId: "booking-uuid-1",
			type: PaymentType.CHARGE,
			status: PaymentStatus.SUCCEEDED,
			amount: "100.00",
			providerReference: "order-12345",
			createdAt: new Date("2030-04-30T10:00:00Z"),
		});

		paymentsRepo = {
			findByBookingForUpdate: jest.fn().mockResolvedValue([charge]),
			findByIdempotencyKey: jest.fn().mockResolvedValue(null),
			findOne: jest.fn().mockResolvedValue(null),
			findForUpdate: jest.fn().mockImplementation((id: string) => {
				if (id === charge.id) return Promise.resolve(charge);
				return Promise.resolve(null);
			}),
			lockIdempotencyKey: jest.fn().mockResolvedValue(undefined),
			create: jest.fn((attrs: Partial<Payment>) => Object.assign(new Payment(), attrs)),
			save: jest.fn(async (payment: Payment) => {
				if (!payment.id) payment.id = "refund-uuid-1";
				if (!payment.createdAt) payment.createdAt = fixedNow;
				return payment;
			}),
			findPaymentsByTripId: jest.fn().mockResolvedValue([charge]),
		};

		bookingsRepo = {
			findOne: jest.fn().mockResolvedValue(booking),
			findForUpdate: jest.fn().mockResolvedValue(booking),
			save: jest.fn(async (b: Booking) => b),
		};

		tripsRepo = {
			findOne: jest.fn().mockResolvedValue(trip),
		};

		auditRepo = {
			save: jest.fn().mockResolvedValue(undefined),
		};

		txnRepo = {
			findOne: jest.fn().mockResolvedValue(null),
			create: jest.fn((attrs: Partial<PaymentTransaction>) =>
				Object.assign(new PaymentTransaction(), attrs)
			),
			save: jest.fn(async (txn: PaymentTransaction) => {
				if (!txn.id) txn.id = "txn-uuid-1";
				if (!txn.createdAt) txn.createdAt = fixedNow;
				return txn;
			}),
		};

		const manager = {
			withRepository: (repo: unknown) => {
				if (repo === paymentsRepo) return paymentsRepo;
				if (repo === bookingsRepo) return bookingsRepo;
				return repo;
			},
			getRepository: (entity: unknown) => {
				if (entity === Trip) return tripsRepo;
				if (entity === AuditLog) return auditRepo;
				if (entity === PaymentTransaction) return txnRepo;
				if (entity === Payment) return paymentsRepo;
				throw new Error("Unexpected entity in test getRepository");
			},
		} as unknown as EntityManager;

		dataSource = {
			transaction: jest.fn(async (run: (m: EntityManager) => unknown) => run(manager)),
			getRepository: (entity: unknown) => {
				if (entity === Trip) return tripsRepo;
				return manager.getRepository(entity);
			},
		} as unknown as DataSource;

		service = new RefundsService(
			dataSource,
			paymentsRepo as unknown as PaymentsRepository,
			bookingsRepo as unknown as BookingsRepository
		);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("processRefund (PB AC-1, PB AC-2, PB AC-3, BR-105)", () => {
		it("successfully processes an approved pre-Trip refund and creates a PaymentTransaction", async () => {
			const res = await service.processRefund(
				"admin-1",
				"booking-uuid-1",
				"key-1",
				{
					amount: "50.00",
					origin: RefundOrigin.CAMPER_CANCELLATION,
					reason: "camper_cancelled_pre_trip",
				},
				{ mockProvider: true }
			);

			expect(res.refundId).toBe("refund-uuid-1");
			expect(res.parentPaymentId).toBe("charge-uuid-1");
			expect(res.amount).toBe("50.00");
			expect(res.status).toBe(PaymentStatus.SUCCEEDED);
			expect(res.transactionStatus).toBe(PaymentTransactionStatus.SUCCEEDED);
			expect(res.policySource).toBe("booking_cancellation_policy");

			// Verify PaymentTransaction saved
			expect(txnRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					paymentId: "refund-uuid-1",
					status: PaymentTransactionStatus.SUCCEEDED,
				})
			);

			// Verify AuditLog saved
			expect(auditRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					action: "booking.refund_processed",
					targetType: "payment",
					targetId: "refund-uuid-1",
					after: expect.objectContaining({
						refundStatus: PaymentStatus.SUCCEEDED,
						amount: "50.00",
						parentPaymentId: "charge-uuid-1",
					}),
				})
			);
		});

		it("processes an existing pending refund obligation from CTMS-034 cancellation", async () => {
			const existingObligation = Object.assign(new Payment(), {
				id: "obligation-1",
				bookingId: "booking-uuid-1",
				type: PaymentType.REFUND,
				status: PaymentStatus.PENDING,
				amount: "40.00",
				parentPaymentId: "charge-uuid-1",
				createdAt: new Date("2030-05-01T10:00:00Z"),
			});
			paymentsRepo.findByBookingForUpdate.mockResolvedValue([charge, existingObligation]);

			const res = await service.processRefund(
				"admin-1",
				"booking-uuid-1",
				undefined,
				{
					obligationId: "obligation-1",
				},
				{ mockProvider: true }
			);

			expect(res.refundId).toBe("obligation-1");
			expect(res.status).toBe(PaymentStatus.SUCCEEDED);
			expect(res.amount).toBe("40.00");
			expect(paymentsRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "obligation-1",
					status: PaymentStatus.SUCCEEDED,
				})
			);
		});

		it("returns idempotent replay when called with identical key and payload (PB AC-5, BR-178)", async () => {
			const existingRefund = Object.assign(new Payment(), {
				id: "refund-existing",
				bookingId: "booking-uuid-1",
				type: PaymentType.REFUND,
				status: PaymentStatus.SUCCEEDED,
				amount: "50.00",
				parentPaymentId: "charge-uuid-1",
				idempotencyKey: "key-1",
				requestFingerprint: "3c613e551c6e1da32aa87d0ec63ad46cfb74ab42159846062f6b3cf17d298ea5", // matching fingerprint
				providerReference: "stub-123",
				createdAt: fixedNow,
			});
			paymentsRepo.findByIdempotencyKey.mockResolvedValue(existingRefund);
			txnRepo.findOne.mockResolvedValue(
				Object.assign(new PaymentTransaction(), { status: PaymentTransactionStatus.SUCCEEDED })
			);

			// Match payload so fingerprint matches
			const fingerprintMethod = (
				service as unknown as { fingerprint: (id: string, dto: object) => string }
			).fingerprint.bind(service);
			const expectedFingerprint = fingerprintMethod("booking-uuid-1", {
				amount: "50.00",
				origin: RefundOrigin.CAMPER_CANCELLATION,
			});
			existingRefund.requestFingerprint = expectedFingerprint;

			const res = await service.processRefund("admin-1", "booking-uuid-1", "key-1", {
				amount: "50.00",
				origin: RefundOrigin.CAMPER_CANCELLATION,
			});

			expect(res.refundId).toBe("refund-existing");
			expect(res.status).toBe(PaymentStatus.SUCCEEDED);
			// Does not re-create or re-call provider
			expect(txnRepo.save).not.toHaveBeenCalled();
		});

		it("rejects when idempotency key is reused with a different payload (BR-178)", async () => {
			const existingRefund = Object.assign(new Payment(), {
				id: "refund-existing",
				bookingId: "booking-uuid-1",
				idempotencyKey: "key-1",
				requestFingerprint: "different-fingerprint-hash",
			});
			paymentsRepo.findByIdempotencyKey.mockResolvedValue(existingRefund);

			await expect(
				service.processRefund("admin-1", "booking-uuid-1", "key-1", {
					amount: "50.00",
					origin: RefundOrigin.CAMPER_CANCELLATION,
				})
			).rejects.toThrow("Idempotency-Key was already used with a different payload");
		});

		it("rejects refund attempt when cumulative refunds exceed charge amount (PB AC-4, BR-105)", async () => {
			const priorRefund = Object.assign(new Payment(), {
				id: "prior-1",
				type: PaymentType.REFUND,
				status: PaymentStatus.SUCCEEDED,
				amount: "70.00",
				parentPaymentId: "charge-uuid-1",
			});
			paymentsRepo.findByBookingForUpdate.mockResolvedValue([charge, priorRefund]);

			await expect(
				service.processRefund("admin-1", "booking-uuid-1", "key-1", {
					amount: "40.00", // 70 + 40 = 110 > 100
					origin: RefundOrigin.CAMPER_CANCELLATION,
				})
			).rejects.toThrow(
				"Requested refund amount 40.00 exceeds remaining refundable charge amount 30.00"
			);
		});

		it("rejects when booking has no eligible succeeded charge (PB AC-1, Table 10)", async () => {
			const pendingCharge = Object.assign(new Payment(), {
				id: "charge-pending",
				type: PaymentType.CHARGE,
				status: PaymentStatus.PENDING,
				amount: "100.00",
			});
			paymentsRepo.findByBookingForUpdate.mockResolvedValue([pendingCharge]);

			await expect(
				service.processRefund("admin-1", "booking-uuid-1", "key-1", {
					amount: "50.00",
					origin: RefundOrigin.CAMPER_CANCELLATION,
				})
			).rejects.toThrow("Booking must have one unambiguous eligible succeeded charge");
		});

		it("rejects pre-Trip request when 24-hour processing window has expired (BR-104)", async () => {
			booking.cancelledAt = new Date("2030-04-30T10:00:00Z"); // 26 hours ago
			await expect(
				service.processRefund("admin-1", "booking-uuid-1", "key-1", {
					amount: "50.00",
					origin: RefundOrigin.CAMPER_CANCELLATION,
				})
			).rejects.toThrow(
				"Pre-Trip refund submission exceeds the required 24-hour processing window"
			);
		});

		it("processes Host cancellation refund even after Camper pre-trip window has passed (BR-103)", async () => {
			trip.status = TripStatus.CANCELLED;
			booking.status = BookingStatus.CONFIRMED;

			const res = await service.processRefund(
				"admin-1",
				"booking-uuid-1",
				"key-host-cancel",
				{
					amount: "100.00",
					origin: RefundOrigin.HOST_TRIP_CANCELLATION,
				},
				{ mockProvider: true }
			);

			expect(res.status).toBe(PaymentStatus.SUCCEEDED);
			expect(res.policySource).toBe("host_trip_cancellation_policy");
		});

		it("handles provider failure: marks Payment failed and throws ConflictException (PB AC-7)", async () => {
			// Mock provider failure by having submitProviderRefund return failure
			const originalSubmit = (service as unknown as { submitProviderRefund: () => unknown })
				.submitProviderRefund;
			(service as unknown as { submitProviderRefund: () => unknown }).submitProviderRefund = jest
				.fn()
				.mockResolvedValue({
					succeeded: false,
					isPending: false,
					transactionRef: "err-1",
					rawPayload: { error: "insufficient_funds" },
				});

			await expect(
				service.processRefund("admin-1", "booking-uuid-1", "key-fail", {
					amount: "50.00",
					origin: RefundOrigin.CAMPER_CANCELLATION,
				})
			).rejects.toThrow(ConflictException);

			expect(paymentsRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					status: PaymentStatus.FAILED,
				})
			);
			expect(txnRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					status: PaymentTransactionStatus.FAILED,
				})
			);

			(service as unknown as { submitProviderRefund: () => unknown }).submitProviderRefund =
				originalSubmit;
		});
	});

	describe("reconcileProviderRefundCallback (PB AC-5, BR-332)", () => {
		it("transitions pending refund to SUCCEEDED and creates PaymentTransaction", async () => {
			const pendingRefund = Object.assign(new Payment(), {
				id: "ref-pending-1",
				type: PaymentType.REFUND,
				status: PaymentStatus.PENDING,
				amount: "50.00",
				providerReference: "prov-order-1",
			});
			paymentsRepo.findOne.mockResolvedValue(pendingRefund);
			paymentsRepo.findForUpdate.mockResolvedValue(pendingRefund);

			// Reconcile
			const res = await service.reconcileProviderRefundCallback({
				providerReference: "prov-order-1",
				transactionRef: "bank-code-123",
				isSuccess: true,
			});

			expect(res.success).toBe(true);
			expect(res.replayed).toBe(false);
			expect(paymentsRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "ref-pending-1",
					status: PaymentStatus.SUCCEEDED,
				})
			);
			expect(txnRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					paymentId: "ref-pending-1",
					status: PaymentTransactionStatus.SUCCEEDED,
					transactionRef: "bank-code-123",
				})
			);
		});

		it("returns replayed=true when callback is received for already SUCCEEDED refund (idempotent duplicate callback)", async () => {
			const alreadySucceeded = Object.assign(new Payment(), {
				id: "ref-succeeded-1",
				type: PaymentType.REFUND,
				status: PaymentStatus.SUCCEEDED,
				amount: "50.00",
				providerReference: "prov-order-1",
			});
			paymentsRepo.findOne.mockResolvedValue(alreadySucceeded);
			paymentsRepo.findForUpdate.mockResolvedValue(alreadySucceeded);

			const res = await service.reconcileProviderRefundCallback({
				providerReference: "prov-order-1",
				isSuccess: true,
			});

			expect(res.success).toBe(true);
			expect(res.replayed).toBe(true);
			// Does not re-save status or re-add transactions
			expect(paymentsRepo.save).not.toHaveBeenCalled();
			expect(txnRepo.save).not.toHaveBeenCalled();
		});
	});

	describe("getSettlementStatus & assertSettlementNotBlocked (BR-106, BR-336, BR-343)", () => {
		it("blocks settlement when an approved refund is pending provider completion", async () => {
			const pendingRefund = Object.assign(new Payment(), {
				id: "refund-pend-1",
				type: PaymentType.REFUND,
				status: PaymentStatus.PENDING,
				amount: "30.00",
			});
			paymentsRepo.findPaymentsByTripId.mockResolvedValue([charge, pendingRefund]);

			const status = await service.getSettlementStatus("trip-uuid-1");
			expect(status.isBlocked).toBe(true);
			expect(status.blockingPaymentIds).toContain("refund-pend-1");

			await expect(service.assertSettlementNotBlocked("trip-uuid-1")).rejects.toThrow(
				ConflictException
			);
		});

		it("allows settlement and reduces Held Funds / settlement base when refunds are succeeded", async () => {
			const succeededRefund = Object.assign(new Payment(), {
				id: "refund-succ-1",
				type: PaymentType.REFUND,
				status: PaymentStatus.SUCCEEDED,
				amount: "30.00",
			});
			paymentsRepo.findPaymentsByTripId.mockResolvedValue([charge, succeededRefund]);

			const status = await service.getSettlementStatus("trip-uuid-1");
			expect(status.isBlocked).toBe(false);
			expect(status.totalCharges).toBe("100.00");
			expect(status.totalSucceededRefunds).toBe("30.00");
			expect(status.heldFunds).toBe("70.00");
			expect(status.settlementBase).toBe("70.00");

			await expect(service.assertSettlementNotBlocked("trip-uuid-1")).resolves.toEqual(
				expect.objectContaining({ isBlocked: false, heldFunds: "70.00" })
			);
		});
	});
});
