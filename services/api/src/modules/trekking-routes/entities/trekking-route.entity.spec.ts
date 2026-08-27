import { TrekkingRouteStatus, isRouteEligibleForNewTrip } from "./trekking-route.entity";

describe("isRouteEligibleForNewTrip", () => {
	it.each([
		[TrekkingRouteStatus.DRAFT, false],
		[TrekkingRouteStatus.PENDING_APPROVAL, false],
		[TrekkingRouteStatus.ACTIVE, true],
		[TrekkingRouteStatus.CLOSED, false],
	] as const)("maps %s eligibility to %s", (status, expected) => {
		expect(isRouteEligibleForNewTrip(status)).toBe(expected);
	});
});
