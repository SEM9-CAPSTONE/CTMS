import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { BookingPaymentStatus, BookingStatus } from "../profiles/entities/booking.entity";
import { TripPorterStatus } from "../profiles/entities/trip-porter.entity";
import { TripStatus } from "../trips/entities/trip.entity";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import { BookingMemberStatus } from "./booking-member-status.enum";
import { BookingMemberStatusService } from "./booking-member-status.service";
import type { BookingMembersRepository } from "./booking-members.repository";
import type { BookingsRepository } from "./bookings.repository";
import type { BookingMember } from "./entities/booking-member.entity";

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const TRIP_ID = "33333333-3333-4333-8333-333333333333";
const BOOKING_ID = "44444444-4444-4444-8444-444444444444";
const MEMBER_ID = "55555555-5555-4555-8555-555555555555";
const NOW = new Date("2035-01-10T08:00:00.000Z");

function actor(roles: UserRole[] = [UserRole.HOST]): AuthenticatedUser {
	return { userId: ACTOR_ID, roles, status: UserStatus.ACTIVE };
}

function member(status = BookingMemberStatus.REGISTERED): BookingMember {
	return {
		id: MEMBER_ID,
		bookingId: BOOKING_ID,
		userId: OTHER_ID,
		isPrimary: false,
		memberStatus: status,
		checkedInAt: status === BookingMemberStatus.JOINED ? new Date("2035-01-09T08:00:00Z") : null,
		noShowAt: status === BookingMemberStatus.NO_SHOW ? new Date("2035-01-11T08:00:00Z") : null,
		leftAt: null,
		statusUpdatedBy:
			status === BookingMemberStatus.JOINED || status === BookingMemberStatus.NO_SHOW
				? OTHER_ID
				: null,
		createdAt: new Date("2034-01-01T00:00:00Z"),
		updatedAt: new Date("2034-01-01T00:00:00Z"),
	} as BookingMember;
}

describe("BookingMemberStatusService", () => {
	let trip: {
		id: string;
		hostId: string;
		status: TripStatus;
		startsAt: Date;
		seatsTaken: number;
	};
	let booking: {
		id: string;
		tripId: string;
		status: BookingStatus;
		paymentStatus: BookingPaymentStatus;
	};
	let targetMember: BookingMember;
	let porterAssignment: { status: TripPorterStatus } | null;
	let auditSave: jest.Mock;
	let memberSave: jest.Mock;
	let dataSource: { transaction: jest.Mock };
	let service: BookingMemberStatusService;

	beforeEach(() => {
		trip = {
			id: TRIP_ID,
			hostId: ACTOR_ID,
			status: TripStatus.PUBLISHED,
			startsAt: new Date(NOW.getTime() + 60_000),
			seatsTaken: 2,
		};
		booking = {
			id: BOOKING_ID,
			tripId: TRIP_ID,
			status: BookingStatus.CONFIRMED,
			paymentStatus: BookingPaymentStatus.PAID,
		};
		targetMember = member();
		porterAssignment = { status: TripPorterStatus.ASSIGNED };
		auditSave = jest.fn().mockResolvedValue(undefined);
		memberSave = jest.fn(async (value: BookingMember) => value);

		const transactionalBookings = {
			findForUpdateInTrip: jest.fn(async (id: string, tripId: string) =>
				id === BOOKING_ID && tripId === TRIP_ID ? booking : null
			),
		};
		const transactionalMembers = {
			findForUpdateInBooking: jest.fn(async (id: string, bookingId: string) =>
				id === MEMBER_ID && bookingId === BOOKING_ID ? targetMember : null
			),
			save: memberSave,
		};
		const manager = {
			query: jest.fn().mockResolvedValue([{ now: NOW }]),
			withRepository: jest.fn((repository: unknown) =>
				repository === bookingsRepository ? transactionalBookings : transactionalMembers
			),
			getRepository: jest.fn((entity: { name: string }) => {
				if (entity.name === "Trip") return { findOne: jest.fn().mockResolvedValue(trip) };
				if (entity.name === "TripPorter") {
					return { findOne: jest.fn().mockImplementation(async () => porterAssignment) };
				}
				return { save: auditSave };
			}),
		} as unknown as EntityManager;
		dataSource = {
			transaction: jest.fn(async (run: (value: EntityManager) => unknown) => run(manager)),
		};
		service = new BookingMemberStatusService(
			dataSource as never,
			bookingsRepository,
			membersRepository
		);
	});

	const bookingsRepository = {} as BookingsRepository;
	const membersRepository = {} as BookingMembersRepository;

	it.each([
		[BookingMemberStatus.JOINED, 1],
		[BookingMemberStatus.JOINED, 0],
		[BookingMemberStatus.NO_SHOW, -1],
	] as const)("applies registered -> %s at an allowed boundary", async (status, startOffset) => {
		trip.startsAt = new Date(NOW.getTime() + startOffset);
		const result = await service.updateStatus(actor(), TRIP_ID, BOOKING_ID, MEMBER_ID, { status });

		expect(result.memberStatus).toBe(status);
		expect(result.statusUpdatedBy).toBe(ACTOR_ID);
		expect(status === BookingMemberStatus.JOINED ? result.checkedInAt : result.noShowAt).toEqual(
			NOW
		);
		expect(auditSave).toHaveBeenCalledTimes(1);
		expect(auditSave).toHaveBeenCalledWith(
			expect.objectContaining({
				action:
					status === BookingMemberStatus.JOINED
						? "booking_member.joined"
						: "booking_member.no_show",
			})
		);
	});

	it.each([
		[BookingMemberStatus.JOINED, -1],
		[BookingMemberStatus.NO_SHOW, 0],
		[BookingMemberStatus.NO_SHOW, 1],
	] as const)("rejects a new %s outside its time rule", async (status, startOffset) => {
		trip.startsAt = new Date(NOW.getTime() + startOffset);
		await expect(
			service.updateStatus(actor(), TRIP_ID, BOOKING_ID, MEMBER_ID, { status })
		).rejects.toBeInstanceOf(ConflictException);
		expect(memberSave).not.toHaveBeenCalled();
		expect(auditSave).not.toHaveBeenCalled();
	});

	it.each([BookingMemberStatus.JOINED, BookingMemberStatus.NO_SHOW])(
		"returns an identical %s replay before timing without mutation",
		async (status) => {
			targetMember = member(status);
			trip.startsAt =
				status === BookingMemberStatus.JOINED
					? new Date(NOW.getTime() - 60_000)
					: new Date(NOW.getTime() + 60_000);
			const originalTime = targetMember.checkedInAt ?? targetMember.noShowAt;
			const result = await service.updateStatus(actor(), TRIP_ID, BOOKING_ID, MEMBER_ID, {
				status,
			});

			expect(result.checkedInAt ?? result.noShowAt).toEqual(originalTime);
			expect(result.statusUpdatedBy).toBe(OTHER_ID);
			expect(memberSave).not.toHaveBeenCalled();
			expect(auditSave).not.toHaveBeenCalled();
		}
	);

	it.each([
		[BookingMemberStatus.REMOVED, BookingMemberStatus.JOINED],
		[BookingMemberStatus.NO_SHOW, BookingMemberStatus.JOINED],
		[BookingMemberStatus.LEFT, BookingMemberStatus.JOINED],
		[BookingMemberStatus.REMOVED, BookingMemberStatus.NO_SHOW],
		[BookingMemberStatus.JOINED, BookingMemberStatus.NO_SHOW],
		[BookingMemberStatus.LEFT, BookingMemberStatus.NO_SHOW],
	] as const)("rejects incompatible %s -> %s", async (current, requested) => {
		targetMember = member(current);
		await expect(
			service.updateStatus(actor(), TRIP_ID, BOOKING_ID, MEMBER_ID, { status: requested })
		).rejects.toBeInstanceOf(ConflictException);
		expect(auditSave).not.toHaveBeenCalled();
	});

	it.each([
		BookingStatus.PENDING_PAYMENT,
		BookingStatus.PENDING_RECONFIRMATION,
		BookingStatus.CANCELLED,
		BookingStatus.EXPIRED,
		BookingStatus.COMPLETED,
	])("rejects Booking status %s regardless of payment", async (status) => {
		booking.status = status;
		booking.paymentStatus = BookingPaymentStatus.PAID;
		await expect(
			service.updateStatus(actor(), TRIP_ID, BOOKING_ID, MEMBER_ID, {
				status: BookingMemberStatus.JOINED,
			})
		).rejects.toBeInstanceOf(ConflictException);
	});

	it.each([
		TripStatus.DRAFT,
		TripStatus.PENDING_APPROVAL,
		TripStatus.CANCELLED,
		TripStatus.COMPLETED,
	])("rejects non-operational Trip status %s", async (status) => {
		trip.status = status;
		await expect(
			service.updateStatus(actor(), TRIP_ID, BOOKING_ID, MEMBER_ID, {
				status: BookingMemberStatus.JOINED,
			})
		).rejects.toBeInstanceOf(ConflictException);
	});

	it.each([TripStatus.PUBLISHED, TripStatus.ONGOING])(
		"allows operational Trip status %s",
		async (status) => {
			trip.status = status;
			await expect(
				service.updateStatus(actor(), TRIP_ID, BOOKING_ID, MEMBER_ID, {
					status: BookingMemberStatus.JOINED,
				})
			).resolves.toEqual(expect.objectContaining({ memberStatus: BookingMemberStatus.JOINED }));
		}
	);

	it("does not use payment status as participation eligibility", async () => {
		booking.paymentStatus = BookingPaymentStatus.UNPAID;
		await expect(
			service.updateStatus(actor(), TRIP_ID, BOOKING_ID, MEMBER_ID, {
				status: BookingMemberStatus.JOINED,
			})
		).resolves.toEqual(expect.objectContaining({ memberStatus: BookingMemberStatus.JOINED }));
	});

	it("authorizes an assigned Porter and records that path", async () => {
		trip.hostId = OTHER_ID;
		await service.updateStatus(actor([UserRole.PORTER]), TRIP_ID, BOOKING_ID, MEMBER_ID, {
			status: BookingMemberStatus.JOINED,
		});
		expect(auditSave).toHaveBeenCalledWith(
			expect.objectContaining({ after: expect.objectContaining({ authorizationPath: "porter" }) })
		);
	});

	it.each([TripPorterStatus.PENDING_RECONFIRMATION, TripPorterStatus.UNASSIGNED])(
		"rejects Porter assignment status %s",
		async (status) => {
			trip.hostId = OTHER_ID;
			porterAssignment = { status };
			await expect(
				service.updateStatus(actor([UserRole.PORTER]), TRIP_ID, BOOKING_ID, MEMBER_ID, {
					status: BookingMemberStatus.JOINED,
				})
			).rejects.toBeInstanceOf(ForbiddenException);
		}
	);

	it("rejects an unrelated Porter and a wrong-role actor", async () => {
		trip.hostId = OTHER_ID;
		porterAssignment = null;
		await expect(
			service.updateStatus(actor([UserRole.PORTER]), TRIP_ID, BOOKING_ID, MEMBER_ID, {
				status: BookingMemberStatus.JOINED,
			})
		).rejects.toBeInstanceOf(ForbiddenException);
		await expect(
			service.updateStatus(actor([UserRole.CAMPER]), TRIP_ID, BOOKING_ID, MEMBER_ID, {
				status: BookingMemberStatus.JOINED,
			})
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it("uses owning Host precedence for a dual-role actor", async () => {
		await service.updateStatus(
			actor([UserRole.HOST, UserRole.PORTER]),
			TRIP_ID,
			BOOKING_ID,
			MEMBER_ID,
			{ status: BookingMemberStatus.JOINED }
		);
		expect(auditSave).toHaveBeenCalledWith(
			expect.objectContaining({ after: expect.objectContaining({ authorizationPath: "host" }) })
		);
	});

	it("returns 404 for a Booking outside the Trip path", async () => {
		await expect(
			service.updateStatus(actor(), TRIP_ID, OTHER_ID, MEMBER_ID, {
				status: BookingMemberStatus.JOINED,
			})
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("rolls back through the transaction when audit persistence fails", async () => {
		auditSave.mockRejectedValue(new Error("audit failed"));
		await expect(
			service.updateStatus(actor(), TRIP_ID, BOOKING_ID, MEMBER_ID, {
				status: BookingMemberStatus.JOINED,
			})
		).rejects.toThrow("audit failed");
		expect(dataSource.transaction).toHaveBeenCalledTimes(1);
	});
});
