import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { DataSource, EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import {
	type Booking,
	BookingPaymentStatus,
	BookingStatus,
} from "../profiles/entities/booking.entity";
import { Trip, TripStatus } from "../trips/entities/trip.entity";
import { UserRole } from "../users/entities/user.entity";
import { BookingCompletionService } from "./booking-completion.service";
import { BookingMemberStatus } from "./booking-member-status.enum";
import type { BookingMembersRepository } from "./booking-members.repository";
import type { BookingsRepository } from "./bookings.repository";
import type { BookingMember } from "./entities/booking-member.entity";

describe("BookingCompletionService", () => {
	let service: BookingCompletionService;
	let mockDataSource: jest.Mocked<DataSource>;
	let mockBookingsRepo: jest.Mocked<BookingsRepository>;
	let mockMembersRepo: jest.Mocked<BookingMembersRepository>;
	let mockEntityManager: jest.Mocked<EntityManager>;

	const HOST_ID = "host-1111-1111-1111-111111111111";
	const ADMIN_ID = "admin-2222-2222-2222-222222222222";
	const OTHER_USER_ID = "user-3333-3333-3333-333333333333";
	const TRIP_ID = "trip-4444-4444-4444-444444444444";
	const BOOKING_ID = "booking-5555-5555-5555-555555555555";

	const hostActor: AuthenticatedUser = {
		userId: HOST_ID,
		email: "host@example.com",
		phone: "0900000001",
		roles: [UserRole.HOST],
		fullName: "Host Test",
	};

	const adminActor: AuthenticatedUser = {
		userId: ADMIN_ID,
		email: "admin@example.com",
		phone: "0900000002",
		roles: [UserRole.ADMIN],
		fullName: "Admin Test",
	};

	const camperActor: AuthenticatedUser = {
		userId: OTHER_USER_ID,
		email: "camper@example.com",
		phone: "0900000003",
		roles: [UserRole.CAMPER],
		fullName: "Camper Test",
	};

	const createMockTrip = (overrides: Partial<Trip> = {}): Trip =>
		({
			id: TRIP_ID,
			hostId: HOST_ID,
			status: TripStatus.COMPLETED,
			...overrides,
		}) as Trip;

	const createMockBooking = (overrides: Partial<Booking> = {}): Booking =>
		({
			id: BOOKING_ID,
			tripId: TRIP_ID,
			userId: OTHER_USER_ID,
			status: BookingStatus.CONFIRMED,
			paymentStatus: BookingPaymentStatus.PAID,
			completedAt: null,
			...overrides,
		}) as Booking;

	const createMockMember = (status: BookingMemberStatus): BookingMember =>
		({
			id: "member-1",
			bookingId: BOOKING_ID,
			memberStatus: status,
		}) as BookingMember;

	beforeEach(() => {
		mockBookingsRepo = {
			findForUpdate: jest.fn(),
			find: jest.fn(),
			save: jest.fn().mockImplementation((b) => Promise.resolve(b)),
		} as unknown as jest.Mocked<BookingsRepository>;

		mockMembersRepo = {
			find: jest.fn(),
		} as unknown as jest.Mocked<BookingMembersRepository>;

		mockEntityManager = {
			withRepository: jest.fn().mockImplementation((repo) => {
				if (repo === mockBookingsRepo) return mockBookingsRepo;
				if (repo === mockMembersRepo) return mockMembersRepo;
				return repo;
			}),
			getRepository: jest.fn().mockImplementation((entity) => {
				if (entity === Trip) {
					return {
						findOne: jest.fn().mockResolvedValue(createMockTrip()),
					};
				}
				if (entity === AuditLog) {
					return {
						save: jest.fn().mockResolvedValue({}),
					};
				}
				return {};
			}),
			query: jest.fn().mockResolvedValue([{ now: new Date("2026-10-11T12:00:00Z") }]),
		} as unknown as jest.Mocked<EntityManager>;

		mockDataSource = {
			transaction: jest
				.fn()
				.mockImplementation((cb: (em: EntityManager) => Promise<unknown>) => cb(mockEntityManager)),
		} as unknown as jest.Mocked<DataSource>;

		service = new BookingCompletionService(mockDataSource, mockBookingsRepo, mockMembersRepo);
	});

	describe("completeBooking", () => {
		it("throws NotFoundException if booking does not exist", async () => {
			mockBookingsRepo.findForUpdate.mockResolvedValue(null);

			await expect(service.completeBooking(hostActor, BOOKING_ID)).rejects.toThrow(
				NotFoundException
			);
		});

		it("returns existing completed state idempotently if booking is already COMPLETED", async () => {
			const completedBooking = createMockBooking({
				status: BookingStatus.COMPLETED,
				completedAt: new Date("2026-10-10T10:00:00Z"),
			});
			mockBookingsRepo.findForUpdate.mockResolvedValue(completedBooking);

			const result = await service.completeBooking(hostActor, BOOKING_ID);

			expect(result).toEqual({
				id: BOOKING_ID,
				status: BookingStatus.COMPLETED,
				completedAt: "2026-10-10T10:00:00.000Z",
			});
			expect(mockBookingsRepo.save).not.toHaveBeenCalled();
		});

		it("throws ForbiddenException if actor is not the owning Host and not Admin", async () => {
			mockBookingsRepo.findForUpdate.mockResolvedValue(createMockBooking());

			await expect(service.completeBooking(camperActor, BOOKING_ID)).rejects.toThrow(
				ForbiddenException
			);
		});

		it("throws ConflictException if the Trip is not in COMPLETED status (BR-115)", async () => {
			mockBookingsRepo.findForUpdate.mockResolvedValue(createMockBooking());
			mockEntityManager.getRepository = jest.fn().mockReturnValue({
				findOne: jest.fn().mockResolvedValue(createMockTrip({ status: TripStatus.PUBLISHED })),
			});

			await expect(service.completeBooking(hostActor, BOOKING_ID)).rejects.toThrow(
				ConflictException
			);
		});

		it("throws ConflictException if booking is in status CANCELLED or PENDING_PAYMENT", async () => {
			mockBookingsRepo.findForUpdate.mockResolvedValue(
				createMockBooking({ status: BookingStatus.CANCELLED })
			);

			await expect(service.completeBooking(hostActor, BOOKING_ID)).rejects.toThrow(
				ConflictException
			);
		});

		it("throws ConflictException if booking paymentStatus is unpaid", async () => {
			mockBookingsRepo.findForUpdate.mockResolvedValue(
				createMockBooking({ paymentStatus: BookingPaymentStatus.UNPAID })
			);

			await expect(service.completeBooking(hostActor, BOOKING_ID)).rejects.toThrow(
				ConflictException
			);
		});

		it("throws ConflictException if any booking member is still in REGISTERED status", async () => {
			mockBookingsRepo.findForUpdate.mockResolvedValue(createMockBooking());
			mockMembersRepo.find.mockResolvedValue([
				createMockMember(BookingMemberStatus.JOINED),
				createMockMember(BookingMemberStatus.REGISTERED),
			]);

			await expect(service.completeBooking(hostActor, BOOKING_ID)).rejects.toThrow(
				ConflictException
			);
		});

		it("successfully transitions confirmed booking to completed with server timestamp and audit record", async () => {
			const booking = createMockBooking();
			mockBookingsRepo.findForUpdate.mockResolvedValue(booking);
			mockMembersRepo.find.mockResolvedValue([
				createMockMember(BookingMemberStatus.JOINED),
				createMockMember(BookingMemberStatus.NO_SHOW),
			]);

			const result = await service.completeBooking(hostActor, BOOKING_ID);

			expect(result.status).toBe(BookingStatus.COMPLETED);
			expect(result.completedAt).toBe("2026-10-11T12:00:00.000Z");
			expect(mockBookingsRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({
					id: BOOKING_ID,
					status: BookingStatus.COMPLETED,
					completedAt: new Date("2026-10-11T12:00:00.000Z"),
				})
			);
		});

		it("allows Admin to complete booking even if not the Host", async () => {
			const booking = createMockBooking();
			mockBookingsRepo.findForUpdate.mockResolvedValue(booking);
			mockMembersRepo.find.mockResolvedValue([createMockMember(BookingMemberStatus.JOINED)]);

			const result = await service.completeBooking(adminActor, BOOKING_ID);

			expect(result.status).toBe(BookingStatus.COMPLETED);
			expect(mockBookingsRepo.save).toHaveBeenCalled();
		});
	});

	describe("completeTripBookings (batch)", () => {
		it("completes all eligible confirmed bookings and skips non-eligible or already completed ones", async () => {
			const b1 = createMockBooking({ id: "b1", status: BookingStatus.CONFIRMED });
			const b2 = createMockBooking({
				id: "b2",
				status: BookingStatus.COMPLETED,
				completedAt: new Date(),
			});
			const b3 = createMockBooking({ id: "b3", status: BookingStatus.CANCELLED });
			const b4 = createMockBooking({ id: "b4", status: BookingStatus.CONFIRMED });

			mockBookingsRepo.find.mockResolvedValue([b1, b2, b3, b4]);
			mockMembersRepo.find.mockImplementation((query: { where: { bookingId: string } }) => {
				if (query.where.bookingId === "b1") {
					return Promise.resolve([createMockMember(BookingMemberStatus.JOINED)]);
				}
				if (query.where.bookingId === "b4") {
					// b4 has unhandled registered member
					return Promise.resolve([createMockMember(BookingMemberStatus.REGISTERED)]);
				}
				return Promise.resolve([]);
			});

			const result = await service.completeTripBookings(hostActor, TRIP_ID);

			expect(result.completedCount).toBe(1);
			expect(result.completedBookingIds).toEqual(["b1"]);
			expect(result.skippedCount).toBe(3); // b2 (already completed), b3 (cancelled), b4 (unhandled member)
		});
	});
});
