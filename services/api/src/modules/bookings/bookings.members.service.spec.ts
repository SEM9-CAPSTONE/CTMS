import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { DataSource, EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import type { EquipmentCatalogRepository } from "../equipment-catalog/equipment-catalog.repository";
import { Booking, BookingPaymentStatus, BookingStatus } from "../profiles/entities/booking.entity";
import { Trip } from "../trips/entities/trip.entity";
import type { TripsRepository } from "../trips/repositories/trips.repository";
import { User } from "../users/entities/user.entity";
import type { RouteRegistrationRiskService } from "../weather/services/route-registration-risk.service";
import type { BookingItemsRepository } from "./booking-items.repository";
import { BookingMemberStatus } from "./booking-member-status.enum";
import type { BookingMembersRepository } from "./booking-members.repository";
import type { BookingsRepository } from "./bookings.repository";
import { BookingsService } from "./bookings.service";
import { BookingMember } from "./entities/booking-member.entity";
import type { EquipmentReservationsRepository } from "./equipment-reservations.repository";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_MEMBER_ID = "33333333-3333-4333-8333-333333333333";
const BOOKING_ID = "77777777-7777-4777-8777-777777777777";
const TRIP_ID = "88888888-8888-4888-8888-888888888888";
const NOW = new Date("2029-09-01T00:00:00.000Z");
const STARTS_AT = new Date("2029-09-02T00:00:00.000Z");

function booking(overrides: Partial<Booking> = {}): Booking {
	return Object.assign(new Booking(), {
		id: BOOKING_ID,
		tripId: TRIP_ID,
		userId: OWNER_ID,
		numPeople: 2,
		status: BookingStatus.PENDING_PAYMENT,
		paymentStatus: BookingPaymentStatus.UNPAID,
		holdExpiresAt: new Date("2029-09-01T00:15:00.000Z"),
		tripStartsAtSnapshot: STARTS_AT,
		tripEndsAtSnapshot: new Date("2029-09-03T00:00:00.000Z"),
		basePrice: "100.00",
		totalAmount: "100.00",
		cancellationPolicySnapshot: null,
		createdAt: NOW,
		...overrides,
	});
}

describe("BookingsService.initializeMembers", () => {
	let bookingsRepository: { findForUpdate: jest.Mock };
	let membersRepository: {
		lockIdempotencyKey: jest.Mock;
		findInitializationByKey: jest.Mock;
		hasInitialization: jest.Mock;
		findByBooking: jest.Mock;
		create: jest.Mock;
		save: jest.Mock;
		saveInitialization: jest.Mock;
	};
	let tripRepository: { findOne: jest.Mock };
	let usersRepository: { find: jest.Mock };
	let auditRepository: { save: jest.Mock };
	let service: BookingsService;

	beforeEach(() => {
		jest.useFakeTimers().setSystemTime(NOW);
		bookingsRepository = { findForUpdate: jest.fn().mockResolvedValue(booking()) };
		membersRepository = {
			lockIdempotencyKey: jest.fn().mockResolvedValue(undefined),
			findInitializationByKey: jest.fn().mockResolvedValue(null),
			hasInitialization: jest.fn().mockResolvedValue(false),
			findByBooking: jest.fn().mockResolvedValue([]),
			create: jest.fn((value) => Object.assign(new BookingMember(), value)),
			save: jest.fn(async (members: BookingMember[]) =>
				members.map((member, index) =>
					Object.assign(member, {
						id: `member-row-${index + 1}`,
						createdAt: NOW,
						updatedAt: NOW,
					})
				)
			),
			saveInitialization: jest.fn().mockResolvedValue(undefined),
		};
		tripRepository = {
			findOne: jest.fn().mockResolvedValue({
				id: TRIP_ID,
				startsAt: STARTS_AT,
				capacityMax: 10,
				seatsTaken: 2,
			}),
		};
		usersRepository = { find: jest.fn().mockResolvedValue([{ id: MEMBER_ID }]) };
		auditRepository = { save: jest.fn().mockResolvedValue(undefined) };

		const repositoryMap = new Map<object, object>([
			[bookingsRepository, bookingsRepository],
			[membersRepository, membersRepository],
		]);
		const manager = {
			withRepository: jest.fn((repository: object) => repositoryMap.get(repository)),
			getRepository: jest.fn((entity: unknown) => {
				if (entity === Trip) return tripRepository;
				if (entity === User) return usersRepository;
				if (entity === AuditLog) return auditRepository;
				throw new Error("Unexpected repository");
			}),
		} as unknown as EntityManager;
		const dataSource = {
			transaction: jest.fn(async (callback: (entityManager: EntityManager) => unknown) =>
				callback(manager)
			),
		} as unknown as DataSource;

		service = new BookingsService(
			bookingsRepository as unknown as BookingsRepository,
			{} as unknown as TripsRepository,
			{} as unknown as RouteRegistrationRiskService,
			dataSource,
			{} as unknown as ConfigService,
			{} as unknown as BookingItemsRepository,
			membersRepository as unknown as BookingMembersRepository,
			{} as unknown as EquipmentCatalogRepository,
			{} as unknown as EquipmentReservationsRepository
		);
	});

	afterEach(() => jest.useRealTimers());

	it.each([BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED])(
		"initializes the complete owner-primary roster for a %s Booking without changing seats",
		async (status) => {
			bookingsRepository.findForUpdate.mockResolvedValue(booking({ status }));

			const result = await service.initializeMembers(OWNER_ID, BOOKING_ID, "roster-1", {
				members: [{ userId: MEMBER_ID }],
			});

			expect(result.members).toHaveLength(2);
			expect(result.members).toEqual([
				expect.objectContaining({
					userId: OWNER_ID,
					isPrimary: true,
					memberStatus: BookingMemberStatus.REGISTERED,
				}),
				expect.objectContaining({ userId: MEMBER_ID, isPrimary: false }),
			]);
			expect(result.members.filter((member) => member.isPrimary)).toHaveLength(1);
			expect(auditRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({ action: "booking.members_initialized", targetId: BOOKING_ID })
			);
			expect(membersRepository.saveInitialization).toHaveBeenCalledTimes(1);
		}
	);

	it("automatically creates the owner-only roster for numPeople=1", async () => {
		bookingsRepository.findForUpdate.mockResolvedValue(booking({ numPeople: 1 }));
		tripRepository.findOne.mockResolvedValue({
			id: TRIP_ID,
			startsAt: STARTS_AT,
			capacityMax: 10,
			seatsTaken: 1,
		});
		usersRepository.find.mockResolvedValue([]);

		const result = await service.initializeMembers(OWNER_ID, BOOKING_ID, "owner-only", {
			members: [],
		});

		expect(result.members).toHaveLength(1);
		expect(result.members[0]).toMatchObject({ userId: OWNER_ID, isPrimary: true });
	});

	it("rejects a caller who does not own the Booking", async () => {
		await expect(
			service.initializeMembers(MEMBER_ID, BOOKING_ID, "wrong-owner", { members: [] })
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(membersRepository.save).not.toHaveBeenCalled();
	});

	it("returns 404 when the Booking is missing", async () => {
		bookingsRepository.findForUpdate.mockResolvedValue(null);
		await expect(
			service.initializeMembers(OWNER_ID, BOOKING_ID, "missing", { members: [] })
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it.each([BookingStatus.CANCELLED, BookingStatus.EXPIRED, BookingStatus.COMPLETED])(
		"rejects a %s Booking",
		async (status) => {
			bookingsRepository.findForUpdate.mockResolvedValue(booking({ status }));
			await expect(
				service.initializeMembers(OWNER_ID, BOOKING_ID, `state-${status}`, {
					members: [{ userId: MEMBER_ID }],
				})
			).rejects.toBeInstanceOf(ConflictException);
			expect(membersRepository.save).not.toHaveBeenCalled();
		}
	);

	it("rejects an already-started Trip", async () => {
		tripRepository.findOne.mockResolvedValue({
			id: TRIP_ID,
			startsAt: NOW,
			capacityMax: 10,
			seatsTaken: 2,
		});
		await expect(
			service.initializeMembers(OWNER_ID, BOOKING_ID, "started", {
				members: [{ userId: MEMBER_ID }],
			})
		).rejects.toBeInstanceOf(ConflictException);
	});

	it("rejects a roster whose effective size differs from numPeople", async () => {
		await expect(
			service.initializeMembers(OWNER_ID, BOOKING_ID, "wrong-count", { members: [] })
		).rejects.toBeInstanceOf(ConflictException);
		expect(membersRepository.save).not.toHaveBeenCalled();
	});

	it.each([
		[[{ userId: MEMBER_ID }, { userId: MEMBER_ID }], "duplicate member"],
		[[{ userId: OWNER_ID }], "repeated owner"],
	] as const)("rejects %s", async (members, _label) => {
		bookingsRepository.findForUpdate.mockResolvedValue(booking({ numPeople: members.length + 1 }));
		await expect(
			service.initializeMembers(OWNER_ID, BOOKING_ID, "duplicate", { members: [...members] })
		).rejects.toBeInstanceOf(ConflictException);
		expect(membersRepository.save).not.toHaveBeenCalled();
	});

	it("returns 404 when a participant user is missing", async () => {
		usersRepository.find.mockResolvedValue([]);
		await expect(
			service.initializeMembers(OWNER_ID, BOOKING_ID, "missing-user", {
				members: [{ userId: MEMBER_ID }],
			})
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("replays the authoritative roster for the same normalized request", async () => {
		const saved = Object.assign(new BookingMember(), {
			id: "member-row-1",
			bookingId: BOOKING_ID,
			userId: OWNER_ID,
			isPrimary: true,
			memberStatus: BookingMemberStatus.REGISTERED,
			createdAt: NOW,
			updatedAt: NOW,
		});
		membersRepository.findByBooking.mockResolvedValue([saved]);

		const fingerprint = (
			service as unknown as {
				fingerprintMembers: (id: string, dto: { members: Array<{ userId: string }> }) => string;
			}
		).fingerprintMembers(BOOKING_ID, { members: [] });
		membersRepository.findInitializationByKey.mockResolvedValue({
			id: "initialization-1",
			bookingId: BOOKING_ID,
			actorId: OWNER_ID,
			idempotencyKey: "replay",
			requestFingerprint: fingerprint,
			createdAt: NOW,
		});

		await expect(
			service.initializeMembers(OWNER_ID, BOOKING_ID, "replay", { members: [] })
		).resolves.toMatchObject({ bookingId: BOOKING_ID });
		expect(bookingsRepository.findForUpdate).not.toHaveBeenCalled();
		expect(membersRepository.save).not.toHaveBeenCalled();
		expect(auditRepository.save).not.toHaveBeenCalled();
	});

	it("rejects the same key with a different payload", async () => {
		membersRepository.findInitializationByKey.mockResolvedValue({
			id: "initialization-1",
			bookingId: BOOKING_ID,
			actorId: OWNER_ID,
			idempotencyKey: "mismatch",
			requestFingerprint: "different",
			createdAt: NOW,
		});
		await expect(
			service.initializeMembers(OWNER_ID, BOOKING_ID, "mismatch", {
				members: [{ userId: MEMBER_ID }],
			})
		).rejects.toBeInstanceOf(ConflictException);
		expect(membersRepository.save).not.toHaveBeenCalled();
	});

	it("propagates audit failure so the transaction can roll back", async () => {
		auditRepository.save.mockRejectedValue(new Error("audit failed"));
		await expect(
			service.initializeMembers(OWNER_ID, BOOKING_ID, "audit-failure", {
				members: [{ userId: MEMBER_ID }],
			})
		).rejects.toThrow("audit failed");
		expect(membersRepository.saveInitialization).not.toHaveBeenCalled();
	});

	it("rejects an inconsistent authoritative seat reservation", async () => {
		tripRepository.findOne.mockResolvedValue({
			id: TRIP_ID,
			startsAt: STARTS_AT,
			capacityMax: 10,
			seatsTaken: 1,
		});
		await expect(
			service.initializeMembers(OWNER_ID, BOOKING_ID, "seat-conflict", {
				members: [{ userId: OTHER_MEMBER_ID }],
			})
		).rejects.toBeInstanceOf(ConflictException);
	});
});
