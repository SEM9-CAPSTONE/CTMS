import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { DataSource, EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { Booking, BookingPaymentStatus, BookingStatus } from "../profiles/entities/booking.entity";
import { TrekkingRoute } from "../trekking-routes/entities/trekking-route.entity";
import { Trip } from "../trips/entities/trip.entity";
import { User, UserStatus } from "../users/entities/user.entity";
import type { BookingMemberInvitationEmailService } from "./booking-member-invitation-email.service";
import { BookingMemberInvitationsService } from "./booking-member-invitations.service";
import { BookingMemberStatus } from "./booking-member-status.enum";
import type { BookingMembersRepository } from "./booking-members.repository";
import type { BookingsRepository } from "./bookings.repository";
import {
	BookingMemberInvitation,
	BookingMemberInvitationStatus,
} from "./entities/booking-member-invitation.entity";
import { BookingMember } from "./entities/booking-member.entity";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const FRIEND_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ID = "33333333-3333-4333-8333-333333333333";
const BOOKING_ID = "77777777-7777-4777-8777-777777777777";
const TRIP_ID = "88888888-8888-4888-8888-888888888888";
const ROUTE_ID = "99999999-9999-4999-8999-999999999999";
const INVITATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MEMBER_ROW_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = new Date("2029-09-01T00:00:00.000Z");
const STARTS_AT = new Date("2029-09-05T00:00:00.000Z");
const ENDS_AT = new Date("2029-09-06T00:00:00.000Z");

function makeBooking(overrides: Partial<Booking> = {}): Booking {
	return Object.assign(new Booking(), {
		id: BOOKING_ID,
		tripId: TRIP_ID,
		userId: OWNER_ID,
		numPeople: 2,
		status: BookingStatus.CONFIRMED,
		paymentStatus: BookingPaymentStatus.PAID,
		holdExpiresAt: null,
		tripStartsAtSnapshot: STARTS_AT,
		tripEndsAtSnapshot: ENDS_AT,
		basePrice: "1000000.00",
		totalAmount: "1000000.00",
		createdAt: NOW,
		...overrides,
	});
}

describe("BookingMemberInvitationsService", () => {
	let bookingsRepo: { findOne: jest.Mock; findForUpdate: jest.Mock };
	let membersRepo: {
		findOne: jest.Mock;
		findForUpdateInBooking: jest.Mock;
		create: jest.Mock;
		save: jest.Mock;
	};
	let invitationRepo: {
		findOne: jest.Mock;
		create: jest.Mock;
		save: jest.Mock;
		createQueryBuilder: jest.Mock;
	};
	let userRepo: { findOne: jest.Mock; createQueryBuilder: jest.Mock };
	let tripRepo: { findOne: jest.Mock };
	let routeRepo: { findOne: jest.Mock };
	let auditRepo: { save: jest.Mock };
	let emailService: { buildInviteUrl: jest.Mock; trySendInvitation: jest.Mock };
	let managerQuery: jest.Mock;
	let dataSourceQuery: jest.Mock;
	let service: BookingMemberInvitationsService;

	beforeEach(() => {
		jest.useFakeTimers().setSystemTime(NOW);
		bookingsRepo = {
			findOne: jest.fn().mockResolvedValue(makeBooking()),
			findForUpdate: jest.fn().mockResolvedValue(makeBooking()),
		};
		membersRepo = {
			findOne: jest.fn().mockResolvedValue(
				Object.assign(new BookingMember(), {
					id: "primary-row",
					bookingId: BOOKING_ID,
					userId: OWNER_ID,
					isPrimary: true,
					memberStatus: BookingMemberStatus.REGISTERED,
				})
			),
			findForUpdateInBooking: jest.fn(),
			create: jest.fn((value) => Object.assign(new BookingMember(), value)),
			save: jest.fn(async (value) =>
				Object.assign(value, { id: value.id ?? MEMBER_ROW_ID, createdAt: NOW })
			),
		};
		invitationRepo = {
			findOne: jest.fn(),
			create: jest.fn((value) => Object.assign(new BookingMemberInvitation(), value)),
			save: jest.fn(async (value) =>
				Object.assign(value, { id: value.id ?? INVITATION_ID, createdAt: NOW })
			),
			createQueryBuilder: jest.fn(() => ({
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			})),
		};
		userRepo = {
			findOne: jest.fn().mockResolvedValue({
				id: OWNER_ID,
				email: "owner@ditrek.vn",
				fullName: "Nguyễn Minh Anh",
				status: UserStatus.ACTIVE,
			}),
			createQueryBuilder: jest.fn(() => ({
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			})),
		};
		tripRepo = {
			findOne: jest.fn().mockResolvedValue({
				id: TRIP_ID,
				title: "Khám phá bán đảo Sơn Trà",
				routeId: ROUTE_ID,
				startsAt: STARTS_AT,
				endsAt: ENDS_AT,
			}),
		};
		routeRepo = {
			findOne: jest.fn().mockResolvedValue({
				id: ROUTE_ID,
				name: "Tuyến Sơn Trà",
			}),
		};
		auditRepo = { save: jest.fn().mockResolvedValue(undefined) };
		emailService = {
			buildInviteUrl: jest.fn((token: string) => `https://ditrek.io.vn/invitations/${token}`),
			trySendInvitation: jest.fn().mockResolvedValue(true),
		};
		managerQuery = jest.fn();
		dataSourceQuery = jest.fn();

		const repoMap = new Map<object, object>([
			[bookingsRepo, bookingsRepo],
			[membersRepo, membersRepo],
		]);
		const manager = {
			query: managerQuery,
			withRepository: jest.fn((repo: object) => repoMap.get(repo)),
			getRepository: jest.fn((entity: unknown) => {
				if (entity === BookingMemberInvitation) return invitationRepo;
				if (entity === BookingMember) return membersRepo;
				if (entity === User) return userRepo;
				if (entity === Trip) return tripRepo;
				if (entity === TrekkingRoute) return routeRepo;
				if (entity === AuditLog) return auditRepo;
				throw new Error(`Unexpected repository: ${String(entity)}`);
			}),
		} as unknown as EntityManager;

		const dataSource = {
			query: dataSourceQuery,
			getRepository: manager.getRepository,
			transaction: jest.fn(async (cb: (em: EntityManager) => unknown) => cb(manager)),
		} as unknown as DataSource;

		service = new BookingMemberInvitationsService(
			dataSource,
			bookingsRepo as unknown as BookingsRepository,
			membersRepo as unknown as BookingMembersRepository,
			emailService as unknown as BookingMemberInvitationEmailService
		);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("createInvitation", () => {
		it("creates a pending invitation for an unregistered email and dispatches invite email", async () => {
			managerQuery
				.mockResolvedValueOnce(undefined) // expireStalePendingInvitations
				.mockResolvedValueOnce([{ count: 1 }]) // countActiveMembers
				.mockResolvedValueOnce([{ count: 0 }]) // pending count
				.mockResolvedValueOnce([
					{
						id: "primary-row",
						userId: OWNER_ID,
						email: "owner@ditrek.vn",
						fullName: "Nguyễn Minh Anh",
						isPrimary: true,
						memberStatus: BookingMemberStatus.REGISTERED,
						createdAt: NOW,
					},
				])
				.mockResolvedValueOnce([
					{
						id: INVITATION_ID,
						bookingId: BOOKING_ID,
						invitedEmail: "newfriend@example.com",
						invitedUserFullName: null,
						hasAccount: false,
						status: BookingMemberInvitationStatus.PENDING,
						token: "tok-1",
						expiresAt: STARTS_AT,
						respondedAt: null,
						createdAt: NOW,
					},
				]);

			const result = await service.createInvitation(OWNER_ID, BOOKING_ID, {
				email: "NewFriend@Example.com",
			});

			expect(result.invitation.invitedEmail).toBe("newfriend@example.com");
			expect(result.invitation.hasAccount).toBe(false);
			expect(result.invitation.status).toBe(BookingMemberInvitationStatus.PENDING);
			expect(result.emailSent).toBe(true);
			expect(result.workspace.remainingSlots).toBe(0);
			expect(emailService.trySendInvitation).toHaveBeenCalledWith(
				expect.objectContaining({
					to: "newfriend@example.com",
					hasAccount: false,
				})
			);
			expect(auditRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({ action: "booking.member_invited" })
			);
		});

		it("rejects inviting the booking owner's own email", async () => {
			managerQuery.mockResolvedValueOnce(undefined);

			await expect(
				service.createInvitation(OWNER_ID, BOOKING_ID, { email: "owner@ditrek.vn" })
			).rejects.toBeInstanceOf(ConflictException);
		});

		it("rejects when all booking slots are already occupied or pending", async () => {
			managerQuery
				.mockResolvedValueOnce(undefined)
				.mockResolvedValueOnce([{ count: 1 }])
				.mockResolvedValueOnce([{ count: 1 }]);

			await expect(
				service.createInvitation(OWNER_ID, BOOKING_ID, { email: "extra@example.com" })
			).rejects.toBeInstanceOf(ConflictException);
		});

		it("rejects non-owners with 403", async () => {
			await expect(
				service.createInvitation(OTHER_ID, BOOKING_ID, { email: "friend@example.com" })
			).rejects.toBeInstanceOf(ForbiddenException);
		});
	});

	describe("acceptInvitation", () => {
		it("adds the invited DiTrek Camper to booking_members and marks invitation accepted", async () => {
			invitationRepo.findOne.mockResolvedValue(
				Object.assign(new BookingMemberInvitation(), {
					id: INVITATION_ID,
					bookingId: BOOKING_ID,
					invitedByUserId: OWNER_ID,
					invitedEmail: "friend@ditrek.vn",
					invitedUserId: FRIEND_ID,
					token: "valid-token",
					status: BookingMemberInvitationStatus.PENDING,
					expiresAt: STARTS_AT,
				})
			);
			userRepo.findOne.mockResolvedValue({
				id: FRIEND_ID,
				email: "friend@ditrek.vn",
				status: UserStatus.ACTIVE,
			});
			membersRepo.findOne
				.mockResolvedValueOnce(
					Object.assign(new BookingMember(), {
						id: "primary-row",
						bookingId: BOOKING_ID,
						userId: OWNER_ID,
						isPrimary: true,
						memberStatus: BookingMemberStatus.REGISTERED,
					})
				)
				.mockResolvedValueOnce(null);
			managerQuery
				.mockResolvedValueOnce([]) // isUserActiveMemberOnTrip -> false
				.mockResolvedValueOnce([{ count: 1 }]); // countActiveMembers

			const result = await service.acceptInvitation(FRIEND_ID, "valid-token");

			expect(result).toEqual({
				id: INVITATION_ID,
				bookingId: BOOKING_ID,
				tripId: TRIP_ID,
				status: BookingMemberInvitationStatus.ACCEPTED,
			});
			expect(membersRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					bookingId: BOOKING_ID,
					userId: FRIEND_ID,
					isPrimary: false,
					memberStatus: BookingMemberStatus.REGISTERED,
				})
			);
		});

		it("rejects accepting an invitation belonging to a different email", async () => {
			invitationRepo.findOne.mockResolvedValue(
				Object.assign(new BookingMemberInvitation(), {
					id: INVITATION_ID,
					bookingId: BOOKING_ID,
					invitedByUserId: OWNER_ID,
					invitedEmail: "friend@ditrek.vn",
					token: "valid-token",
					status: BookingMemberInvitationStatus.PENDING,
					expiresAt: STARTS_AT,
				})
			);
			userRepo.findOne.mockResolvedValue({
				id: OTHER_ID,
				email: "other@ditrek.vn",
				status: UserStatus.ACTIVE,
			});

			await expect(service.acceptInvitation(OTHER_ID, "valid-token")).rejects.toBeInstanceOf(
				ForbiddenException
			);
		});

		it("reactivates a previously removed member row when re-invited and accepted", async () => {
			invitationRepo.findOne.mockResolvedValue(
				Object.assign(new BookingMemberInvitation(), {
					id: INVITATION_ID,
					bookingId: BOOKING_ID,
					invitedByUserId: OWNER_ID,
					invitedEmail: "friend@ditrek.vn",
					token: "reinvite-token",
					status: BookingMemberInvitationStatus.PENDING,
					expiresAt: STARTS_AT,
				})
			);
			userRepo.findOne.mockResolvedValue({
				id: FRIEND_ID,
				email: "friend@ditrek.vn",
				status: UserStatus.ACTIVE,
			});
			const removedRow = Object.assign(new BookingMember(), {
				id: MEMBER_ROW_ID,
				bookingId: BOOKING_ID,
				userId: FRIEND_ID,
				isPrimary: false,
				memberStatus: BookingMemberStatus.REMOVED,
			});
			membersRepo.findOne
				.mockResolvedValueOnce(
					Object.assign(new BookingMember(), {
						id: "primary-row",
						bookingId: BOOKING_ID,
						userId: OWNER_ID,
						isPrimary: true,
						memberStatus: BookingMemberStatus.REGISTERED,
					})
				)
				.mockResolvedValueOnce(removedRow);
			managerQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 1 }]);

			await service.acceptInvitation(FRIEND_ID, "reinvite-token");

			expect(membersRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					id: MEMBER_ROW_ID,
					memberStatus: BookingMemberStatus.REGISTERED,
				})
			);
		});
	});

	describe("removeMember", () => {
		it("prevents removing the primary booking owner", async () => {
			membersRepo.findForUpdateInBooking.mockResolvedValue(
				Object.assign(new BookingMember(), {
					id: "primary-row",
					bookingId: BOOKING_ID,
					userId: OWNER_ID,
					isPrimary: true,
					memberStatus: BookingMemberStatus.REGISTERED,
				})
			);

			await expect(
				service.removeMember(OWNER_ID, BOOKING_ID, "primary-row")
			).rejects.toBeInstanceOf(ConflictException);
		});

		it("marks a registered companion member as removed before trip start", async () => {
			membersRepo.findForUpdateInBooking.mockResolvedValue(
				Object.assign(new BookingMember(), {
					id: MEMBER_ROW_ID,
					bookingId: BOOKING_ID,
					userId: FRIEND_ID,
					isPrimary: false,
					memberStatus: BookingMemberStatus.REGISTERED,
				})
			);
			managerQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

			const workspace = await service.removeMember(OWNER_ID, BOOKING_ID, MEMBER_ROW_ID);

			expect(membersRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					id: MEMBER_ROW_ID,
					memberStatus: BookingMemberStatus.REMOVED,
				})
			);
			expect(workspace.bookingId).toBe(BOOKING_ID);
		});
	});

	describe("getPublicInvitation", () => {
		it("throws 404 when token does not exist", async () => {
			invitationRepo.findOne.mockResolvedValue(null);
			await expect(service.getPublicInvitation("missing")).rejects.toBeInstanceOf(
				NotFoundException
			);
		});
	});
});
