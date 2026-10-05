import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { BookingStatus } from "../profiles/entities/booking.entity";
import { TripStatus } from "../trips/entities/trip.entity";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import { BookingMemberStatus } from "./booking-member-status.enum";
import { TripRosterService } from "./trip-roster.service";

const HOST_ID = "11111111-1111-4111-8111-111111111111";
const PORTER_ID = "22222222-2222-4222-8222-222222222222";
const TRIP_ID = "33333333-3333-4333-8333-333333333333";

function actor(userId: string, roles: UserRole[]): AuthenticatedUser {
	return { userId, roles, status: UserStatus.ACTIVE };
}

describe("TripRosterService", () => {
	const trip = {
		tripId: TRIP_ID,
		hostId: HOST_ID,
		status: TripStatus.PUBLISHED,
		startsAt: new Date("2035-01-10T08:00:00.000Z"),
	};
	const member = {
		memberId: "44444444-4444-4444-8444-444444444444",
		bookingId: "55555555-5555-4555-8555-555555555555",
		userId: "66666666-6666-4666-8666-666666666666",
		displayName: "Demo Camper",
		email: "camper@example.com",
		isPrimary: true,
		memberStatus: BookingMemberStatus.JOINED,
		bookingStatus: BookingStatus.CONFIRMED,
		checkedInAt: new Date("2035-01-10T07:30:00.000Z"),
		noShowAt: null,
		leftAt: null,
	};

	function setup(options: { tripRows?: unknown[]; assignmentRows?: unknown[] } = {}) {
		const query = jest.fn().mockImplementation((sql: string) => {
			if (sql.includes('FROM "trips"')) return Promise.resolve(options.tripRows ?? [trip]);
			if (sql.includes('FROM "trip_porters"'))
				return Promise.resolve(options.assignmentRows ?? [{ exists: 1 }]);
			return Promise.resolve([member]);
		});
		const manager = { query } as unknown as EntityManager;
		const dataSource = {
			transaction: jest.fn().mockImplementation((_isolation, work) => work(manager)),
		};
		return {
			service: new TripRosterService(dataSource as never),
			query,
			dataSource,
		};
	}

	it("returns the full authoritative roster contract to the owning Host", async () => {
		const { service, query, dataSource } = setup();

		const result = await service.getRoster(actor(HOST_ID, [UserRole.HOST]), TRIP_ID);

		expect(dataSource.transaction).toHaveBeenCalledWith("REPEATABLE READ", expect.any(Function));
		expect(result).toEqual({
			tripId: TRIP_ID,
			status: TripStatus.PUBLISHED,
			startsAt: trip.startsAt,
			members: [member],
		});
		expect(query).toHaveBeenCalledTimes(2);
		expect(query.mock.calls[1]?.[0]).toContain(
			'ORDER BY\n\t\t\t\tb."created_at" ASC,\n\t\t\t\tb."id" ASC,\n\t\t\t\tbm."is_primary" DESC,\n\t\t\t\tbm."created_at" ASC,\n\t\t\t\tbm."id" ASC'
		);
		expect(result.members[0]).not.toHaveProperty("statusUpdatedBy");
		expect(result.members[0]).not.toHaveProperty("paymentStatus");
	});

	it("allows an exactly assigned Porter", async () => {
		const { service, query } = setup();

		await expect(service.getRoster(actor(PORTER_ID, [UserRole.PORTER]), TRIP_ID)).resolves.toEqual(
			expect.objectContaining({ members: [member] })
		);
		expect(query).toHaveBeenCalledWith(expect.stringContaining('"status" = $3'), [
			TRIP_ID,
			PORTER_ID,
			"assigned",
		]);
	});

	it("rejects an unrelated Host", async () => {
		const { service } = setup();
		await expect(
			service.getRoster(actor(PORTER_ID, [UserRole.HOST]), TRIP_ID)
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it.each(["unassigned", "pending_reconfirmation"])(
		"rejects a Porter without an assigned row (%s)",
		async () => {
			const { service } = setup({ assignmentRows: [] });
			await expect(
				service.getRoster(actor(PORTER_ID, [UserRole.PORTER]), TRIP_ID)
			).rejects.toBeInstanceOf(ForbiddenException);
		}
	);

	it("rejects roles outside the operational contract", async () => {
		const { service } = setup();
		await expect(
			service.getRoster(actor(PORTER_ID, [UserRole.CAMPER]), TRIP_ID)
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it("returns 404 when the Trip does not exist", async () => {
		const { service } = setup({ tripRows: [] });
		await expect(
			service.getRoster(actor(HOST_ID, [UserRole.HOST]), TRIP_ID)
		).rejects.toBeInstanceOf(NotFoundException);
	});
});
