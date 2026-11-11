import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { BookingPaymentStatus, BookingStatus } from "../profiles/entities/booking.entity";
import { Trip, TripStatus } from "../trips/entities/trip.entity";
import { UserRole } from "../users/entities/user.entity";
import { BookingMemberStatus } from "./booking-member-status.enum";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { BookingMembersRepository } from "./booking-members.repository";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { BookingsRepository } from "./bookings.repository";
import type { BatchCompleteBookingsResponseDto } from "./dto/batch-complete-bookings-response.dto";
import type { CompleteBookingResponseDto } from "./dto/complete-booking-response.dto";
import type { BookingMember } from "./entities/booking-member.entity";

@Injectable()
export class BookingCompletionService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly bookingsRepository: BookingsRepository,
		private readonly bookingMembersRepository: BookingMembersRepository
	) {}

	/**
	 * Complete a single booking.
	 * Authorizes the actor (Host of Trip or Admin), validates trip completion and member check-in states,
	 * atomically transitions booking status to completed, and records server-authoritative completed_at.
	 */
	async completeBooking(
		actor: AuthenticatedUser,
		bookingId: string
	): Promise<CompleteBookingResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const bookingsRepo = manager.withRepository(this.bookingsRepository);
			const booking = await bookingsRepo.findForUpdate(bookingId);
			if (!booking) {
				throw new NotFoundException("Booking not found");
			}

			// Idempotency: If already completed, return existing state safely
			if (booking.status === BookingStatus.COMPLETED && booking.completedAt) {
				return {
					id: booking.id,
					status: BookingStatus.COMPLETED,
					completedAt: booking.completedAt.toISOString(),
				};
			}

			// Validate Trip and Authorization
			const trip = await manager.getRepository(Trip).findOne({
				where: { id: booking.tripId },
			});
			if (!trip) {
				throw new NotFoundException("Trip not found");
			}

			this.assertAuthorization(actor, trip);

			// BR-115: Trip must have status = completed
			if (trip.status !== TripStatus.COMPLETED) {
				throw new ConflictException(
					"Booking can only be completed after the Trip itself has reached completed status"
				);
			}

			// Validate Booking state
			if (booking.status !== BookingStatus.CONFIRMED) {
				throw new ConflictException(
					`Booking in status '${booking.status}' cannot transition to completed`
				);
			}

			if (
				booking.paymentStatus !== BookingPaymentStatus.PAID &&
				booking.paymentStatus !== BookingPaymentStatus.NOT_REQUIRED
			) {
				throw new ConflictException("Booking payment obligations are not fully resolved");
			}

			// Validate members check-in / participation outcome
			const membersRepo = manager.withRepository(this.bookingMembersRepository);
			const members = await membersRepo.find({ where: { bookingId: booking.id } });
			this.assertMembersHandled(members);

			// Capture server/database time atomically
			const completedAt = await this.captureDatabaseTime(manager);
			const previousStatus = booking.status;

			booking.status = BookingStatus.COMPLETED;
			booking.completedAt = completedAt;
			await bookingsRepo.save(booking);

			await manager.getRepository(AuditLog).save({
				actorId: actor.userId,
				action: "booking.completed",
				targetType: "booking",
				targetId: booking.id,
				before: { status: previousStatus },
				after: {
					status: BookingStatus.COMPLETED,
					completedAt: completedAt.toISOString(),
				},
				reason: "booking_operational_completion",
			});

			return {
				id: booking.id,
				status: BookingStatus.COMPLETED,
				completedAt: completedAt.toISOString(),
			};
		});
	}

	/**
	 * Complete all eligible confirmed bookings for a completed Trip.
	 */
	async completeTripBookings(
		actor: AuthenticatedUser,
		tripId: string
	): Promise<BatchCompleteBookingsResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const trip = await manager.getRepository(Trip).findOne({
				where: { id: tripId },
			});
			if (!trip) {
				throw new NotFoundException("Trip not found");
			}

			this.assertAuthorization(actor, trip);

			if (trip.status !== TripStatus.COMPLETED) {
				throw new ConflictException(
					"Bookings can only be completed after the Trip itself has reached completed status"
				);
			}

			const bookingsRepo = manager.withRepository(this.bookingsRepository);
			const membersRepo = manager.withRepository(this.bookingMembersRepository);

			const bookings = await bookingsRepo.find({
				where: { tripId: trip.id },
				order: { createdAt: "ASC" },
			});

			const completedBookingIds: string[] = [];
			let skippedCount = 0;
			const completedAt = await this.captureDatabaseTime(manager);

			for (const booking of bookings) {
				if (booking.status === BookingStatus.COMPLETED) {
					// Already completed, skip without error
					skippedCount++;
					continue;
				}

				if (booking.status !== BookingStatus.CONFIRMED) {
					skippedCount++;
					continue;
				}

				if (
					booking.paymentStatus !== BookingPaymentStatus.PAID &&
					booking.paymentStatus !== BookingPaymentStatus.NOT_REQUIRED
				) {
					skippedCount++;
					continue;
				}

				const members = await membersRepo.find({ where: { bookingId: booking.id } });
				const allMembersHandled = members.every(
					(m: BookingMember) =>
						m.memberStatus === BookingMemberStatus.JOINED ||
						m.memberStatus === BookingMemberStatus.NO_SHOW
				);

				if (!allMembersHandled) {
					skippedCount++;
					continue;
				}

				const previousStatus = booking.status;
				booking.status = BookingStatus.COMPLETED;
				booking.completedAt = completedAt;
				await bookingsRepo.save(booking);

				await manager.getRepository(AuditLog).save({
					actorId: actor.userId,
					action: "booking.completed",
					targetType: "booking",
					targetId: booking.id,
					before: { status: previousStatus },
					after: {
						status: BookingStatus.COMPLETED,
						completedAt: completedAt.toISOString(),
					},
					reason: "batch_trip_bookings_completion",
				});

				completedBookingIds.push(booking.id);
			}

			return {
				tripId: trip.id,
				completedCount: completedBookingIds.length,
				completedBookingIds,
				skippedCount,
			};
		});
	}

	private assertAuthorization(actor: AuthenticatedUser, trip: Trip): void {
		const isAdmin = actor.roles.includes(UserRole.ADMIN);
		const isHost = actor.roles.includes(UserRole.HOST) && trip.hostId === actor.userId;

		if (!isAdmin && !isHost) {
			throw new ForbiddenException(
				"Only the owning Host or an Administrator can complete bookings for this Trip"
			);
		}
	}

	private assertMembersHandled(members: BookingMember[]): void {
		const unhandled = members.filter(
			(m) =>
				m.memberStatus !== BookingMemberStatus.JOINED &&
				m.memberStatus !== BookingMemberStatus.NO_SHOW
		);

		if (unhandled.length > 0) {
			throw new ConflictException(
				`Cannot complete booking: ${unhandled.length} member(s) have not been checked in or marked as no-show`
			);
		}
	}

	private async captureDatabaseTime(manager: EntityManager): Promise<Date> {
		const result = (await manager.query("SELECT CURRENT_TIMESTAMP as now")) as Array<{
			now: Date;
		}>;
		return new Date(result[0].now);
	}
}
