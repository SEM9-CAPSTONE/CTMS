import { afterEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "../../../core/api";
import { bookingMembersService } from "./booking-members.service";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("bookingMembersService", () => {
	it("uses the resolver and initialization contracts", async () => {
		const post = vi.spyOn(httpClient, "post").mockResolvedValue({});

		await bookingMembersService.resolveCandidate("booking-1", { email: "person@example.com" });
		await bookingMembersService.initialize(
			"booking-1",
			{ members: [{ userId: "22222222-2222-4222-8222-222222222222" }] },
			"attempt-1"
		);

		expect(post).toHaveBeenNthCalledWith(1, "/bookings/booking-1/member-candidates/resolve", {
			email: "person@example.com",
		});
		expect(post).toHaveBeenNthCalledWith(
			2,
			"/bookings/booking-1/members",
			{ members: [{ userId: "22222222-2222-4222-8222-222222222222" }] },
			{ headers: { "Idempotency-Key": "attempt-1" } }
		);
	});

	it("uses the operational roster read and nested status mutation contracts", async () => {
		const get = vi.spyOn(httpClient, "get").mockResolvedValue({ members: [] });
		const patch = vi.spyOn(httpClient, "patch").mockResolvedValue({ memberStatus: "joined" });

		await bookingMembersService.getTripRoster("trip-1");
		await bookingMembersService.updateStatus("trip-1", "booking-1", "member-1", {
			status: "joined",
		});
		await bookingMembersService.updateStatus("trip-1", "booking-1", "member-1", {
			status: "no_show",
		});

		expect(get).toHaveBeenCalledWith("/trips/trip-1/members");
		expect(patch).toHaveBeenNthCalledWith(
			1,
			"/trips/trip-1/bookings/booking-1/members/member-1/status",
			{ status: "joined" }
		);
		expect(patch).toHaveBeenNthCalledWith(
			2,
			"/trips/trip-1/bookings/booking-1/members/member-1/status",
			{ status: "no_show" }
		);
	});
});
