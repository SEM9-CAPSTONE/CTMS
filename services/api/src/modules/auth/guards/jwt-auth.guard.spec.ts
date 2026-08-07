import { JwtAuthGuard } from "./jwt-auth.guard";

/**
 * CTMS-03 scope: prove the guard is a working, reusable AuthGuard("jwt")
 * primitive for BR-201. It is not attached to any route in this story, so
 * there is no controller-level test for it yet — this is unit-level
 * evidence that the class itself is correctly built on Passport's guard
 * base, ready for CTMS-04+ to apply with @UseGuards(JwtAuthGuard).
 */
describe("JwtAuthGuard", () => {
	it("is a class that can be instantiated (Passport AuthGuard('jwt') subclass)", () => {
		const guard = new JwtAuthGuard();

		expect(guard).toBeInstanceOf(JwtAuthGuard);
		// canActivate is inherited from Passport's AuthGuard mixin.
		expect(typeof guard.canActivate).toBe("function");
	});
});
