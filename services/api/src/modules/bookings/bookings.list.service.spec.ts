import type { ConfigService } from "@nestjs/config";
import type { DataSource } from "typeorm";
import type { EquipmentCatalogRepository } from "../equipment-catalog/equipment-catalog.repository";
import { BookingPaymentStatus, BookingStatus } from "../profiles/entities/booking.entity";
import type { TripsRepository } from "../trips/repositories/trips.repository";
import type { RouteRegistrationRiskService } from "../weather/services/route-registration-risk.service";
import type { BookingItemsRepository } from "./booking-items.repository";
import type { BookingMembersRepository } from "./booking-members.repository";
import type { BookingsRepository } from "./bookings.repository";
import { BookingsService } from "./bookings.service";
import type { BookingListItemResponseDto } from "./dto/booking-list-item-response.dto";
import type { EquipmentReservationsRepository } from "./equipment-reservations.repository";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";

describe("BookingsService.listForOwner", () => {
	it("returns the owner-scoped projection unchanged without write-side behavior", async () => {
		const rows: BookingListItemResponseDto[] = [
			{
				id: "77777777-7777-4777-8777-777777777777",
				tripId: "33333333-3333-4333-8333-333333333333",
				numPeople: null,
				status: BookingStatus.COMPLETED,
				paymentStatus: BookingPaymentStatus.PAID,
				holdExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
				tripStartsAtSnapshot: null,
				tripEndsAtSnapshot: null,
				totalAmount: "1700000.00",
				createdAt: new Date("2029-01-01T00:00:00.000Z"),
				tripPresentation: null,
			},
		];
		const repository = {
			findListByOwner: jest.fn().mockResolvedValue(rows),
			save: jest.fn(),
			update: jest.fn(),
		};
		const dataSource = { transaction: jest.fn() };
		const service = new BookingsService(
			repository as unknown as BookingsRepository,
			{} as TripsRepository,
			{} as RouteRegistrationRiskService,
			dataSource as unknown as DataSource,
			{} as ConfigService,
			{} as BookingItemsRepository,
			{} as BookingMembersRepository,
			{} as EquipmentCatalogRepository,
			{} as EquipmentReservationsRepository
		);

		await expect(service.listForOwner(OWNER_ID)).resolves.toBe(rows);
		expect(repository.findListByOwner).toHaveBeenCalledWith(OWNER_ID);
		expect(rows[0].totalAmount).toBe("1700000.00");
		expect(rows[0].tripPresentation).toBeNull();
		expect(repository.save).not.toHaveBeenCalled();
		expect(repository.update).not.toHaveBeenCalled();
		expect(dataSource.transaction).not.toHaveBeenCalled();
	});

	it("returns an empty owner list", async () => {
		const repository = { findListByOwner: jest.fn().mockResolvedValue([]) };
		const service = new BookingsService(
			repository as unknown as BookingsRepository,
			{} as TripsRepository,
			{} as RouteRegistrationRiskService,
			{} as DataSource,
			{} as ConfigService,
			{} as BookingItemsRepository,
			{} as BookingMembersRepository,
			{} as EquipmentCatalogRepository,
			{} as EquipmentReservationsRepository
		);

		await expect(service.listForOwner(OWNER_ID)).resolves.toEqual([]);
	});
});
