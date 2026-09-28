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
});
