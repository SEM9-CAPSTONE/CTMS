import { createHash } from "node:crypto";
import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import {
	type Booking,
	BookingPaymentStatus,
	BookingStatus,
} from "../profiles/entities/booking.entity";
import { Trip, TripStatus } from "../trips/entities/trip.entity";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { TripsRepository } from "../trips/repositories/trips.repository";
import { UserRole, UserStatus } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { BookingsRepository } from "./bookings.repository";
import {
	CancellationPolicyError,
	calculateCancellationRefund,
	evaluateCancellationPolicy,
} from "./cancellation-policy";
import type { CancelBookingResponseDto } from "./dto/cancel-booking-response.dto";
import type { CancelBookingDto } from "./dto/cancel-booking.dto";
import { EquipmentReservationStatus } from "./entities/equipment-reservation.entity";
import { type Payment, PaymentStatus, PaymentType } from "./entities/payment.entity";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { EquipmentReservationsRepository } from "./equipment-reservations.repository";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { PaymentsRepository } from "./payments.repository";

const refundKey = (bookingId: string): string => `ctms-174:cancel:${bookingId}`;

@Injectable()
export class BookingCancellationService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly bookingsRepository: BookingsRepository,
		private readonly tripsRepository: TripsRepository,
		private readonly paymentsRepository: PaymentsRepository,
		private readonly equipmentRepository: EquipmentReservationsRepository
	) {}

	async cancel(
		actorId: string,
		bookingId: string,
		dto: CancelBookingDto
	): Promise<CancelBookingResponseDto> {
		const requestTime = new Date();
		try {
			return await this.dataSource.transaction(async (manager: EntityManager) => {
				const bookings = manager.withRepository(this.bookingsRepository);
				const identity = await bookings.findOne({
					select: { id: true, tripId: true },
					where: { id: bookingId },
				});
				if (!identity) throw new NotFoundException("Booking not found");
				const trip = await manager.getRepository(Trip).findOne({
					select: {
						id: true,
						seatsTaken: true,
						startsAt: true,
						status: true,
						hostId: true,
						title: true,
					},
					where: { id: identity.tripId },
					lock: { mode: "pessimistic_write" },
				});
				const booking = await bookings.findForUpdate(bookingId);
				if (!booking) throw new NotFoundException("Booking not found");
				if (booking.userId !== actorId)
					throw new ForbiddenException("Only the Booking owner can cancel this Booking");
				if (!trip || booking.tripId !== trip.id)
					throw new ConflictException("Booking Trip identity is inconsistent");
				const payments = manager.withRepository(this.paymentsRepository);
				if (booking.status === BookingStatus.CANCELLED) {
					const obligation = await payments.findByIdempotencyKey(bookingId, refundKey(bookingId));
					return this.response(
						booking,
						obligation?.type === PaymentType.REFUND ? obligation : null
					);
				}
				if (
					booking.status !== BookingStatus.CONFIRMED ||
					(booking.paymentStatus !== BookingPaymentStatus.PAID &&
						booking.paymentStatus !== BookingPaymentStatus.NOT_REQUIRED)
				) {
					throw new ConflictException("Booking is not eligible for ordinary cancellation");
				}
				const numPeople = booking.numPeople;
				if (
					numPeople === null ||
					!Number.isSafeInteger(numPeople) ||
					numPeople <= 0 ||
					trip.seatsTaken < numPeople
				) {
					throw new ConflictException(
						"Booking seat reservation is inconsistent with Trip capacity"
					);
				}
				const policy = evaluateCancellationPolicy(
					booking.cancellationPolicySnapshot,
					requestTime,
					booking.tripStartsAtSnapshot
				);
				const paymentRows = await payments.findByBookingForUpdate(bookingId);
				const charge = this.eligibleCharge(booking, paymentRows);
				const previousRefunds = paymentRows.filter(
					(payment) =>
						payment.type === PaymentType.REFUND &&
						(payment.status === PaymentStatus.PENDING || payment.status === PaymentStatus.SUCCEEDED)
				);
				if (
					previousRefunds.some((refund) => !charge || refund.parentPaymentId !== charge.id) ||
					paymentRows.some((payment) => payment.idempotencyKey === refundKey(bookingId))
				) {
					throw new ConflictException(
						"Existing refund obligations are inconsistent with cancellation"
					);
				}
				const refundResult = calculateCancellationRefund(
					charge?.amount ?? "0.00",
					policy.refundPercent,
					previousRefunds.map((refund) => refund.amount)
				);
				// Validate the live Trip as well as the booking snapshot before releasing rentals.
				if (
					trip.status !== TripStatus.PUBLISHED ||
					!trip.startsAt ||
					trip.startsAt <= requestTime
				) {
					throw new ConflictException("Trip is no longer open for pre-departure cancellation");
				}
				const reason = dto.reason?.trim();
				if (!reason || reason.length > 255) {
					throw new UnprocessableEntityException(
						"Vui lòng nhập lý do hủy chuyến, tối đa 255 ký tự."
					);
				}
				const equipment = manager.withRepository(this.equipmentRepository);
				const reservations = await equipment.findByBookingForUpdate(bookingId);
				const activeReservations = reservations.filter(
					(reservation) => reservation.status === EquipmentReservationStatus.ACTIVE
				);
				for (const reservation of activeReservations) {
					reservation.status = EquipmentReservationStatus.CANCELLED;
					reservation.cancelledAt = requestTime;
					reservation.cancellationReason = reason;
					await equipment.save(reservation);
				}
				const before = {
					status: booking.status,
					paymentStatus: booking.paymentStatus,
					seatsTaken: trip.seatsTaken,
				};
				booking.status = BookingStatus.CANCELLED;
				booking.cancelledAt = requestTime;
				booking.cancellationReason = reason;
				await bookings.save(booking);
				await manager.withRepository(this.tripsRepository).adjustSeatsTaken(trip.id, -numPeople);
				let obligation: Payment | null = null;
				if (charge && refundResult.amount !== "0.00") {
					obligation = await payments.save(
						payments.create({
							bookingId,
							type: PaymentType.REFUND,
							status: PaymentStatus.PENDING,
							parentPaymentId: charge.id,
							amount: refundResult.amount,
							idempotencyKey: refundKey(bookingId),
							requestFingerprint: createHash("sha256")
								.update(
									JSON.stringify({ bookingId, chargeId: charge.id, amount: refundResult.amount })
								)
								.digest("hex"),
							providerReference: null,
						})
					);
				}
				await manager.getRepository(AuditLog).save({
					actorId,
					action: "booking.cancelled",
					targetType: "booking",
					targetId: bookingId,
					before,
					after: {
						bookingId,
						status: booking.status,
						paymentStatus: booking.paymentStatus,
						requestTime: requestTime.toISOString(),
						cancelledAt: requestTime.toISOString(),
						tripStartsAtSnapshot: booking.tripStartsAtSnapshot?.toISOString(),
						policy,
						seatReleaseCount: numPeople,
						seatsTaken: trip.seatsTaken - numPeople,
						equipment: {
							releasedCount: activeReservations.length,
							alreadyCancelledCount: reservations.length - activeReservations.length,
						},
						refund: {
							...refundResult,
							parentPaymentId: charge?.id ?? null,
							obligationId: obligation?.id ?? null,
						},
					},
					reason,
				});
				// Transactional inbox rows become visible only after commit.
				await manager.query(
					`INSERT INTO booking_cancellation_notices
					(recipient_id, booking_id, trip_id, trip_title, camper_name, reason)
					SELECT DISTINCT recipient.id, $1::uuid, $2::uuid, $3::varchar, camper.full_name, $4::varchar
					FROM users recipient
					LEFT JOIN user_roles role ON role.user_id = recipient.id
					LEFT JOIN users camper ON camper.id = $5
					WHERE recipient.status = $6
					AND (recipient.id = $7 OR recipient.role = $8 OR role.role = $8)
					ON CONFLICT (booking_id, recipient_id) DO NOTHING`,
					[
						bookingId,
						trip.id,
						trip.title,
						reason,
						actorId,
						UserStatus.ACTIVE,
						trip.hostId,
						UserRole.ADMIN,
					]
				);
				return this.response(booking, obligation);
			});
		} catch (error: unknown) {
			if (error instanceof CancellationPolicyError) throw new ConflictException(error.message);
			throw error;
		}
	}

	private eligibleCharge(booking: Booking, payments: Payment[]): Payment | null {
		const charges = payments.filter(
			(payment) => payment.type === PaymentType.CHARGE && payment.status === PaymentStatus.SUCCEEDED
		);
		if (booking.paymentStatus === BookingPaymentStatus.NOT_REQUIRED && charges.length === 0)
			return null;
		if (booking.paymentStatus !== BookingPaymentStatus.PAID || charges.length !== 1) {
			throw new ConflictException("Booking must have one unambiguous eligible succeeded charge");
		}
		return charges[0];
	}

	private response(booking: Booking, obligation: Payment | null): CancelBookingResponseDto {
		return {
			bookingId: booking.id,
			status: BookingStatus.CANCELLED,
			cancelledAt: booking.cancelledAt ?? null,
			paymentStatus: booking.paymentStatus,
			refund: obligation
				? { obligationId: obligation.id, amount: obligation.amount, status: obligation.status }
				: null,
		};
	}
}
