import {
	ConflictException,
	ForbiddenException,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import type { DataSource, EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { Booking, BookingPaymentStatus, BookingStatus } from "../profiles/entities/booking.entity";
import type { BookingsRepository } from "./bookings.repository";
import {
	Payment,
	PaymentStatus,
	PaymentTransaction,
	PaymentTransactionStatus,
} from "./entities/payment.entity";
import type { PaymentsRepository } from "./payments.repository";
import { PaymentsService } from "./payments.service";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const BOOKING_ID = "77777777-7777-4777-8777-777777777777";
const TRIP_ID = "33333333-3333-4333-8333-333333333333";

function payableBooking(overrides: Record<string, unknown> = {}): Booking {
	return Object.assign(new Booking(), {
		id: BOOKING_ID,
		tripId: TRIP_ID,
		userId: USER_ID,
		numPeople: 2,
		status: BookingStatus.PENDING_PAYMENT,
		paymentStatus: BookingPaymentStatus.UNPAID,
		holdExpiresAt: new Date("2029-09-01T00:15:00.000Z"),
		tripStartsAtSnapshot: new Date("2030-10-10T01:00:00.000Z"),
		tripEndsAtSnapshot: new Date("2030-10-10T10:00:00.000Z"),
		basePrice: "1000000.00",
		totalAmount: "1000000.00",
		cancellationPolicySnapshot: null,
		createdAt: new Date("2029-09-01T00:00:00.000Z"),
		...overrides,
	});
}

describe("PaymentsService", () => {
	let paymentsRepository: {
		lockIdempotencyKey: jest.Mock;
		findByIdempotencyKey: jest.Mock;
		create: jest.Mock;
		save: jest.Mock;
		findForUpdate: jest.Mock;
	};
	let bookingsRepository: {
		findForUpdate: jest.Mock;
		findOneBy: jest.Mock;
		save: jest.Mock;
	};
	let auditRepository: { save: jest.Mock };
	let transactionRepository: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock };
	let service: PaymentsService;

	beforeEach(() => {
		jest.useFakeTimers().setSystemTime(new Date("2029-09-01T00:00:00.000Z"));

		paymentsRepository = {
			lockIdempotencyKey: jest.fn().mockResolvedValue(undefined),
			findByIdempotencyKey: jest.fn().mockResolvedValue(null),
			create: jest.fn((value) => Object.assign(new Payment(), value)),
			save: jest.fn(async (value: Payment) =>
				Object.assign(value, {
					id: value.id ?? "payment-1",
					createdAt: value.createdAt ?? new Date("2029-09-01T00:00:00.000Z"),
				})
			),
			findForUpdate: jest.fn().mockResolvedValue(null),
		};

		bookingsRepository = {
			findForUpdate: jest.fn().mockResolvedValue(payableBooking()),
			findOneBy: jest.fn().mockResolvedValue(payableBooking()),
			save: jest.fn(async (value: Booking) => value),
		};

		auditRepository = { save: jest.fn().mockResolvedValue(undefined) };
		transactionRepository = {
			create: jest.fn((value) => Object.assign(new PaymentTransaction(), value)),
			save: jest.fn(async (value) => value),
			findOne: jest.fn().mockResolvedValue(null),
		};

		const repositoryByInstance = new Map<object, object>([
			[paymentsRepository as object, paymentsRepository],
			[bookingsRepository as object, bookingsRepository],
		]);

		const manager = {
			withRepository: jest.fn((repository: object) => repositoryByInstance.get(repository)),
			getRepository: jest.fn((entityClass: unknown) => {
				if (entityClass === PaymentTransaction) return transactionRepository;
				if (entityClass === AuditLog) return auditRepository;
				throw new Error(`Unexpected entity repository request: ${String(entityClass)}`);
			}),
		} as unknown as EntityManager;

		const dataSource = {
			transaction: jest.fn(async (callback: (value: EntityManager) => unknown) =>
				callback(manager)
			),
		} as unknown as DataSource;

		service = new PaymentsService(
			paymentsRepository as unknown as PaymentsRepository,
			bookingsRepository as unknown as BookingsRepository,
			dataSource
		);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("successfully charges a pending payable booking, confirms booking, and audits outcome", async () => {
		const result = await service.pay(USER_ID, BOOKING_ID, "pay-attempt-1", { method: "CARD" });

		expect(result).toMatchObject({
			paymentId: "payment-1",
			bookingId: BOOKING_ID,
			paymentStatus: PaymentStatus.SUCCEEDED,
			amount: "1000000.00",
			bookingStatus: BookingStatus.CONFIRMED,
			bookingPaymentStatus: BookingPaymentStatus.PAID,
		});

		expect(paymentsRepository.lockIdempotencyKey).toHaveBeenCalledWith(BOOKING_ID, "pay-attempt-1");
		expect(bookingsRepository.findForUpdate).toHaveBeenCalledWith(BOOKING_ID);

		expect(bookingsRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({
				id: BOOKING_ID,
				status: BookingStatus.CONFIRMED,
				paymentStatus: BookingPaymentStatus.PAID,
			})
		);

		expect(transactionRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({
				paymentId: "payment-1",
				status: PaymentTransactionStatus.SUCCEEDED,
			})
		);

		expect(auditRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({
				actorId: USER_ID,
				action: "booking.payment_charge",
				targetType: "payment",
				targetId: "payment-1",
				reason: "camper_pay_booking_succeeded",
			})
		);
	});

	it("replays existing payment when same idempotency key and matching fingerprint are sent", async () => {
		const dto = { method: "CARD" };
		// First call saves payment
		await service.pay(USER_ID, BOOKING_ID, "pay-replay", dto);

		const savedPayment = paymentsRepository.save.mock.results[0].value as Promise<Payment>;
		const resolvedSaved = await savedPayment;
		paymentsRepository.findByIdempotencyKey.mockResolvedValue(resolvedSaved);
		bookingsRepository.findOneBy.mockResolvedValue(
			payableBooking({
				status: BookingStatus.CONFIRMED,
				paymentStatus: BookingPaymentStatus.PAID,
			})
		);

		paymentsRepository.save.mockClear();
		bookingsRepository.save.mockClear();
		auditRepository.save.mockClear();

		const replay = await service.pay(USER_ID, BOOKING_ID, "pay-replay", dto);

		expect(replay.paymentId).toBe("payment-1");
		expect(replay.bookingStatus).toBe(BookingStatus.CONFIRMED);
		expect(replay.bookingPaymentStatus).toBe(BookingPaymentStatus.PAID);

		expect(paymentsRepository.save).not.toHaveBeenCalled();
		expect(bookingsRepository.save).not.toHaveBeenCalled();
		expect(auditRepository.save).not.toHaveBeenCalled();
	});

	it("rejects idempotency key reused with a different payload", async () => {
		await service.pay(USER_ID, BOOKING_ID, "pay-key-1", { method: "CARD" });

		const savedPayment = await (paymentsRepository.save.mock.results[0].value as Promise<Payment>);
		paymentsRepository.findByIdempotencyKey.mockResolvedValue(savedPayment);

		await expect(
			service.pay(USER_ID, BOOKING_ID, "pay-key-1", { method: "BANK_TRANSFER" })
		).rejects.toBeInstanceOf(ConflictException);

		expect(bookingsRepository.save).toHaveBeenCalledTimes(1); // Only from the first call
	});

	it.each([undefined, "", "   ", "has spaces", "x".repeat(129)])(
		"rejects malformed Idempotency-Key %p",
		async (invalidKey) => {
			await expect(
				service.pay(USER_ID, BOOKING_ID, invalidKey, { method: "CARD" })
			).rejects.toBeInstanceOf(UnprocessableEntityException);

			expect(paymentsRepository.lockIdempotencyKey).not.toHaveBeenCalled();
			expect(paymentsRepository.save).not.toHaveBeenCalled();
		}
	);

	it("rejects caller who is not the Booking owner", async () => {
		await expect(
			service.pay(OTHER_USER_ID, BOOKING_ID, "pay-owner-check", { method: "CARD" })
		).rejects.toBeInstanceOf(ForbiddenException);

		expect(paymentsRepository.save).not.toHaveBeenCalled();
		expect(bookingsRepository.save).not.toHaveBeenCalled();
	});

	it("returns 404 when Booking does not exist", async () => {
		bookingsRepository.findForUpdate.mockResolvedValue(null);

		await expect(
			service.pay(USER_ID, BOOKING_ID, "pay-not-found", { method: "CARD" })
		).rejects.toBeInstanceOf(NotFoundException);

		expect(paymentsRepository.save).not.toHaveBeenCalled();
	});

	it.each([
		[BookingStatus.CONFIRMED, "Booking has already been paid and confirmed"],
		[BookingStatus.CANCELLED, "Booking has been cancelled and cannot be paid"],
		[BookingStatus.EXPIRED, "Booking has expired and cannot be paid"],
		[BookingStatus.COMPLETED, "Booking is completed and cannot be re-paid"],
	])("rejects non-payable booking with status %s", async (status, expectedMessage) => {
		bookingsRepository.findForUpdate.mockResolvedValue(
			payableBooking({
				status,
				paymentStatus:
					status === BookingStatus.CONFIRMED
						? BookingPaymentStatus.PAID
						: BookingPaymentStatus.UNPAID,
			})
		);

		const promise = service.pay(USER_ID, BOOKING_ID, `pay-${status}`, { method: "CARD" });
		await expect(promise).rejects.toBeInstanceOf(ConflictException);
		await expect(promise).rejects.toThrow(expectedMessage);

		expect(paymentsRepository.save).not.toHaveBeenCalled();
		expect(bookingsRepository.save).not.toHaveBeenCalled();
	});

	it("rejects payment when status is PENDING_PAYMENT but paymentStatus is not UNPAID", async () => {
		bookingsRepository.findForUpdate.mockResolvedValue(
			payableBooking({
				status: BookingStatus.PENDING_PAYMENT,
				paymentStatus: BookingPaymentStatus.PAID,
			})
		);

		await expect(
			service.pay(USER_ID, BOOKING_ID, "pay-invalid-payment-status", { method: "CARD" })
		).rejects.toBeInstanceOf(ConflictException);

		expect(paymentsRepository.save).not.toHaveBeenCalled();
		expect(bookingsRepository.save).not.toHaveBeenCalled();
	});

	it("handles provider charge failure by marking payment failed, leaving booking unconfirmed, and throwing ConflictException", async () => {
		const serviceWithFailedProvider = service as unknown as {
			chargeViaProvider: () => Promise<{
				succeeded: boolean;
				transactionRef: string | null;
				rawPayload: Record<string, unknown>;
			}>;
		};
		serviceWithFailedProvider.chargeViaProvider = jest.fn().mockResolvedValue({
			succeeded: false,
			transactionRef: null,
			rawPayload: { error: "insufficient_funds" },
		});

		await expect(
			service.pay(USER_ID, BOOKING_ID, "pay-failed-provider", { method: "CARD" })
		).rejects.toBeInstanceOf(ConflictException);

		// Payment status was updated to FAILED
		expect(paymentsRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({
				status: PaymentStatus.FAILED,
			})
		);

		// Booking state was NOT confirmed or marked as paid
		expect(bookingsRepository.save).not.toHaveBeenCalled();

		// Audit log was still written for failure observation
		expect(auditRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({
				actorId: USER_ID,
				action: "booking.payment_charge",
				reason: "camper_pay_booking_failed",
			})
		);
	});

	it.each([
		["Payment insert", () => paymentsRepository.save.mockRejectedValue(new Error("db error"))],
		[
			"Booking update",
			() => bookingsRepository.save.mockRejectedValue(new Error("booking save error")),
		],
		["Audit log", () => auditRepository.save.mockRejectedValue(new Error("audit error"))],
	])("propagates %s failure so the enclosing transaction rolls back", async (_name, arrange) => {
		arrange();

		await expect(
			service.pay(USER_ID, BOOKING_ID, `pay-fail-${_name}`, { method: "CARD" })
		).rejects.toThrow();
	});
});
