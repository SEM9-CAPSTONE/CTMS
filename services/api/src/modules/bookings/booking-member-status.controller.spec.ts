import { ROLES_KEY } from "../auth/decorators/roles.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import { BookingMemberStatusController } from "./booking-member-status.controller";
import { BookingMemberStatus } from "./booking-member-status.enum";
import type { BookingMemberStatusService } from "./booking-member-status.service";

describe("BookingMemberStatusController", () => {
	it("forwards the actor and nested resource identifiers", async () => {
		const response = { id: "member-id" };
		const service = { updateStatus: jest.fn().mockResolvedValue(response) };
		const controller = new BookingMemberStatusController(
			service as unknown as BookingMemberStatusService
		);
		const user: AuthenticatedUser = {
			userId: "actor-id",
			roles: [UserRole.HOST],
			status: UserStatus.ACTIVE,
		};
		const dto = { status: BookingMemberStatus.JOINED } as const;

		await expect(
			controller.updateStatus({ user }, "trip-id", "booking-id", "member-id", dto)
		).resolves.toBe(response);
		expect(service.updateStatus).toHaveBeenCalledWith(
			user,
			"trip-id",
			"booking-id",
			"member-id",
			dto
		);
	});

	it("allows only Host and Porter roles", () => {
		expect(
			Reflect.getMetadata(ROLES_KEY, BookingMemberStatusController.prototype.updateStatus)
		).toEqual([UserRole.HOST, UserRole.PORTER]);
	});
});
