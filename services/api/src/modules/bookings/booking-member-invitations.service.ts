import { randomBytes } from "node:crypto";
import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	Optional,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { DataSource, type EntityManager } from "typeorm";
import { normalizeEmail } from "../../shared/utils/normalize.util";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { type Booking, BookingStatus } from "../profiles/entities/booking.entity";
import { TrekkingRoute } from "../trekking-routes/entities/trekking-route.entity";
import { Trip } from "../trips/entities/trip.entity";
import { User, UserStatus } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { BookingMemberInvitationEmailService } from "./booking-member-invitation-email.service";
import { BookingMemberStatus } from "./booking-member-status.enum";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { BookingMembersRepository } from "./booking-members.repository";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { BookingsRepository } from "./bookings.repository";
import type {
	BookingInvitationItemDto,
	BookingMembersWorkspaceResponseDto,
	BookingRosterMemberItemDto,
	CreateBookingMemberInvitationDto,
	CreateBookingMemberInvitationResponseDto,
	MyPendingBookingInvitationDto,
	PublicBookingInvitationResponseDto,
	RespondBookingInvitationResponseDto,
} from "./dto/booking-member-invitation.dto";
import {
	BookingMemberInvitation,
	BookingMemberInvitationStatus,
} from "./entities/booking-member-invitation.entity";
import { BookingMember } from "./entities/booking-member.entity";

const ELIGIBLE_BOOKING_STATUSES = new Set<BookingStatus>([
	BookingStatus.PENDING_PAYMENT,
	BookingStatus.CONFIRMED,
]);

interface MemberWithUserRow {
	id: string;
	userId: string | null;
	email: string | null;
	fullName: string | null;
	isPrimary: boolean;
	memberStatus: BookingMemberStatus;
	createdAt: Date;
}

interface InvitationWithUserRow {
	id: string;
	bookingId: string;
	invitedEmail: string;
	invitedUserFullName: string | null;
	hasAccount: boolean;
	status: BookingMemberInvitationStatus;
	token: string;
	expiresAt: Date;
	respondedAt: Date | null;
	createdAt: Date;
}

interface PendingInvitationForUserRow {
	id: string;
	token: string;
	bookingId: string;
	tripId: string;
	tripTitle: string;
	routeName: string | null;
	tripStartsAt: Date;
	tripEndsAt: Date;
	inviterName: string;
	invitedEmail: string;
	expiresAt: Date;
	createdAt: Date;
}

@Injectable()
export class BookingMemberInvitationsService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly bookingsRepository: BookingsRepository,
		private readonly bookingMembersRepository: BookingMembersRepository,
		@Optional() private readonly emailService?: BookingMemberInvitationEmailService
	) {}

	async getWorkspace(
		actorId: string,
		bookingId: string
	): Promise<BookingMembersWorkspaceResponseDto> {
		return this.dataSource.transaction(async (manager) => {
			const booking = await manager.withRepository(this.bookingsRepository).findOne({
				where: { id: bookingId },
			});
			if (!booking) throw new NotFoundException("Booking not found");
			if (booking.userId !== actorId) {
				throw new ForbiddenException("Only the Booking owner can manage invitations");
			}

			const trip = await manager.getRepository(Trip).findOne({
				where: { id: booking.tripId },
				select: { id: true, startsAt: true },
			});
			if (!trip) throw new NotFoundException("Trip not found");

			await this.ensurePrimaryMember(manager, booking);
			await this.expireStalePendingInvitations(manager, bookingId);
			return this.buildWorkspace(manager, booking, trip.startsAt);
		});
	}

	async createInvitation(
		actorId: string,
		bookingId: string,
		dto: CreateBookingMemberInvitationDto
	): Promise<CreateBookingMemberInvitationResponseDto> {
		const invitedEmail = normalizeEmail(dto.email);
		let emailDispatchContext: {
			to: string;
			inviterName: string;
			tripTitle: string;
			tripStartsAt: Date;
			token: string;
			hasAccount: boolean;
		} | null = null;

		const committed = await this.dataSource.transaction(async (manager) => {
			const booking = await manager
				.withRepository(this.bookingsRepository)
				.findForUpdate(bookingId);
			if (!booking) throw new NotFoundException("Booking not found");
			if (booking.userId !== actorId) {
				throw new ForbiddenException("Only the Booking owner can invite members");
			}
			this.assertBookingEditable(booking);

			const trip = await manager.getRepository(Trip).findOne({
				where: { id: booking.tripId },
				select: { id: true, title: true, startsAt: true },
			});
			if (!trip) throw new NotFoundException("Trip not found");
			if (trip.startsAt <= new Date()) {
				throw new ConflictException("Trip has already started");
			}

			await this.ensurePrimaryMember(manager, booking);
			await this.expireStalePendingInvitations(manager, bookingId);

			const owner = await manager.getRepository(User).findOne({
				where: { id: booking.userId },
				select: { id: true, email: true, fullName: true },
			});
			if (owner?.email && normalizeEmail(owner.email) === invitedEmail) {
				throw new ConflictException("The Booking owner is already included in this Booking");
			}

			const existingUser = await manager
				.getRepository(User)
				.createQueryBuilder("u")
				.select(["u.id", "u.email", "u.fullName", "u.status"])
				.where("LOWER(u.email) = :email", { email: invitedEmail })
				.getOne();

			if (existingUser && existingUser.status !== UserStatus.ACTIVE) {
				throw new ConflictException("Invited account is not active");
			}

			if (existingUser) {
				const activeSameBooking = await manager.getRepository(BookingMember).findOne({
					where: { bookingId, userId: existingUser.id },
				});
				if (activeSameBooking && activeSameBooking.memberStatus !== BookingMemberStatus.REMOVED) {
					throw new ConflictException("This person is already a member of this Booking");
				}

				const alreadyOnTrip = await this.isUserActiveMemberOnTrip(
					manager,
					booking.tripId,
					existingUser.id
				);
				if (alreadyOnTrip) {
					throw new ConflictException("This person is already participating in this Trip");
				}
			}

			const existingPending = await manager
				.getRepository(BookingMemberInvitation)
				.createQueryBuilder("inv")
				.where("inv.bookingId = :bookingId", { bookingId })
				.andWhere("LOWER(inv.invitedEmail) = :email", { email: invitedEmail })
				.andWhere("inv.status = :status", { status: BookingMemberInvitationStatus.PENDING })
				.getOne();
			if (existingPending) {
				throw new ConflictException("An active invitation already exists for this email");
			}

			const { activeMemberCount, pendingInvitationCount } = await this.countReservedSlots(
				manager,
				bookingId
			);
			const numPeople = booking.numPeople ?? 1;
			if (activeMemberCount + pendingInvitationCount >= numPeople) {
				throw new ConflictException("All Booking slots are already assigned or invited");
			}

			const token = randomBytes(24).toString("hex");
			const invitationRepo = manager.getRepository(BookingMemberInvitation);
			const saved = await invitationRepo.save(
				invitationRepo.create({
					bookingId,
					invitedByUserId: actorId,
					invitedEmail,
					invitedUserId: existingUser?.id ?? null,
					token,
					status: BookingMemberInvitationStatus.PENDING,
					expiresAt: trip.startsAt,
					respondedAt: null,
				})
			);

			await manager.getRepository(AuditLog).save({
				actorId,
				action: "booking.member_invited",
				targetType: "booking",
				targetId: bookingId,
				before: null,
				after: {
					invitationId: saved.id,
					invitedEmail,
					invitedUserId: existingUser?.id ?? null,
					hasAccount: Boolean(existingUser),
				},
				reason: "camper_invite_booking_member",
			});

			emailDispatchContext = {
				to: invitedEmail,
				inviterName: owner?.fullName?.trim() || owner?.email || "Chủ đơn đặt chỗ",
				tripTitle: trip.title,
				tripStartsAt: trip.startsAt,
				token: saved.token,
				hasAccount: Boolean(existingUser),
			};

			const workspace = await this.buildWorkspace(manager, booking, trip.startsAt);
			const invitationView = this.toInvitationDto({
				id: saved.id,
				bookingId: saved.bookingId,
				invitedEmail: saved.invitedEmail,
				invitedUserFullName: existingUser?.fullName ?? null,
				hasAccount: Boolean(existingUser),
				status: saved.status,
				token: saved.token,
				expiresAt: saved.expiresAt,
				respondedAt: saved.respondedAt,
				createdAt: saved.createdAt,
			});

			return { invitation: invitationView, workspace };
		});

		let emailSent = false;
		if (emailDispatchContext && this.emailService) {
			const ctx = emailDispatchContext as {
				to: string;
				inviterName: string;
				tripTitle: string;
				tripStartsAt: Date;
				token: string;
				hasAccount: boolean;
			};
			const inviteUrl = this.emailService.buildInviteUrl(ctx.token);
			if (inviteUrl) {
				emailSent = await this.emailService.trySendInvitation({
					to: ctx.to,
					inviterName: ctx.inviterName,
					tripTitle: ctx.tripTitle,
					tripStartsAt: ctx.tripStartsAt,
					inviteUrl,
					hasAccount: ctx.hasAccount,
				});
			}
		}

		return {
			invitation: committed.invitation,
			emailSent,
			workspace: committed.workspace,
		};
	}

	async revokeInvitation(
		actorId: string,
		bookingId: string,
		invitationId: string
	): Promise<BookingMembersWorkspaceResponseDto> {
		return this.dataSource.transaction(async (manager) => {
			const booking = await manager
				.withRepository(this.bookingsRepository)
				.findForUpdate(bookingId);
			if (!booking) throw new NotFoundException("Booking not found");
			if (booking.userId !== actorId) {
				throw new ForbiddenException("Only the Booking owner can revoke invitations");
			}
			this.assertBookingEditable(booking);

			const trip = await manager.getRepository(Trip).findOne({
				where: { id: booking.tripId },
				select: { id: true, startsAt: true },
			});
			if (!trip) throw new NotFoundException("Trip not found");
			if (trip.startsAt <= new Date()) {
				throw new ConflictException("Trip has already started");
			}

			const invitationRepo = manager.getRepository(BookingMemberInvitation);
			const invitation = await invitationRepo.findOne({
				where: { id: invitationId, bookingId },
				lock: { mode: "pessimistic_write" },
			});
			if (!invitation) throw new NotFoundException("Invitation not found");
			if (invitation.status !== BookingMemberInvitationStatus.PENDING) {
				throw new ConflictException("Only pending invitations can be revoked");
			}

			invitation.status = BookingMemberInvitationStatus.REVOKED;
			invitation.respondedAt = new Date();
			await invitationRepo.save(invitation);

			await manager.getRepository(AuditLog).save({
				actorId,
				action: "booking.member_invitation_revoked",
				targetType: "booking",
				targetId: bookingId,
				before: { invitationId: invitation.id, status: BookingMemberInvitationStatus.PENDING },
				after: { invitationId: invitation.id, status: BookingMemberInvitationStatus.REVOKED },
				reason: "camper_revoke_booking_invitation",
			});

			return this.buildWorkspace(manager, booking, trip.startsAt);
		});
	}

	async removeMember(
		actorId: string,
		bookingId: string,
		memberId: string
	): Promise<BookingMembersWorkspaceResponseDto> {
		return this.dataSource.transaction(async (manager) => {
			const booking = await manager
				.withRepository(this.bookingsRepository)
				.findForUpdate(bookingId);
			if (!booking) throw new NotFoundException("Booking not found");
			if (booking.userId !== actorId) {
				throw new ForbiddenException("Only the Booking owner can remove members");
			}
			this.assertBookingEditable(booking);

			const trip = await manager.getRepository(Trip).findOne({
				where: { id: booking.tripId },
				select: { id: true, startsAt: true },
			});
			if (!trip) throw new NotFoundException("Trip not found");
			if (trip.startsAt <= new Date()) {
				throw new ConflictException("Trip has already started");
			}

			const membersRepo = manager.withRepository(this.bookingMembersRepository);
			const member = await membersRepo.findForUpdateInBooking(memberId, bookingId);
			if (!member) throw new NotFoundException("Booking member not found");
			if (member.isPrimary) {
				throw new ConflictException("The primary Booking owner cannot be removed");
			}
			if (member.memberStatus !== BookingMemberStatus.REGISTERED) {
				throw new ConflictException("Only registered companion members can be removed");
			}

			const previousStatus = member.memberStatus;
			member.memberStatus = BookingMemberStatus.REMOVED;
			member.statusUpdatedBy = actorId;
			await membersRepo.save(member);

			await manager.getRepository(AuditLog).save({
				actorId,
				action: "booking.member_removed",
				targetType: "booking",
				targetId: bookingId,
				before: { memberId: member.id, userId: member.userId, memberStatus: previousStatus },
				after: {
					memberId: member.id,
					userId: member.userId,
					memberStatus: BookingMemberStatus.REMOVED,
				},
				reason: "camper_remove_booking_member",
			});

			return this.buildWorkspace(manager, booking, trip.startsAt);
		});
	}

	async listMyPendingInvitations(actorId: string): Promise<MyPendingBookingInvitationDto[]> {
		const user = await this.dataSource.getRepository(User).findOne({
			where: { id: actorId },
			select: { id: true, email: true, status: true },
		});
		if (!user?.email || user.status !== UserStatus.ACTIVE) {
			return [];
		}

		const normalized = normalizeEmail(user.email);
		const rows = (await this.dataSource.query(
			`SELECT
				inv."id",
				inv."token",
				inv."booking_id" AS "bookingId",
				b."trip_id" AS "tripId",
				t."title" AS "tripTitle",
				r."name" AS "routeName",
				t."starts_at" AS "tripStartsAt",
				t."ends_at" AS "tripEndsAt",
				COALESCE(NULLIF(BTRIM(inviter."full_name"), ''), inviter."email", 'Người đặt chỗ') AS "inviterName",
				inv."invited_email" AS "invitedEmail",
				inv."expires_at" AS "expiresAt",
				inv."created_at" AS "createdAt"
			 FROM "booking_member_invitations" inv
			 INNER JOIN "bookings" b ON b."id" = inv."booking_id"
			 INNER JOIN "trips" t ON t."id" = b."trip_id"
			 LEFT JOIN "trekking_routes" r ON r."id" = t."route_id"
			 LEFT JOIN "users" inviter ON inviter."id" = inv."invited_by_user_id"
			 WHERE LOWER(inv."invited_email") = $1
			   AND inv."status" = 'pending'
			   AND inv."expires_at" > CURRENT_TIMESTAMP
			   AND t."starts_at" > CURRENT_TIMESTAMP
			   AND b."status" IN ('pending_payment', 'confirmed')
			 ORDER BY inv."created_at" DESC, inv."id" DESC`,
			[normalized]
		)) as PendingInvitationForUserRow[];

		return rows.map((row) => ({
			id: row.id,
			token: row.token,
			bookingId: row.bookingId,
			tripId: row.tripId,
			tripTitle: row.tripTitle,
			routeName: row.routeName,
			tripStartsAt: new Date(row.tripStartsAt).toISOString(),
			tripEndsAt: new Date(row.tripEndsAt).toISOString(),
			inviterName: row.inviterName,
			invitedEmail: row.invitedEmail,
			expiresAt: new Date(row.expiresAt).toISOString(),
			createdAt: new Date(row.createdAt).toISOString(),
		}));
	}

	async getPublicInvitation(token: string): Promise<PublicBookingInvitationResponseDto> {
		const invitation = await this.dataSource.getRepository(BookingMemberInvitation).findOne({
			where: { token },
		});
		if (!invitation) throw new NotFoundException("Invitation not found");

		const [booking, inviter, existingUser] = await Promise.all([
			this.bookingsRepository.findOne({ where: { id: invitation.bookingId } }),
			this.dataSource.getRepository(User).findOne({
				where: { id: invitation.invitedByUserId },
				select: { id: true, fullName: true, email: true },
			}),
			this.dataSource
				.getRepository(User)
				.createQueryBuilder("u")
				.select(["u.id", "u.status"])
				.where("LOWER(u.email) = :email", { email: normalizeEmail(invitation.invitedEmail) })
				.andWhere("u.status = :status", { status: UserStatus.ACTIVE })
				.getOne(),
		]);
		if (!booking) throw new NotFoundException("Booking not found");

		const trip = await this.dataSource.getRepository(Trip).findOne({
			where: { id: booking.tripId },
			select: { id: true, title: true, routeId: true, startsAt: true, endsAt: true },
		});
		if (!trip) throw new NotFoundException("Trip not found");

		const route = trip.routeId
			? await this.dataSource.getRepository(TrekkingRoute).findOne({
					where: { id: trip.routeId },
					select: { id: true, name: true },
				})
			: null;

		const now = new Date();
		let effectiveStatus = invitation.status;
		let unavailableReason: string | null = null;
		if (effectiveStatus === BookingMemberInvitationStatus.PENDING) {
			if (!ELIGIBLE_BOOKING_STATUSES.has(booking.status as BookingStatus)) {
				effectiveStatus = BookingMemberInvitationStatus.EXPIRED;
				unavailableReason = "Đơn đặt chỗ không còn hiệu lực.";
			} else if (trip.startsAt <= now || invitation.expiresAt <= now) {
				effectiveStatus = BookingMemberInvitationStatus.EXPIRED;
				unavailableReason = "Chuyến đi đã bắt đầu hoặc lời mời đã hết hạn.";
			}
		} else if (effectiveStatus === BookingMemberInvitationStatus.ACCEPTED) {
			unavailableReason = "Lời mời này đã được chấp nhận.";
		} else if (effectiveStatus === BookingMemberInvitationStatus.DECLINED) {
			unavailableReason = "Lời mời này đã bị từ chối.";
		} else if (effectiveStatus === BookingMemberInvitationStatus.REVOKED) {
			unavailableReason = "Chủ đơn đã thu hồi lời mời này.";
		} else {
			unavailableReason = "Lời mời này đã hết hạn.";
		}

		return {
			id: invitation.id,
			bookingId: booking.id,
			tripId: trip.id,
			tripTitle: trip.title,
			routeName: route?.name ?? null,
			tripStartsAt: trip.startsAt.toISOString(),
			tripEndsAt: trip.endsAt.toISOString(),
			inviterName: inviter?.fullName?.trim() || inviter?.email || "Người đặt chỗ",
			invitedEmail: invitation.invitedEmail,
			hasAccount: Boolean(existingUser),
			status: effectiveStatus,
			canRespond: effectiveStatus === BookingMemberInvitationStatus.PENDING,
			unavailableReason,
			expiresAt: invitation.expiresAt.toISOString(),
		};
	}

	async acceptInvitation(
		actorId: string,
		token: string
	): Promise<RespondBookingInvitationResponseDto> {
		return this.dataSource.transaction(async (manager) => {
			const invitationRepo = manager.getRepository(BookingMemberInvitation);
			const invitation = await invitationRepo.findOne({
				where: { token },
				lock: { mode: "pessimistic_write" },
			});
			if (!invitation) throw new NotFoundException("Invitation not found");

			const booking = await manager
				.withRepository(this.bookingsRepository)
				.findForUpdate(invitation.bookingId);
			if (!booking) throw new NotFoundException("Booking not found");

			const user = await manager.getRepository(User).findOne({
				where: { id: actorId },
				select: { id: true, email: true, status: true },
			});
			if (!user || user.status !== UserStatus.ACTIVE) {
				throw new ForbiddenException("Active DiTrek account is required to accept an invitation");
			}
			if (!user.email || normalizeEmail(user.email) !== normalizeEmail(invitation.invitedEmail)) {
				throw new ForbiddenException(
					"This invitation was sent to a different email address than your signed-in account"
				);
			}

			if (invitation.status === BookingMemberInvitationStatus.ACCEPTED) {
				if (invitation.invitedUserId === actorId) {
					return {
						id: invitation.id,
						bookingId: booking.id,
						tripId: booking.tripId,
						status: invitation.status,
					};
				}
				throw new ConflictException("Invitation has already been accepted");
			}
			if (invitation.status !== BookingMemberInvitationStatus.PENDING) {
				throw new ConflictException("Invitation is no longer pending");
			}

			this.assertBookingEditable(booking);
			const trip = await manager.getRepository(Trip).findOne({
				where: { id: booking.tripId },
				select: { id: true, startsAt: true },
			});
			if (!trip) throw new NotFoundException("Trip not found");
			const now = new Date();
			if (trip.startsAt <= now || invitation.expiresAt <= now) {
				invitation.status = BookingMemberInvitationStatus.EXPIRED;
				await invitationRepo.save(invitation);
				throw new ConflictException("Invitation has expired or Trip has already started");
			}

			if (booking.userId === actorId) {
				throw new ConflictException("The Booking owner is already included in this Booking");
			}

			await this.ensurePrimaryMember(manager, booking);

			const alreadyOnTrip = await this.isUserActiveMemberOnTrip(manager, booking.tripId, actorId);
			if (alreadyOnTrip) {
				throw new ConflictException("You are already participating in this Trip");
			}

			const membersRepo = manager.withRepository(this.bookingMembersRepository);
			const existingMember = await membersRepo.findOne({
				where: { bookingId: booking.id, userId: actorId },
			});
			const activeCount = await this.countActiveMembers(manager, booking.id);
			const numPeople = booking.numPeople ?? 1;
			if (activeCount >= numPeople) {
				throw new ConflictException("Booking member capacity is already full");
			}

			let savedMember: BookingMember;
			if (existingMember) {
				if (existingMember.memberStatus !== BookingMemberStatus.REMOVED) {
					throw new ConflictException("You are already a member of this Booking");
				}
				existingMember.memberStatus = BookingMemberStatus.REGISTERED;
				existingMember.statusUpdatedBy = actorId;
				savedMember = await membersRepo.save(existingMember);
			} else {
				savedMember = await membersRepo.save(
					membersRepo.create({
						bookingId: booking.id,
						userId: actorId,
						isPrimary: false,
						memberStatus: BookingMemberStatus.REGISTERED,
					})
				);
			}

			invitation.status = BookingMemberInvitationStatus.ACCEPTED;
			invitation.invitedUserId = actorId;
			invitation.respondedAt = now;
			await invitationRepo.save(invitation);

			await manager.getRepository(AuditLog).save({
				actorId,
				action: "booking.member_invitation_accepted",
				targetType: "booking",
				targetId: booking.id,
				before: { invitationId: invitation.id, status: BookingMemberInvitationStatus.PENDING },
				after: {
					invitationId: invitation.id,
					memberId: savedMember.id,
					userId: actorId,
					status: BookingMemberInvitationStatus.ACCEPTED,
				},
				reason: "camper_accept_booking_invitation",
			});

			return {
				id: invitation.id,
				bookingId: booking.id,
				tripId: booking.tripId,
				status: invitation.status,
			};
		});
	}

	async declineInvitation(
		actorId: string,
		token: string
	): Promise<RespondBookingInvitationResponseDto> {
		return this.dataSource.transaction(async (manager) => {
			const invitationRepo = manager.getRepository(BookingMemberInvitation);
			const invitation = await invitationRepo.findOne({
				where: { token },
				lock: { mode: "pessimistic_write" },
			});
			if (!invitation) throw new NotFoundException("Invitation not found");

			const booking = await manager.withRepository(this.bookingsRepository).findOne({
				where: { id: invitation.bookingId },
			});
			if (!booking) throw new NotFoundException("Booking not found");

			const user = await manager.getRepository(User).findOne({
				where: { id: actorId },
				select: { id: true, email: true, status: true },
			});
			if (!user?.email || user.status !== UserStatus.ACTIVE) {
				throw new ForbiddenException("Active account required");
			}
			if (normalizeEmail(user.email) !== normalizeEmail(invitation.invitedEmail)) {
				throw new ForbiddenException(
					"This invitation was sent to a different email address than your signed-in account"
				);
			}
			if (invitation.status !== BookingMemberInvitationStatus.PENDING) {
				throw new ConflictException("Invitation is no longer pending");
			}

			invitation.status = BookingMemberInvitationStatus.DECLINED;
			invitation.invitedUserId = actorId;
			invitation.respondedAt = new Date();
			await invitationRepo.save(invitation);

			await manager.getRepository(AuditLog).save({
				actorId,
				action: "booking.member_invitation_declined",
				targetType: "booking",
				targetId: booking.id,
				before: { invitationId: invitation.id, status: BookingMemberInvitationStatus.PENDING },
				after: { invitationId: invitation.id, status: BookingMemberInvitationStatus.DECLINED },
				reason: "camper_decline_booking_invitation",
			});

			return {
				id: invitation.id,
				bookingId: booking.id,
				tripId: booking.tripId,
				status: invitation.status,
			};
		});
	}

	private assertBookingEditable(booking: Booking): void {
		if (
			booking.numPeople === null ||
			booking.numPeople < 1 ||
			!booking.status ||
			!ELIGIBLE_BOOKING_STATUSES.has(booking.status)
		) {
			throw new ConflictException("Booking is not eligible for member management");
		}
	}

	private async ensurePrimaryMember(manager: EntityManager, booking: Booking): Promise<void> {
		const membersRepo = manager.withRepository(this.bookingMembersRepository);
		const existingPrimary = await membersRepo.findOne({
			where: { bookingId: booking.id, isPrimary: true },
		});
		if (existingPrimary) return;

		await membersRepo.save(
			membersRepo.create({
				bookingId: booking.id,
				userId: booking.userId,
				isPrimary: true,
				memberStatus: BookingMemberStatus.REGISTERED,
			})
		);
	}

	private async expireStalePendingInvitations(
		manager: EntityManager,
		bookingId: string
	): Promise<void> {
		await manager.query(
			`UPDATE "booking_member_invitations"
			 SET "status" = 'expired', "updated_at" = CURRENT_TIMESTAMP
			 WHERE "booking_id" = $1
			   AND "status" = 'pending'
			   AND "expires_at" <= CURRENT_TIMESTAMP`,
			[bookingId]
		);
	}

	private async isUserActiveMemberOnTrip(
		manager: EntityManager,
		tripId: string,
		userId: string
	): Promise<boolean> {
		const rows = (await manager.query(
			`SELECT 1
			 FROM "booking_members" bm
			 INNER JOIN "bookings" b ON b."id" = bm."booking_id"
			 WHERE b."trip_id" = $1
			   AND bm."user_id" = $2
			   AND bm."member_status" <> 'removed'
			   AND b."status" IN ('pending_payment', 'confirmed')
			 LIMIT 1`,
			[tripId, userId]
		)) as Array<{ exists: number }>;
		return rows.length > 0;
	}

	private async countActiveMembers(manager: EntityManager, bookingId: string): Promise<number> {
		const rows = (await manager.query(
			`SELECT COUNT(*)::int AS count
			 FROM "booking_members"
			 WHERE "booking_id" = $1
			   AND "member_status" <> 'removed'`,
			[bookingId]
		)) as Array<{ count: number }>;
		return rows[0]?.count ?? 0;
	}

	private async countReservedSlots(
		manager: EntityManager,
		bookingId: string
	): Promise<{ activeMemberCount: number; pendingInvitationCount: number }> {
		const [activeMemberCount, pendingRows] = await Promise.all([
			this.countActiveMembers(manager, bookingId),
			manager.query(
				`SELECT COUNT(*)::int AS count
				 FROM "booking_member_invitations"
				 WHERE "booking_id" = $1
				   AND "status" = 'pending'
				   AND "expires_at" > CURRENT_TIMESTAMP`,
				[bookingId]
			) as Promise<Array<{ count: number }>>,
		]);
		return {
			activeMemberCount,
			pendingInvitationCount: pendingRows[0]?.count ?? 0,
		};
	}

	private async buildWorkspace(
		manager: EntityManager,
		booking: Booking,
		tripStartsAt: Date
	): Promise<BookingMembersWorkspaceResponseDto> {
		const [memberRows, invitationRows] = await Promise.all([
			manager.query(
				`SELECT
					bm."id",
					bm."user_id" AS "userId",
					u."email",
					u."full_name" AS "fullName",
					bm."is_primary" AS "isPrimary",
					bm."member_status" AS "memberStatus",
					bm."created_at" AS "createdAt"
				 FROM "booking_members" bm
				 LEFT JOIN "users" u ON u."id" = bm."user_id"
				 WHERE bm."booking_id" = $1
				   AND bm."member_status" <> 'removed'
				 ORDER BY bm."is_primary" DESC, bm."created_at" ASC, bm."id" ASC`,
				[booking.id]
			) as Promise<MemberWithUserRow[]>,
			manager.query(
				`SELECT
					inv."id",
					inv."booking_id" AS "bookingId",
					inv."invited_email" AS "invitedEmail",
					u."full_name" AS "invitedUserFullName",
					(u."id" IS NOT NULL AND u."status" = 'active') AS "hasAccount",
					inv."status",
					inv."token",
					inv."expires_at" AS "expiresAt",
					inv."responded_at" AS "respondedAt",
					inv."created_at" AS "createdAt"
				 FROM "booking_member_invitations" inv
				 LEFT JOIN "users" u ON LOWER(u."email") = LOWER(inv."invited_email")
				 WHERE inv."booking_id" = $1
				   AND inv."status" = 'pending'
				   AND inv."expires_at" > CURRENT_TIMESTAMP
				 ORDER BY inv."created_at" ASC, inv."id" ASC`,
				[booking.id]
			) as Promise<InvitationWithUserRow[]>,
		]);

		const numPeople = booking.numPeople ?? 1;
		const activeMemberCount = memberRows.length;
		const pendingInvitationCount = invitationRows.length;
		const remainingSlots = Math.max(0, numPeople - activeMemberCount - pendingInvitationCount);
		const canManage =
			booking.status !== null &&
			ELIGIBLE_BOOKING_STATUSES.has(booking.status) &&
			tripStartsAt > new Date();

		const members: BookingRosterMemberItemDto[] = memberRows.map((row) => ({
			id: row.id,
			userId: row.userId,
			email: row.email,
			fullName: row.fullName,
			isPrimary: row.isPrimary,
			memberStatus: row.memberStatus,
			createdAt: new Date(row.createdAt).toISOString(),
		}));

		const invitations: BookingInvitationItemDto[] = invitationRows.map((row) =>
			this.toInvitationDto(row)
		);

		return {
			bookingId: booking.id,
			numPeople,
			activeMemberCount,
			pendingInvitationCount,
			remainingSlots,
			canManage,
			members,
			invitations,
		};
	}

	private toInvitationDto(row: InvitationWithUserRow): BookingInvitationItemDto {
		return {
			id: row.id,
			bookingId: row.bookingId,
			invitedEmail: row.invitedEmail,
			invitedUserFullName: row.invitedUserFullName,
			hasAccount: Boolean(row.hasAccount),
			status: row.status,
			token: row.token,
			invitePath: `/invitations/${row.token}`,
			inviteUrl: this.emailService?.buildInviteUrl(row.token) ?? null,
			expiresAt: new Date(row.expiresAt).toISOString(),
			respondedAt: row.respondedAt ? new Date(row.respondedAt).toISOString() : null,
			createdAt: new Date(row.createdAt).toISOString(),
		};
	}
}
