import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import { BookingStatus } from "../profiles/entities/booking.entity";
import { reviewEligibility } from "./trip-reviews.policy";
import {
	REVIEW_WINDOW_MS,
	ReviewIneligibleReason,
	type ReviewParticipation,
} from "./trip-reviews.types";

const completedAt = new Date("2026-11-01T01:00:00Z");
const participation: ReviewParticipation = {
	bookingId: "booking",
	memberId: "member",
	reviewerId: "camper",
	tripId: "trip",
	hostId: "host",
	bookingStatus: BookingStatus.COMPLETED,
	memberStatus: BookingMemberStatus.JOINED,
	checkedInAt: new Date("2026-10-31T01:00:00Z"),
	leftAt: null,
	completedAt,
};

describe("reviewEligibility (BR-297/300)", () => {
	it.each([0, 24 * 60 * 60 * 1000, 48 * 60 * 60 * 1000, REVIEW_WINDOW_MS - 1])(
		"allows completed participation at +%d ms",
		(elapsed) => {
			expect(
				reviewEligibility(participation, new Date(completedAt.getTime() + elapsed))
			).toMatchObject({ eligible: true, reason: null });
		}
	);
	it.each([REVIEW_WINDOW_MS, REVIEW_WINDOW_MS + 1])("expires at +%d ms", (elapsed) => {
		expect(
			reviewEligibility(participation, new Date(completedAt.getTime() + elapsed))
		).toMatchObject({ eligible: false, reason: ReviewIneligibleReason.WINDOW_EXPIRED });
	});
	it.each([
		{ bookingStatus: BookingStatus.CONFIRMED },
		{ completedAt: null },
		{ checkedInAt: null },
		{ memberStatus: BookingMemberStatus.NO_SHOW },
		{ memberStatus: BookingMemberStatus.REGISTERED },
		{ memberStatus: BookingMemberStatus.REMOVED },
		{ memberStatus: BookingMemberStatus.LEFT },
		{ leftAt: completedAt },
		{ checkedInAt: new Date(completedAt.getTime() + 1) },
	])("rejects incomplete participation %p", (overrides) => {
		expect(reviewEligibility({ ...participation, ...overrides }, completedAt).reason).toBe(
			ReviewIneligibleReason.PARTICIPATION_NOT_COMPLETED
		);
	});
	it("rejects a future completion time", () => {
		expect(reviewEligibility(participation, new Date(completedAt.getTime() - 1)).eligible).toBe(
			false
		);
	});
});
