import { HttpStatus } from "@nestjs/common";
import { HTTP_CODE_METADATA } from "@nestjs/common/constants";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole, UserStatus } from "../../users/entities/user.entity";
import { PorterRouteProficiency } from "../entities/porter-route-qualification.entity";
import type { PorterRouteQualificationsService } from "../services/porter-route-qualifications.service";
import { PorterRouteQualificationsController } from "./porter-route-qualifications.controller";

const ACTOR: AuthenticatedUser = {
	userId: "11111111-1111-1111-1111-111111111111",
	roles: [UserRole.PORTER],
	status: UserStatus.ACTIVE,
};
const ROUTE_ID = "22222222-2222-2222-2222-222222222222";

describe("PorterRouteQualificationsController", () => {
	it("returns HTTP 200 for the shared create/update PUT contract and delegates auth identity", async () => {
		const service = {
			upsertMine: jest.fn().mockResolvedValue({ qualificationId: "qualification-id" }),
		};
		const controller = new PorterRouteQualificationsController(
			service as unknown as PorterRouteQualificationsService
		);
		const dto = { proficiency: PorterRouteProficiency.PROFICIENT, timesLed: 2 };

		await controller.upsertMine({ user: ACTOR }, { routeId: ROUTE_ID }, dto);

		expect(service.upsertMine).toHaveBeenCalledWith(ACTOR.userId, ROUTE_ID, dto);
		expect(
			Reflect.getMetadata(
				HTTP_CODE_METADATA,
				PorterRouteQualificationsController.prototype.upsertMine
			)
		).toBe(HttpStatus.OK);
	});
});
