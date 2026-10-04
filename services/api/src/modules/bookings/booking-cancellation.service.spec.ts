import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { DataSource, EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { Booking, BookingPaymentStatus, BookingStatus } from "../profiles/entities/booking.entity";
import { Trip } from "../trips/entities/trip.entity";
import type { TripsRepository } from "../trips/repositories/trips.repository";
import { BookingCancellationService } from "./booking-cancellation.service";
import type { BookingsRepository } from "./bookings.repository";
import { EquipmentReservationStatus } from "./entities/equipment-reservation.entity";
import { Payment, PaymentStatus, PaymentType } from "./entities/payment.entity";
import type { EquipmentReservationsRepository } from "./equipment-reservations.repository";
import type { PaymentsRepository } from "./payments.repository";

describe("BookingCancellationService", () => {
	let booking: Booking;
	let charge: Payment;
	let service: BookingCancellationService;
	let bookings: { findOne: jest.Mock; findForUpdate: jest.Mock; save: jest.Mock };
	let trips: { adjustSeatsTaken: jest.Mock };
	let tripRows: { findOne: jest.Mock };
	let payments: {
		findByBookingForUpdate: jest.Mock;
		findByIdempotencyKey: jest.Mock;
		create: jest.Mock;
		save: jest.Mock;
	};
	let equipment: { findByBookingForUpdate: jest.Mock };
	let audit: { save: jest.Mock };
	const now = new Date("2030-01-01T00:00:00Z");

	beforeEach(() => {
		jest.useFakeTimers().setSystemTime(now);
		booking = Object.assign(new Booking(), {
			id: "booking",
			tripId: "trip",
			userId: "owner",
			status: BookingStatus.CONFIRMED,
			paymentStatus: BookingPaymentStatus.PAID,
			numPeople: 2,
			tripStartsAtSnapshot: new Date("2030-01-03T00:00:00Z"),
			cancellationPolicySnapshot: {
				version: 1,
				rules: [{ minHoursBeforeTrip: 0, refundPercent: 50 }],
			},
		});
		charge = Object.assign(new Payment(), {
			id: "charge",
			type: PaymentType.CHARGE,
			status: PaymentStatus.SUCCEEDED,
			amount: "1.01",
		});
		bookings = {
			findOne: jest.fn().mockResolvedValue(booking),
			findForUpdate: jest.fn().mockResolvedValue(booking),
			save: jest.fn(async (value: Booking) => value),
		};
		trips = { adjustSeatsTaken: jest.fn().mockResolvedValue(undefined) };
		tripRows = { findOne: jest.fn().mockResolvedValue({ id: "trip", seatsTaken: 5 }) };
		payments = {
			findByBookingForUpdate: jest.fn().mockResolvedValue([charge]),
			findByIdempotencyKey: jest.fn().mockResolvedValue(null),
			create: jest.fn((value: Partial<Payment>) => Object.assign(new Payment(), value)),
			save: jest.fn(async (value: Payment) => Object.assign(value, { id: "refund" })),
		};
		equipment = { findByBookingForUpdate: jest.fn().mockResolvedValue([]) };
		audit = { save: jest.fn().mockResolvedValue(undefined) };
		const manager = {
			withRepository: (repository: object) => repository,
			getRepository: (entity: unknown) => {
				if (entity === Trip) return tripRows;
				if (entity === AuditLog) return audit;
				throw new Error("Unexpected repository");
			},
		} as unknown as EntityManager;
		const dataSource = {
			transaction: jest.fn(async (run: (manager: EntityManager) => unknown) => run(manager)),
		} as unknown as DataSource;
		service = new BookingCancellationService(
			dataSource,
			bookings as unknown as BookingsRepository,
			trips as unknown as TripsRepository,
			payments as unknown as PaymentsRepository,
			equipment as unknown as EquipmentReservationsRepository
		);
	});
	afterEach(() => jest.useRealTimers());
	const cancel = () => service.cancel("owner", "booking", {});
	function expectNoWrites() {
		expect(bookings.save).not.toHaveBeenCalled();
		expect(trips.adjustSeatsTaken).not.toHaveBeenCalled();
		expect(payments.save).not.toHaveBeenCalled();
		expect(audit.save).not.toHaveBeenCalled();
	}
	it("cancels paid participation, releases exactly numPeople and creates a pending refund", async () => {
		expect(await service.cancel("owner", "booking", { reason: "  changed plans " })).toEqual({
			bookingId: "booking",
			status: "cancelled",
			cancelledAt: now,
			paymentStatus: "paid",
			refund: { obligationId: "refund", amount: "0.51", status: "pending" },
		});
		expect(trips.adjustSeatsTaken).toHaveBeenCalledWith("trip", -2);
		expect(payments.save).toHaveBeenCalledWith(
			expect.objectContaining({
				type: PaymentType.REFUND,
				parentPaymentId: "charge",
				idempotencyKey: "ctms-174:cancel:booking",
			})
		);
		expect(audit.save).toHaveBeenCalledWith(
			expect.objectContaining({
				actorId: "owner",
				reason: "changed plans",
				after: expect.objectContaining({
					policy: expect.objectContaining({ exactRefundPercent: "50" }),
					seatReleaseCount: 2,
				}),
			})
		);
	});
	it("cancels confirmed free participation without a payment obligation", async () => {
		booking.paymentStatus = BookingPaymentStatus.NOT_REQUIRED;
		payments.findByBookingForUpdate.mockResolvedValue([]);
		expect((await cancel()).refund).toBeNull();
		expect(payments.save).not.toHaveBeenCalled();
		expect(booking.status).toBe(BookingStatus.CANCELLED);
	});
	it("allows a valid zero-refund policy", async () => {
		booking.cancellationPolicySnapshot = {
			version: 1,
			rules: [{ minHoursBeforeTrip: 0, refundPercent: 0 }],
		};
		expect((await cancel()).refund).toBeNull();
		expect(payments.save).not.toHaveBeenCalled();
		expect(trips.adjustSeatsTaken).toHaveBeenCalledTimes(1);
	});
	it("checks ownership even on cancelled replay", async () => {
		booking.status = BookingStatus.CANCELLED;
		await expect(service.cancel("other", "booking", {})).rejects.toBeInstanceOf(ForbiddenException);
		expectNoWrites();
		expect(payments.findByIdempotencyKey).not.toHaveBeenCalled();
	});
	it("returns 404 for a missing Booking", async () => {
		bookings.findOne.mockResolvedValue(null);
		await expect(cancel()).rejects.toBeInstanceOf(NotFoundException);
		expectNoWrites();
	});
	it.each([
		BookingStatus.PENDING_PAYMENT,
		BookingStatus.PENDING_RECONFIRMATION,
		BookingStatus.EXPIRED,
		BookingStatus.COMPLETED,
		null,
	])("rejects state %s", async (status) => {
		booking.status = status;
		await expect(cancel()).rejects.toBeInstanceOf(ConflictException);
		expectNoWrites();
	});
	it("rejects confirmed/unpaid", async () => {
		booking.paymentStatus = BookingPaymentStatus.UNPAID;
		await expect(cancel()).rejects.toBeInstanceOf(ConflictException);
		expectNoWrites();
	});
	it.each([now, new Date("2029-12-31T23:59:59Z")])(
		"rejects at and after Trip start",
		async (start) => {
			booking.tripStartsAtSnapshot = start;
			await expect(cancel()).rejects.toBeInstanceOf(ConflictException);
			expectNoWrites();
		}
	);
	it.each([
		null,
		{ refundHours: 48 },
		{ version: 1, rules: [{ minHoursBeforeTrip: 0, refundPercent: 101 }] },
	])("rejects unsupported policy %p", async (policy) => {
		booking.cancellationPolicySnapshot = policy;
		await expect(cancel()).rejects.toBeInstanceOf(ConflictException);
		expectNoWrites();
	});
	it("does not clamp inconsistent capacity", async () => {
		tripRows.findOne.mockResolvedValue({ id: "trip", seatsTaken: 1 });
		await expect(cancel()).rejects.toBeInstanceOf(ConflictException);
		expectNoWrites();
	});
	it("accounts for existing pending/succeeded refunds, excluding failed attempts", async () => {
		payments.findByBookingForUpdate.mockResolvedValue([
			charge,
			{
				type: PaymentType.REFUND,
				status: PaymentStatus.PENDING,
				parentPaymentId: charge.id,
				amount: "0.20",
			},
			{
				type: PaymentType.REFUND,
				status: PaymentStatus.SUCCEEDED,
				parentPaymentId: charge.id,
				amount: "0.30",
			},
			{
				type: PaymentType.REFUND,
				status: PaymentStatus.FAILED,
				parentPaymentId: charge.id,
				amount: "0.99",
			},
		]);
		expect((await cancel()).refund?.amount).toBe("0.01");
	});
	it("rejects an existing over-refund without releasing capacity", async () => {
		payments.findByBookingForUpdate.mockResolvedValue([
			charge,
			{
				type: PaymentType.REFUND,
				status: PaymentStatus.PENDING,
				parentPaymentId: charge.id,
				amount: "1.02",
			},
		]);
		await expect(cancel()).rejects.toBeInstanceOf(ConflictException);
		expectNoWrites();
	});
	it.each(["missing", "multiple"])(
		"rejects missing or ambiguous succeeded charge evidence",
		async (caseValue) => {
			payments.findByBookingForUpdate.mockResolvedValue(
				caseValue === "multiple" ? [charge, charge] : []
			);
			await expect(cancel()).rejects.toBeInstanceOf(ConflictException);
			expectNoWrites();
		}
	);
	it("replays the original result after the deadline without reevaluation or repeated side effects", async () => {
		const first = await cancel();
		payments.findByIdempotencyKey.mockResolvedValue({
			id: "refund",
			type: PaymentType.REFUND,
			status: PaymentStatus.SUCCEEDED,
			amount: "0.51",
		});
		jest.setSystemTime(new Date("2035-01-01T00:00:00Z"));
		booking.cancellationPolicySnapshot = null;
		expect(await cancel()).toEqual({
			...first,
			refund: { ...first.refund, status: PaymentStatus.SUCCEEDED },
		});
		expect(bookings.save).toHaveBeenCalledTimes(1);
		expect(trips.adjustSeatsTaken).toHaveBeenCalledTimes(1);
		expect(payments.save).toHaveBeenCalledTimes(1);
		expect(audit.save).toHaveBeenCalledTimes(1);
	});
	it("returns legacy cancellation without fabricating a timestamp", async () => {
		booking.status = BookingStatus.CANCELLED;
		booking.cancelledAt = null;
		expect((await cancel()).cancelledAt).toBeNull();
		expectNoWrites();
	});
	it("rejects ambiguous active equipment before any mutation", async () => {
		equipment.findByBookingForUpdate.mockResolvedValue([
			{ status: EquipmentReservationStatus.ACTIVE },
		]);
		await expect(cancel()).rejects.toBeInstanceOf(ConflictException);
		expectNoWrites();
	});
	it("leaves already-cancelled equipment unchanged", async () => {
		equipment.findByBookingForUpdate.mockResolvedValue([
			{ status: EquipmentReservationStatus.CANCELLED },
		]);
		await expect(cancel()).resolves.toMatchObject({ status: BookingStatus.CANCELLED });
	});
	it.each(["audit", "refund", "equipment"])(
		"propagates %s failure for transaction rollback",
		async (failure) => {
			const repo =
				failure === "audit"
					? audit.save
					: failure === "refund"
						? payments.save
						: equipment.findByBookingForUpdate;
			repo.mockRejectedValue(new Error("forced failure"));
			await expect(cancel()).rejects.toThrow("forced failure");
		}
	);
});
