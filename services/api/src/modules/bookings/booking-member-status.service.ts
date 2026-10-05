import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { BookingStatus } from "../profiles/entities/booking.entity";
import { TripPorter, TripPorterStatus } from "../profiles/entities/trip-porter.entity";
import { Trip, TripStatus } from "../trips/entities/trip.entity";
import { UserRole } from "../users/entities/user.entity";
import { BookingMemberStatus } from "./booking-member-status.enum";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { BookingMembersRepository } from "./booking-members.repository";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { BookingsRepository } from "./bookings.repository";
import type { BookingMemberResponseDto } from "./dto/booking-member-response.dto";
import type { UpdateBookingMemberStatusDto } from "./dto/update-booking-member-status.dto";
import type { BookingMember } from "./entities/booking-member.entity";

type AuthorizationPath = "host" | "porter";

const ELIGIBLE_TRIP_STATUSES = new Set<TripStatus>([TripStatus.PUBLISHED, TripStatus.ONGOING]);

@Injectable()
export class BookingMemberStatusService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly bookingsRepository: BookingsRepository,
		private readonly bookingMembersRepository: BookingMembersRepository
	) {}

	async updateStatus(
		actor: AuthenticatedUser,
		tripId: string,
		bookingId: string,
		memberId: string,
		dto: UpdateBookingMemberStatusDto
	): Promise<BookingMemberResponseDto> {
		return this.dataSource.transaction(async (manager) => {
			const transactionNow = await this.captureDatabaseTime(manager);
			const trip = await manager.getRepository(Trip).findOne({
				where: { id: tripId },
				lock: { mode: "pessimistic_write" },
			});
			if (!trip) throw new NotFoundException("Trip not found");

			const authorizationPath = await this.authorizeActor(manager, actor, trip);
			if (!ELIGIBLE_TRIP_STATUSES.has(trip.status)) {
				throw new ConflictException("Trip is not open for member status updates");
			}

			const booking = await manager
				.withRepository(this.bookingsRepository)
				.findForUpdateInTrip(bookingId, trip.id);
			if (!booking) throw new NotFoundException("Booking not found");
			if (booking.status !== BookingStatus.CONFIRMED) {
				throw new ConflictException("Booking is not eligible for participation updates");
			}

			const members = manager.withRepository(this.bookingMembersRepository);
			const member = await members.findForUpdateInBooking(memberId, booking.id);
			if (!member) throw new NotFoundException("Booking member not found");

			if (member.memberStatus === dto.status) return this.toResponse(member);
			if (member.memberStatus !== BookingMemberStatus.REGISTERED) {
				throw new ConflictException("Booking member status does not allow this transition");
			}

			this.assertTiming(dto.status, transactionNow, trip.startsAt);
			const previousStatus = member.memberStatus;
			member.memberStatus = dto.status;
			member.statusUpdatedBy = actor.userId;
			if (dto.status === BookingMemberStatus.JOINED) member.checkedInAt = transactionNow;
			else member.noShowAt = transactionNow;

			const saved = await members.save(member);
			await manager.getRepository(AuditLog).save({
				actorId: actor.userId,
				action:
					dto.status === BookingMemberStatus.JOINED
						? "booking_member.joined"
						: "booking_member.no_show",
				targetType: "booking_member",
				targetId: member.id,
				before: { memberStatus: previousStatus },
				after: {
					authorizationPath,
					tripId: trip.id,
					bookingId: booking.id,
					bookingMemberId: member.id,
					memberStatus: dto.status,
					transitionedAt: transactionNow.toISOString(),
				},
				reason: "manual_member_status_update",
			});

			return this.toResponse(saved);
		});
	}

	private async authorizeActor(
		manager: EntityManager,
		actor: AuthenticatedUser,
		trip: Trip
	): Promise<AuthorizationPath> {
		if (actor.roles.includes(UserRole.HOST) && trip.hostId === actor.userId) return "host";

		if (actor.roles.includes(UserRole.PORTER)) {
			const assignment = await manager.getRepository(TripPorter).findOne({
				where: {
					tripId: trip.id,
					porterId: actor.userId,
				},
				lock: { mode: "pessimistic_write" },
			});
			if (assignment?.status === TripPorterStatus.ASSIGNED) return "porter";
		}

		throw new ForbiddenException("Actor is not authorized for this Trip");
	}

	private assertTiming(status: BookingMemberStatus, now: Date, startsAt: Date): void {
		if (status === BookingMemberStatus.JOINED && now.getTime() > startsAt.getTime()) {
			throw new ConflictException("The Trip check-in window has closed");
		}
		if (status === BookingMemberStatus.NO_SHOW && now.getTime() <= startsAt.getTime()) {
			throw new ConflictException("The no-show threshold has not passed");
		}
	}

	private async captureDatabaseTime(manager: EntityManager): Promise<Date> {
		const rows = (await manager.query("SELECT CURRENT_TIMESTAMP AS now")) as Array<{
			now: Date | string;
		}>;
		const now = rows[0]?.now;
		if (!now) throw new Error("Failed to capture database time");
		return now instanceof Date ? now : new Date(now);
	}

	private toResponse(member: BookingMember): BookingMemberResponseDto {
		return {
			id: member.id,
			bookingId: member.bookingId,
			userId: member.userId,
			isPrimary: member.isPrimary,
			memberStatus: member.memberStatus,
			checkedInAt: member.checkedInAt,
			noShowAt: member.noShowAt,
			leftAt: member.leftAt,
			statusUpdatedBy: member.statusUpdatedBy,
			createdAt: member.createdAt,
			updatedAt: member.updatedAt,
		};
	}
}
