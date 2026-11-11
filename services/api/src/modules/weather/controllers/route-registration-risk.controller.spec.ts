import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { UserRole, UserStatus } from "../../users/entities/user.entity";
import { RiskLevel } from "../entities/weather-risk-assessment.entity";
import { RouteRegistrationRiskController } from "./route-registration-risk.controller";

describe("RouteRegistrationRiskController", () => {
	let controller: RouteRegistrationRiskController;
	let routeRegistrationRiskService: {
		assertRegistrationAllowedForRoute: jest.Mock;
	};

	beforeEach(() => {
		routeRegistrationRiskService = {
			assertRegistrationAllowedForRoute: jest.fn(),
		};

		controller = new RouteRegistrationRiskController(routeRegistrationRiskService as never);
	});

	it("returns eligibility response when registration is allowed (Risk is Green or Yellow)", async () => {
		const req = {
			user: {
				userId: "user-1",
				roles: [UserRole.CAMPER],
				status: UserStatus.ACTIVE,
			},
		};
		const expectedResponse = {
			allowed: true,
			routeId: "route-1",
			riskLevel: RiskLevel.GREEN,
			assessmentTime: new Date(),
			compositeScore: 0.1,
			reasons: [],
		};

		routeRegistrationRiskService.assertRegistrationAllowedForRoute.mockResolvedValue(
			expectedResponse
		);

		const result = await controller.checkEligibility({ routeId: "route-1" }, req);
		expect(result).toBe(expectedResponse);
		expect(routeRegistrationRiskService.assertRegistrationAllowedForRoute).toHaveBeenCalledWith(
			req.user,
			"route-1"
		);
	});

	it("propagates 409 Conflict exception when route risk level is RED", async () => {
		const req = {
			user: {
				userId: "user-1",
				roles: [UserRole.CAMPER],
				status: UserStatus.ACTIVE,
			},
		};

		routeRegistrationRiskService.assertRegistrationAllowedForRoute.mockRejectedValue(
			new ConflictException({
				statusCode: 409,
				message: "New registrations are blocked because route weather risk is RED",
				allowed: false,
				routeId: "route-1",
				riskLevel: RiskLevel.RED,
				assessmentTime: new Date(),
				compositeScore: 1.4,
				reasons: [
					{
						criterion: "rainfall",
						level: RiskLevel.RED,
						value: 65,
						message: "Rainfall (65mm) exceeds Red threshold",
					},
				],
			})
		);

		await expect(controller.checkEligibility({ routeId: "route-1" }, req)).rejects.toThrow(
			ConflictException
		);
	});

	it("propagates 403 Forbidden exception when user account is suspended (BR-202)", async () => {
		const req = {
			user: {
				userId: "user-1",
				roles: [UserRole.CAMPER],
				status: UserStatus.SUSPENDED,
			},
		};

		routeRegistrationRiskService.assertRegistrationAllowedForRoute.mockRejectedValue(
			new ForbiddenException("Account is not active.")
		);

		await expect(controller.checkEligibility({ routeId: "route-1" }, req)).rejects.toThrow(
			ForbiddenException
		);
	});

	it("propagates 404 NotFound exception when route does not exist", async () => {
		const req = {
			user: {
				userId: "user-1",
				roles: [UserRole.CAMPER],
				status: UserStatus.ACTIVE,
			},
		};

		routeRegistrationRiskService.assertRegistrationAllowedForRoute.mockRejectedValue(
			new NotFoundException("Trekking route not found")
		);

		await expect(controller.checkEligibility({ routeId: "missing-route" }, req)).rejects.toThrow(
			NotFoundException
		);
	});
});
