import { type ExecutionContext, ForbiddenException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { UserRole, UserStatus } from "../../users/entities/user.entity";
import { RolesGuard } from "./roles.guard";

function buildContext(roles: UserRole[]): ExecutionContext {
	return {
		getHandler: jest.fn(),
		getClass: jest.fn(),
		switchToHttp: jest.fn().mockReturnValue({
			getRequest: jest.fn().mockReturnValue({
				user: {
					userId: "11111111-1111-1111-1111-111111111111",
					roles,
					status: UserStatus.ACTIVE,
				},
			}),
		}),
	} as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
	it("allows a user with at least one required role", () => {
		const reflector = {
			getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
		} as unknown as Reflector;
		const guard = new RolesGuard(reflector);

		expect(guard.canActivate(buildContext([UserRole.CAMPER, UserRole.ADMIN]))).toBe(true);
	});

	it("returns 403 when no granted role matches", () => {
		const reflector = {
			getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
		} as unknown as Reflector;
		const guard = new RolesGuard(reflector);

		expect(() => guard.canActivate(buildContext([UserRole.CAMPER]))).toThrow(ForbiddenException);
	});

	it("fails closed when the route has no role metadata", () => {
		const reflector = {
			getAllAndOverride: jest.fn().mockReturnValue(undefined),
		} as unknown as Reflector;
		const guard = new RolesGuard(reflector);

		expect(() => guard.canActivate(buildContext([UserRole.ADMIN]))).toThrow(ForbiddenException);
	});
});
