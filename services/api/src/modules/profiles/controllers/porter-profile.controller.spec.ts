import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole, UserStatus } from "../../users/entities/user.entity";
import { PorterAvailabilityStatus } from "../entities/porter-profile.entity";
import type { PorterProfilesService } from "../services/porter-profiles.service";
import { PorterProfileController } from "./porter-profile.controller";

const ACTOR: AuthenticatedUser = {
	userId: "11111111-1111-1111-1111-111111111111",
	roles: [UserRole.PORTER],
	status: UserStatus.ACTIVE,
};

describe("PorterProfileController", () => {
	it("derives profile ownership from the authenticated actor", async () => {
		const service = { updateMyProfile: jest.fn().mockResolvedValue({ version: 1 }) };
		const controller = new PorterProfileController(service as unknown as PorterProfilesService);
		const dto = { availabilityStatus: PorterAvailabilityStatus.AVAILABLE };

		await controller.updateMyProfile({ user: ACTOR }, dto);

		expect(service.updateMyProfile).toHaveBeenCalledWith(ACTOR.userId, dto);
	});
});
