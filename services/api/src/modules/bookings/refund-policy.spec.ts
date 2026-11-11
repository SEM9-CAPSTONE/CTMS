import { ConflictException } from "@nestjs/common";
import { Booking, BookingStatus } from "../profiles/entities/booking.entity";
import { Trip, TripStatus } from "../trips/entities/trip.entity";
import { Payment, PaymentStatus, PaymentType } from "./entities/payment.entity";
import {
	RefundOrigin,
	calculateRemainingRefundableAmount,
	evaluateSettlementBlockers,
	validatePreTripProcessingWindow,
	validateRefundEligibility,
} from "./refund-policy";

describe("RefundPolicy (CTMS-035)", () => {
	const tripStartsAt = new Date("2030-05-10T08:00:00Z");
	const tripEndsAt = new Date("2030-05-12T18:00:00Z");

	function createTrip(overrides?: Partial<Trip>): Trip {
		return Object.assign(new Trip(), {
			id: "trip-1",
			status: TripStatus.PUBLISHED,
			startsAt: tripStartsAt,
			endsAt: tripEndsAt,
			...overrides,
		});
	}

	function createBooking(overrides?: Partial<Booking>): Booking {
		return Object.assign(new Booking(), {
			id: "booking-1",
			tripId: "trip-1",
			userId: "camper-1",
			status: BookingStatus.CONFIRMED,
			tripStartsAtSnapshot: tripStartsAt,
			tripEndsAtSnapshot: tripEndsAt,
			...overrides,
		});
	}

	describe("validateRefundEligibility (BR-103)", () => {
		describe("Camper Pre-Trip Cancellation", () => {
			it("allows refund when Booking was cancelled before Trip starts_at", () => {
				const trip = createTrip();
				const cancelledAt = new Date("2030-05-09T10:00:00Z"); // 22h before start
				const booking = createBooking({
					status: BookingStatus.CANCELLED,
					cancelledAt,
				});

				const result = validateRefundEligibility({
					booking,
					trip,
					origin: RefundOrigin.CAMPER_CANCELLATION,
					requestTime: cancelledAt,
				});

				expect(result.eligible).toBe(true);
				expect(result.policySource).toBe("booking_cancellation_policy");
			});

			it("rejects when Booking is not cancelled", () => {
				const trip = createTrip();
				const booking = createBooking({ status: BookingStatus.CONFIRMED });

				expect(() =>
					validateRefundEligibility({
						booking,
						trip,
						origin: RefundOrigin.CAMPER_CANCELLATION,
						requestTime: new Date("2030-05-09T10:00:00Z"),
					})
				).toThrow(ConflictException);
			});

			it("rejects when cancellation occurred at or after Trip starts_at", () => {
				const trip = createTrip();
				const cancelledAt = new Date("2030-05-10T08:00:00Z"); // exactly starts_at
				const booking = createBooking({
					status: BookingStatus.CANCELLED,
					cancelledAt,
				});

				expect(() =>
					validateRefundEligibility({
						booking,
						trip,
						origin: RefundOrigin.CAMPER_CANCELLATION,
						requestTime: cancelledAt,
					})
				).toThrow("Camper cancellation refund request is outside the pre-Trip cancellation window");
			});

			it("rejects when requestTime is after Trip starts_at", () => {
				const trip = createTrip();
				const cancelledAt = new Date("2030-05-10T09:00:00Z"); // 1 hour after start
				const booking = createBooking({
					status: BookingStatus.CANCELLED,
					cancelledAt,
				});

				expect(() =>
					validateRefundEligibility({
						booking,
						trip,
						origin: RefundOrigin.CAMPER_CANCELLATION,
						requestTime: cancelledAt,
					})
				).toThrow(ConflictException);
			});
		});

		describe("Camper Post-Completion Complaint", () => {
			it("allows complaint refund when submitted within 24 hours after completion", () => {
				const trip = createTrip({ status: TripStatus.COMPLETED });
				const booking = createBooking({ status: BookingStatus.COMPLETED });
				const complaintTime = new Date("2030-05-13T10:00:00Z"); // 16h after endsAt

				const result = validateRefundEligibility({
					booking,
					trip,
					origin: RefundOrigin.CAMPER_COMPLAINT,
					requestTime: complaintTime,
				});

				expect(result.eligible).toBe(true);
				expect(result.policySource).toBe("camper_complaint_resolution");
			});

			it("rejects complaint refund when Booking is not in COMPLETED state", () => {
				const trip = createTrip({ status: TripStatus.COMPLETED });
				const booking = createBooking({ status: BookingStatus.CONFIRMED });

				expect(() =>
					validateRefundEligibility({
						booking,
						trip,
						origin: RefundOrigin.CAMPER_COMPLAINT,
						requestTime: new Date("2030-05-13T10:00:00Z"),
					})
				).toThrow("Complaint refund request requires completed participation");
			});

			it("rejects complaint refund submitted more than 24 hours after completion", () => {
				const trip = createTrip({ status: TripStatus.COMPLETED });
				const booking = createBooking({ status: BookingStatus.COMPLETED });
				const lateTime = new Date("2030-05-13T19:00:01Z"); // 25 hours after completion

				expect(() =>
					validateRefundEligibility({
						booking,
						trip,
						origin: RefundOrigin.CAMPER_COMPLAINT,
						requestTime: lateTime,
					})
				).toThrow("Camper complaint refund request is outside the 24-hour post-completion window");
			});
		});

		describe("Host and System Trip Cancellation", () => {
			it("allows Host cancellation refund when Trip is cancelled, without Camper window limits", () => {
				const trip = createTrip({ status: TripStatus.CANCELLED });
				const booking = createBooking({ status: BookingStatus.CONFIRMED });
				const pastStartTime = new Date("2030-05-11T12:00:00Z"); // after start time

				const result = validateRefundEligibility({
					booking,
					trip,
					origin: RefundOrigin.HOST_TRIP_CANCELLATION,
					requestTime: pastStartTime,
				});

				expect(result.eligible).toBe(true);
				expect(result.policySource).toBe("host_trip_cancellation_policy");
			});

			it("allows System cancellation refund when Trip is cancelled", () => {
				const trip = createTrip({ status: TripStatus.CANCELLED });
				const booking = createBooking({ status: BookingStatus.CONFIRMED });

				const result = validateRefundEligibility({
					booking,
					trip,
					origin: RefundOrigin.SYSTEM_TRIP_CANCELLATION,
					requestTime: new Date(),
				});

				expect(result.eligible).toBe(true);
				expect(result.policySource).toBe("system_trip_cancellation_policy");
			});

			it("rejects Host/System cancellation refund if Trip is not cancelled", () => {
				const trip = createTrip({ status: TripStatus.PUBLISHED });
				const booking = createBooking({ status: BookingStatus.CONFIRMED });

				expect(() =>
					validateRefundEligibility({
						booking,
						trip,
						origin: RefundOrigin.HOST_TRIP_CANCELLATION,
						requestTime: new Date(),
					})
				).toThrow("Host Trip cancellation refund requires cancelled Trip status");
			});
		});

		describe("Late Payment After Expiry", () => {
			it("allows refund when Booking was EXPIRED", () => {
				const trip = createTrip();
				const booking = createBooking({ status: BookingStatus.EXPIRED });

				const result = validateRefundEligibility({
					booking,
					trip,
					origin: RefundOrigin.LATE_PAYMENT_AFTER_EXPIRY,
					requestTime: new Date(),
				});

				expect(result.eligible).toBe(true);
				expect(result.policySource).toBe("late_payment_expiry_policy");
			});
		});
	});

	describe("validatePreTripProcessingWindow (BR-104)", () => {
		it("passes when submitted within 24 hours of refund request", () => {
			const requestedAt = new Date("2030-05-01T10:00:00Z");
			const processingTime = new Date("2030-05-02T09:59:00Z"); // 23h 59m

			expect(() => validatePreTripProcessingWindow(requestedAt, processingTime)).not.toThrow();
		});

		it("throws when submitted after 24 hours of refund request", () => {
			const requestedAt = new Date("2030-05-01T10:00:00Z");
			const processingTime = new Date("2030-05-02T10:01:00Z"); // 24h 1m

			expect(() => validatePreTripProcessingWindow(requestedAt, processingTime)).toThrow(
				"Pre-Trip refund submission exceeds the required 24-hour processing window"
			);
		});
	});

	describe("calculateRemainingRefundableAmount (PB AC-4, BR-105)", () => {
		it("calculates remaining refundable amount with no prior refunds", () => {
			const res = calculateRemainingRefundableAmount("100.00", []);
			expect(res.remainingAmount).toBe("100.00");
			expect(res.committedMinor).toBe(0n);
		});

		it("subtracts pending and succeeded refunds from the charge amount", () => {
			const res = calculateRemainingRefundableAmount("100.00", [
				{ amount: "30.00", status: PaymentStatus.SUCCEEDED },
				{ amount: "20.00", status: PaymentStatus.PENDING },
			]);
			expect(res.remainingAmount).toBe("50.00");
			expect(res.committedMinor).toBe(5000n);
		});

		it("ignores failed refunds when computing committed amount (PB AC-7)", () => {
			const res = calculateRemainingRefundableAmount("100.00", [
				{ amount: "40.00", status: PaymentStatus.FAILED },
				{ amount: "25.00", status: PaymentStatus.SUCCEEDED },
			]);
			expect(res.remainingAmount).toBe("75.00");
		});

		it("excludes current refund if updating existing obligation", () => {
			const res = calculateRemainingRefundableAmount(
				"100.00",
				[
					{ id: "ref-1", amount: "50.00", status: PaymentStatus.PENDING },
					{ id: "ref-2", amount: "20.00", status: PaymentStatus.SUCCEEDED },
				],
				"ref-1"
			);
			expect(res.remainingAmount).toBe("80.00");
		});

		it("throws ConflictException if committed refunds exceed charge amount", () => {
			expect(() =>
				calculateRemainingRefundableAmount("100.00", [
					{ amount: "70.00", status: PaymentStatus.SUCCEEDED },
					{ amount: "40.00", status: PaymentStatus.PENDING },
				])
			).toThrow("Committed refunds already exceed the eligible charge amount");
		});
	});

	describe("evaluateSettlementBlockers (BR-106, BR-336, BR-343)", () => {
		function payment(type: PaymentType, status: PaymentStatus, amount: string, id = "p1"): Payment {
			return Object.assign(new Payment(), { id, type, status, amount });
		}

		it("blocks settlement when an approved refund is pending provider completion", () => {
			const payments = [
				payment(PaymentType.CHARGE, PaymentStatus.SUCCEEDED, "200.00", "c1"),
				payment(PaymentType.REFUND, PaymentStatus.PENDING, "50.00", "r1"),
			];

			const result = evaluateSettlementBlockers(payments);

			expect(result.isBlocked).toBe(true);
			expect(result.blockingPaymentIds).toContain("r1");
			expect(result.heldFunds).toBe("200.00"); // Pending refund does not reduce held funds yet
		});

		it("unblocks settlement and reduces Held Funds when refund is succeeded", () => {
			const payments = [
				payment(PaymentType.CHARGE, PaymentStatus.SUCCEEDED, "200.00", "c1"),
				payment(PaymentType.REFUND, PaymentStatus.SUCCEEDED, "50.00", "r1"),
			];

			const result = evaluateSettlementBlockers(payments);

			expect(result.isBlocked).toBe(false);
			expect(result.blockingPaymentIds).toEqual([]);
			expect(result.totalCharges).toBe("200.00");
			expect(result.totalSucceededRefunds).toBe("50.00");
			expect(result.heldFunds).toBe("150.00");
			expect(result.settlementBase).toBe("150.00");
		});

		it("does not treat failed refunds as succeeded or blocking", () => {
			const payments = [
				payment(PaymentType.CHARGE, PaymentStatus.SUCCEEDED, "200.00", "c1"),
				payment(PaymentType.REFUND, PaymentStatus.FAILED, "50.00", "r1"),
			];

			const result = evaluateSettlementBlockers(payments);

			expect(result.isBlocked).toBe(false);
			expect(result.heldFunds).toBe("200.00");
		});

		it("blocks settlement when external complaint claims are in blocking state", () => {
			const payments = [payment(PaymentType.CHARGE, PaymentStatus.SUCCEEDED, "200.00", "c1")];
			const claims = [{ id: "claim-1", status: "reviewing" }];

			const result = evaluateSettlementBlockers(payments, claims);

			expect(result.isBlocked).toBe(true);
			expect(result.blockingReasons[0]).toContain("claim-1 is in blocking state 'reviewing'");
		});
	});
});
