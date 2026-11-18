import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import { BookingStatus } from "../profiles/entities/booking.entity";
import { canEditPorterReview, porterReviewEligibility } from "./porter-reviews.policy";
import {
	PORTER_REVIEW_WINDOW_MS,
	type PorterReviewParticipation,
	type PorterReviewRecord,
} from "./porter-reviews.types";

const completedAt = new Date("2026-11-01T01:00:00Z");
const expiresAt = new Date(completedAt.getTime() + PORTER_REVIEW_WINDOW_MS);
const participation: PorterReviewParticipation = {
	bookingId: "booking",
	memberId: "member",
	reviewerId: "camper",
	tripId: "trip",
	hostId: "host",
	bookingStatus: BookingStatus.COMPLETED,
	memberStatus: BookingMemberStatus.JOINED,
	completedAt,
	checkedInAt: new Date("2026-10-31T01:00:00Z"),
	leftAt: null,
};
const review: PorterReviewRecord = {
	id: "review",
	bookingId: "booking",
	memberId: "member",
	reviewerId: "camper",
	tripId: "trip",
	porterId: "porter",
	rating: 4,
	comment: null,
	revision: 1,
	moderationStatus: "visible",
	createdAt: new Date(completedAt.getTime() + PORTER_REVIEW_WINDOW_MS - 1000),
	updatedAt: new Date(completedAt.getTime() + PORTER_REVIEW_WINDOW_MS - 1000),
	editExpiresAt: expiresAt,
};
describe("Porter review completion-based window", () => {
	it.each([0, PORTER_REVIEW_WINDOW_MS - 1])("allows creation at +%d ms", (offset) => {
		expect(
			porterReviewEligibility(participation, new Date(completedAt.getTime() + offset))
		).toMatchObject({
			eligible: true,
			expiresAt,
			reason: null,
		});
	});
	it.each([PORTER_REVIEW_WINDOW_MS, PORTER_REVIEW_WINDOW_MS + 1])(
		"rejects creation at +%d ms",
		(offset) => {
			expect(
				porterReviewEligibility(participation, new Date(completedAt.getTime() + offset))
			).toMatchObject({
				eligible: false,
				reason: "WINDOW_EXPIRED",
			});
		}
	);
	it.each([
		{ bookingStatus: BookingStatus.CONFIRMED },
		{ completedAt: null },
		{ checkedInAt: null },
		{ memberStatus: BookingMemberStatus.NO_SHOW },
		{ memberStatus: BookingMemberStatus.REGISTERED },
		{ memberStatus: BookingMemberStatus.REMOVED },
		{ memberStatus: BookingMemberStatus.LEFT },
		{ leftAt: completedAt },
		{ checkedInAt: expiresAt },
	])("rejects ineligible participation %p", (overrides) => {
		expect(porterReviewEligibility({ ...participation, ...overrides }, completedAt)).toMatchObject({
			eligible: false,
			reason: "PARTICIPATION_NOT_COMPLETED",
		});
	});
	it("rejects future completion", () => {
		expect(
			porterReviewEligibility(participation, new Date(completedAt.getTime() - 1)).eligible
		).toBe(false);
	});
	it("does not extend an edit deadline for a late-created review", () => {
		expect(canEditPorterReview(participation, review, new Date(expiresAt.getTime() - 1))).toBe(
			true
		);
		expect(canEditPorterReview(participation, review, expiresAt)).toBe(false);
	});
	it("does not extend the stored original deadline if completion data moves later", () => {
		expect(
			canEditPorterReview(
				{ ...participation, completedAt: new Date(completedAt.getTime() + 1) },
				review,
				expiresAt
			)
		).toBe(false);
	});
	it("does not allow edits before creation or by a different participation", () => {
		expect(canEditPorterReview(participation, review, completedAt)).toBe(false);
		expect(
			canEditPorterReview({ ...participation, memberId: "other" }, review, review.createdAt)
		).toBe(false);
		expect(
			canEditPorterReview({ ...participation, reviewerId: "other" }, review, review.createdAt)
		).toBe(false);
	});
});
