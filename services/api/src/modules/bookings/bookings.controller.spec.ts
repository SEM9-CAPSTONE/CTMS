import { HTTP_CODE_METADATA } from "@nestjs/common/constants";
import { ROLES_KEY } from "../auth/decorators/roles.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import { BookingsController } from "./bookings.controller";
import type { BookingsService } from "./bookings.service";
import { ResolveBookingMemberCandidateDto } from "./dto/resolve-booking-member-candidate.dto";
import type { PaymentsService } from "./payments.service";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TRIP_ID = "33333333-3333-4333-8333-333333333333";
const BOOKING_ID = "77777777-7777-4777-8777-777777777777";
const ACTOR: AuthenticatedUser = {
	userId: USER_ID,
	roles: [UserRole.CAMPER],
	status: UserStatus.ACTIVE,
};

describe("BookingsController", () => {
	const defaultPaymentsService = {} as unknown as PaymentsService;

	it("lists only the authenticated Camper's Bookings", async () => {
		const response = [{ id: BOOKING_ID }];
		const service = { listForOwner: jest.fn().mockResolvedValue(response) };
		const controller = new BookingsController(
			service as unknown as BookingsService,
			defaultPaymentsService
		);

		await expect(controller.listForOwner({ user: ACTOR })).resolves.toBe(response);
		expect(service.listForOwner).toHaveBeenCalledWith(USER_ID);
		expect(Reflect.getMetadata(ROLES_KEY, BookingsController.prototype.listForOwner)).toEqual([
			UserRole.CAMPER,
		]);
	});

	it("forwards the authenticated Camper, idempotency key, and DTO", async () => {
		const response = { id: "booking-id" };
		const service = { create: jest.fn().mockResolvedValue(response) };
		const controller = new BookingsController(
			service as unknown as BookingsService,
			defaultPaymentsService
		);
		const dto = { tripId: TRIP_ID, numPeople: 2 };

		await expect(controller.create({ user: ACTOR }, "attempt-1", dto)).resolves.toBe(response);
		expect(service.create).toHaveBeenCalledWith(USER_ID, "attempt-1", dto);
	});

	it("addItem forwards the authenticated Camper, bookingId, idempotency key, and DTO", async () => {
		const response = { item: { id: "item-1" }, booking: { id: BOOKING_ID } };
		const service = { addItem: jest.fn().mockResolvedValue(response) };
		const controller = new BookingsController(
			service as unknown as BookingsService,
			defaultPaymentsService
		);
		const dto = { equipmentCatalogItemId: "66666666-6666-4666-8666-666666666666", quantity: 2 };

		await expect(controller.addItem({ user: ACTOR }, BOOKING_ID, "add-1", dto)).resolves.toBe(
			response
		);
		expect(service.addItem).toHaveBeenCalledWith(USER_ID, BOOKING_ID, "add-1", dto);
	});

	it("initializeMembers forwards the authenticated Camper, Booking, key, and roster", async () => {
		const response = { bookingId: BOOKING_ID, members: [] };
		const service = { initializeMembers: jest.fn().mockResolvedValue(response) };
		const controller = new BookingsController(
			service as unknown as BookingsService,
			defaultPaymentsService
		);
		const dto = { members: [{ userId: "22222222-2222-4222-8222-222222222222" }] };

		await expect(
			controller.initializeMembers({ user: ACTOR }, BOOKING_ID, "members-1", dto)
		).resolves.toBe(response);
		expect(service.initializeMembers).toHaveBeenCalledWith(USER_ID, BOOKING_ID, "members-1", dto);
	});

	it("restricts roster initialization to Campers", () => {
		expect(Reflect.getMetadata(ROLES_KEY, BookingsController.prototype.initializeMembers)).toEqual([
			UserRole.CAMPER,
		]);
	});

	it("resolves a member candidate for the authenticated Booking owner", async () => {
		const response = { userId: USER_ID, email: "participant@example.com" };
		const service = { resolveMemberCandidate: jest.fn().mockResolvedValue(response) };
		const controller = new BookingsController(
			service as unknown as BookingsService,
			defaultPaymentsService
		);
		const dto = { email: "participant@example.com" };

		await expect(controller.resolveMemberCandidate({ user: ACTOR }, BOOKING_ID, dto)).resolves.toBe(
			response
		);
		expect(service.resolveMemberCandidate).toHaveBeenCalledWith(USER_ID, BOOKING_ID, dto);
		expect(
			Reflect.getMetadata(ROLES_KEY, BookingsController.prototype.resolveMemberCandidate)
		).toEqual([UserRole.CAMPER]);
		expect(
			Reflect.getMetadata(HTTP_CODE_METADATA, BookingsController.prototype.resolveMemberCandidate)
		).toBe(200);
		expect(
			Reflect.getMetadata(
				"design:paramtypes",
				BookingsController.prototype,
				"resolveMemberCandidate"
			)
		).toEqual([Object, String, ResolveBookingMemberCandidateDto]);
	});

	it("listItems forwards the authenticated Camper and bookingId", async () => {
		const response = [{ id: "item-1" }];
		const service = { listItems: jest.fn().mockResolvedValue(response) };
		const controller = new BookingsController(
			service as unknown as BookingsService,
			defaultPaymentsService
		);

		await expect(controller.listItems({ user: ACTOR }, BOOKING_ID)).resolves.toBe(response);
		expect(service.listItems).toHaveBeenCalledWith(USER_ID, BOOKING_ID);
	});

	it("pay forwards the authenticated Camper, bookingId, idempotency key, and DTO", async () => {
		const response = {
			paymentId: "payment-1",
			bookingId: BOOKING_ID,
			amount: "1500000.00",
		};
		const bookingsService = {} as unknown as BookingsService;
		const paymentsService = { pay: jest.fn().mockResolvedValue(response) };
		const controller = new BookingsController(
			bookingsService,
			paymentsService as unknown as PaymentsService
		);
		const dto = { method: "CARD" };

		await expect(controller.pay({ user: ACTOR }, BOOKING_ID, "pay-attempt-1", dto)).resolves.toBe(
			response
		);
		expect(paymentsService.pay).toHaveBeenCalledWith(USER_ID, BOOKING_ID, "pay-attempt-1", dto);
	});

	it("restricts pay to Campers", () => {
		expect(Reflect.getMetadata(ROLES_KEY, BookingsController.prototype.pay)).toEqual([
			UserRole.CAMPER,
		]);
	});

	it("getBookingDetails delegates the authenticated Camper and uses Camper role metadata", async () => {
		const response = { id: BOOKING_ID, members: [], equipmentItems: [] };
		const service = { getBookingDetails: jest.fn().mockResolvedValue(response) };
		const controller = new BookingsController(
			service as unknown as BookingsService,
			defaultPaymentsService
		);

		await expect(controller.getBookingDetails({ user: ACTOR }, BOOKING_ID)).resolves.toBe(response);
		expect(service.getBookingDetails).toHaveBeenCalledWith(USER_ID, BOOKING_ID);
		expect(Reflect.getMetadata(ROLES_KEY, BookingsController.prototype.getBookingDetails)).toEqual([
			UserRole.CAMPER,
		]);
	});

	it("getPackingList delegates the authenticated Camper and uses Camper role metadata", async () => {
		const response = { bookingId: BOOKING_ID, tripId: TRIP_ID, context: {}, items: [] };
		const service = { getPackingList: jest.fn().mockResolvedValue(response) };
		const controller = new BookingsController(
			service as unknown as BookingsService,
			defaultPaymentsService
		);

		await expect(controller.getPackingList({ user: ACTOR }, BOOKING_ID)).resolves.toBe(response);
		expect(service.getPackingList).toHaveBeenCalledWith(USER_ID, BOOKING_ID);
		expect(Reflect.getMetadata(ROLES_KEY, BookingsController.prototype.getPackingList)).toEqual([
			UserRole.CAMPER,
		]);
	});
});
