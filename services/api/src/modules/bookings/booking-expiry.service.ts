import { Injectable, Logger } from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { BookingPaymentStatus, BookingStatus } from "../profiles/entities/booking.entity";
import { Trip } from "../trips/entities/trip.entity";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { TripsRepository } from "../trips/repositories/trips.repository";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { BookingsRepository } from "./bookings.repository";
import {
	BookingExpiryOutboxEvent,
	BookingExpiryOutboxEventType,
} from "./entities/booking-expiry-outbox-event.entity";
import { EquipmentReservationStatus } from "./entities/equipment-reservation.entity";
import { PaymentStatus, PaymentType } from "./entities/payment.entity";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { EquipmentReservationsRepository } from "./equipment-reservations.repository";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { PaymentsRepository } from "./payments.repository";

const EXPIRY_REASON = "payment_hold_expired";

export enum BookingExpiryResult {
	EXPIRED = "expired",
	NO_OP = "no_op",
}

@Injectable()
export class BookingExpiryService {
	private readonly logger = new Logger(BookingExpiryService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly bookingsRepository: BookingsRepository,
		private readonly tripsRepository: TripsRepository,
		private readonly paymentsRepository: PaymentsRepository,
		private readonly equipmentRepository: EquipmentReservationsRepository
	) {}

	async expireDueBookings(batchSize: number): Promise<void> {
		const candidateIds = await this.bookingsRepository.findExpiryCandidateIds(batchSize);
		for (const bookingId of candidateIds) {
			try {
				await this.expireBooking(bookingId);
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : "Unknown expiry error";
				this.logger.error(`Failed to expire Booking ${bookingId}: ${message}`);
			}
		}
	}

	async expireBooking(bookingId: string, evaluatedAtOverride?: Date): Promise<BookingExpiryResult> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const evaluatedAt = evaluatedAtOverride ?? (await this.captureDatabaseTime(manager));
			const bookings = manager.withRepository(this.bookingsRepository);
			const identity = await bookings.findOne({
				select: { id: true, tripId: true },
				where: { id: bookingId },
			});
			if (!identity) return BookingExpiryResult.NO_OP;

			const tripRepository = manager.getRepository(Trip);
			const trip = await tripRepository.findOne({
				where: { id: identity.tripId },
				lock: { mode: "pessimistic_write" },
			});
			if (!trip) {
				this.logger.warn(`Expiry skipped: Trip ${identity.tripId} was not found`);
				return BookingExpiryResult.NO_OP;
			}

			const booking = await bookings.findForUpdate(bookingId);
			if (!booking) return BookingExpiryResult.NO_OP;
			if (booking.tripId !== trip.id) {
				this.logger.warn(`Expiry skipped: Booking ${bookingId} Trip identity changed under lock`);
				return BookingExpiryResult.NO_OP;
			}

			const payments = await manager
				.withRepository(this.paymentsRepository)
				.findByBookingForUpdate(bookingId);
			const reservations = await manager
				.withRepository(this.equipmentRepository)
				.findByBookingForUpdate(bookingId);
			const hasSucceededCharge = payments.some(
				(payment) =>
					payment.type === PaymentType.CHARGE && payment.status === PaymentStatus.SUCCEEDED
			);
			const holdExpiresAt = booking.holdExpiresAt;
			const isEligible =
				booking.status === BookingStatus.PENDING_PAYMENT &&
				booking.paymentStatus === BookingPaymentStatus.UNPAID &&
				holdExpiresAt !== null &&
				holdExpiresAt.getTime() < evaluatedAt.getTime() &&
				!hasSucceededCharge;
			if (!isEligible) return BookingExpiryResult.NO_OP;

			const numPeople = booking.numPeople;
			if (
				numPeople === null ||
				!Number.isSafeInteger(numPeople) ||
				numPeople <= 0 ||
				trip.seatsTaken < numPeople
			) {
				throw new Error(`Booking ${bookingId} has inconsistent reserved capacity`);
			}

			const seatsTakenBefore = trip.seatsTaken;
			const activeReservations = reservations.filter(
				(reservation) => reservation.status === EquipmentReservationStatus.ACTIVE
			);
			for (const reservation of activeReservations) {
				// CTMS-172 MVP: active means pre-handover only for an unpaid pending hold.
				reservation.status = EquipmentReservationStatus.CANCELLED;
				reservation.cancelledAt = evaluatedAt;
				reservation.cancellationReason = EXPIRY_REASON;
			}

			booking.status = BookingStatus.EXPIRED;
			await bookings.save(booking);
			await manager.withRepository(this.tripsRepository).adjustSeatsTaken(trip.id, -numPeople);
			if (activeReservations.length > 0) {
				await manager.withRepository(this.equipmentRepository).save(activeReservations);
			}

			await manager.getRepository(AuditLog).save({
				actorId: null,
				action: "booking.expired",
				targetType: "booking",
				targetId: booking.id,
				before: {
					status: BookingStatus.PENDING_PAYMENT,
					paymentStatus: booking.paymentStatus,
					seatsTaken: seatsTakenBefore,
				},
				after: {
					bookingId: booking.id,
					tripId: trip.id,
					evaluatedAt: evaluatedAt.toISOString(),
					holdExpiresAt: holdExpiresAt.toISOString(),
					status: BookingStatus.EXPIRED,
					paymentStatus: booking.paymentStatus,
					succeededChargeExists: false,
					numPeople,
					seatsTakenBefore,
					seatsTakenAfter: seatsTakenBefore - numPeople,
					releasedSeatCount: numPeople,
					equipmentReservationIds: activeReservations.map((reservation) => reservation.id),
					equipmentReleasedCount: activeReservations.length,
				},
				reason: EXPIRY_REASON,
			});

			await manager.getRepository(BookingExpiryOutboxEvent).save({
				eventType: BookingExpiryOutboxEventType.BOOKING_EXPIRED,
				bookingId: booking.id,
				recipientId: booking.userId,
				tripId: trip.id,
				payload: {
					bookingId: booking.id,
					recipientId: booking.userId,
					tripId: trip.id,
					expiredAt: evaluatedAt.toISOString(),
					holdExpiresAt: holdExpiresAt.toISOString(),
				},
			});

			return BookingExpiryResult.EXPIRED;
		});
	}

	private async captureDatabaseTime(manager: EntityManager): Promise<Date> {
		const rows = (await manager.query(`SELECT clock_timestamp() AS "evaluatedAt"`)) as Array<{
			evaluatedAt: Date;
		}>;
		const evaluatedAt = rows[0]?.evaluatedAt;
		if (!(evaluatedAt instanceof Date)) throw new Error("Database did not return expiry time");
		return evaluatedAt;
	}
}
