import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import { BookingsController } from "./bookings.controller";
import type { BookingsService } from "./bookings.service";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TRIP_ID = "33333333-3333-4333-8333-333333333333";
const ACTOR: AuthenticatedUser = {
	userId: USER_ID,
	roles: [UserRole.CAMPER],
	status: UserStatus.ACTIVE,
};

describe("BookingsController", () => {
	it("forwards the authenticated Camper, idempotency key, and DTO", async () => {
		const response = { id: "booking-id" };
		const service = { create: jest.fn().mockResolvedValue(response) };
		const controller = new BookingsController(service as unknown as BookingsService);
		const dto = { tripId: TRIP_ID, numPeople: 2 };

		await expect(controller.create({ user: ACTOR }, "attempt-1", dto)).resolves.toBe(response);
		expect(service.create).toHaveBeenCalledWith(USER_ID, "attempt-1", dto);
	});
});
