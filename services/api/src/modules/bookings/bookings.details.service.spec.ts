import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { DataSource } from "typeorm";
import type { EquipmentCatalogRepository } from "../equipment-catalog/equipment-catalog.repository";
import { BookingPaymentStatus, BookingStatus } from "../profiles/entities/booking.entity";
import type { TripsRepository } from "../trips/repositories/trips.repository";
import type { RouteRegistrationRiskService } from "../weather/services/route-registration-risk.service";
import { BookingItemType } from "./booking-item-type.enum";
import type { BookingItemsRepository } from "./booking-items.repository";
import { BookingMemberStatus } from "./booking-member-status.enum";
import type { BookingMembersRepository } from "./booking-members.repository";
import type { BookingsRepository } from "./bookings.repository";
import { BookingsService } from "./bookings.service";
import type { BookingDetailsResponseDto } from "./dto/booking-details-response.dto";
import type { EquipmentReservationsRepository } from "./equipment-reservations.repository";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const BOOKING_ID = "77777777-7777-4777-8777-777777777777";

function detail(status: BookingStatus = BookingStatus.PENDING_PAYMENT): BookingDetailsResponseDto {
	return {
		id: BOOKING_ID,
		tripId: "33333333-3333-4333-8333-333333333333",
		userId: OWNER_ID,
		numPeople: 2,
		status,
		paymentStatus:
			status === BookingStatus.PENDING_PAYMENT
				? BookingPaymentStatus.UNPAID
				: BookingPaymentStatus.PAID,
		holdExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
		tripStartsAtSnapshot: new Date("2030-01-01T00:00:00.000Z"),
		tripEndsAtSnapshot: new Date("2030-01-02T00:00:00.000Z"),
		basePrice: "1500000.00",
		totalAmount: "1700000.00",
		cancellationPolicySnapshot: { refundHours: 48 },
		createdAt: new Date("2029-01-01T00:00:00.000Z"),
		tripPresentation: null,
		members: [
			{
				id: "member-1",
				userId: OWNER_ID,
				email: "owner@example.com",
				isPrimary: true,
				memberStatus: BookingMemberStatus.REGISTERED,
				createdAt: new Date("2029-01-01T00:00:00.000Z"),
				updatedAt: new Date("2029-01-01T00:00:00.000Z"),
			},
		],
		equipmentItems: [
			{
				id: "item-1",
				itemType: BookingItemType.EQUIPMENT,
				equipmentCatalogItemId: "66666666-6666-4666-8666-666666666666",
				quantity: 1,
				unitPrice: "200000.00",
				rentalDays: 1,
				totalPrice: "200000.00",
				createdAt: new Date("2029-01-01T00:00:00.000Z"),
				presentation: null,
			},
		],
	};
}

describe("BookingsService.getBookingDetails", () => {
	let repository: {
		findOwnershipById: jest.Mock;
		findDetailsByIdForOwner: jest.Mock;
		save: jest.Mock;
		update: jest.Mock;
	};
	let service: BookingsService;

	beforeEach(() => {
		repository = {
			findOwnershipById: jest.fn().mockResolvedValue({ id: BOOKING_ID, userId: OWNER_ID }),
			findDetailsByIdForOwner: jest.fn().mockResolvedValue(detail()),
			save: jest.fn(),
			update: jest.fn(),
		};
		service = new BookingsService(
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
	});

	it("authorizes before loading participant email and returns the persisted aggregate", async () => {
		const result = await service.getBookingDetails(OWNER_ID, BOOKING_ID);

		expect(result.members[0]).toEqual(
			expect.objectContaining({ userId: OWNER_ID, email: "owner@example.com", isPrimary: true })
		);
		expect(result.members[0]).not.toHaveProperty("fullName");
		expect(repository.findOwnershipById.mock.invocationCallOrder[0]).toBeLessThan(
			repository.findDetailsByIdForOwner.mock.invocationCallOrder[0]
		);
		expect(repository.findDetailsByIdForOwner).toHaveBeenCalledWith(BOOKING_ID, OWNER_ID);
	});

	it("returns 404 without loading nested identity when the Booking is missing", async () => {
		repository.findOwnershipById.mockResolvedValue(null);

		await expect(service.getBookingDetails(OWNER_ID, BOOKING_ID)).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(repository.findDetailsByIdForOwner).not.toHaveBeenCalled();
	});

	it("returns 403 without loading nested identity for a foreign Booking", async () => {
		await expect(service.getBookingDetails(OTHER_ID, BOOKING_ID)).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(repository.findDetailsByIdForOwner).not.toHaveBeenCalled();
	});

	it.each(Object.values(BookingStatus))(
		"keeps %s readable without state mutation",
		async (status) => {
			repository.findDetailsByIdForOwner.mockResolvedValue(detail(status));

			const first = await service.getBookingDetails(OWNER_ID, BOOKING_ID);
			const second = await service.getBookingDetails(OWNER_ID, BOOKING_ID);

			expect(first.status).toBe(status);
			expect(second).toEqual(first);
			expect(repository.save).not.toHaveBeenCalled();
			expect(repository.update).not.toHaveBeenCalled();
		}
	);

	it("returns expired hold state, empty sections, and missing presentation exactly as stored", async () => {
		repository.findDetailsByIdForOwner.mockResolvedValue({
			...detail(),
			tripPresentation: null,
			members: [],
			equipmentItems: [],
		});

		const result = await service.getBookingDetails(OWNER_ID, BOOKING_ID);

		expect(result).toEqual(
			expect.objectContaining({
				status: BookingStatus.PENDING_PAYMENT,
				paymentStatus: BookingPaymentStatus.UNPAID,
				holdExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
				tripPresentation: null,
				members: [],
				equipmentItems: [],
			})
		);
	});
});
