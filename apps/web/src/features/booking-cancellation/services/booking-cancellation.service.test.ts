import { afterEach, expect, it, vi } from "vitest";
import { httpClient } from "../../../core/api";
import { cancellationFixture } from "../test-fixtures";
import { bookingCancellationService } from "./booking-cancellation.service";

afterEach(() => vi.restoreAllMocks());
it("PATCHes only the approved body without a client idempotency key or money conversion", async () => {
	const patch = vi.spyOn(httpClient, "patch").mockResolvedValue(cancellationFixture);
	expect(await bookingCancellationService.cancel("booking-1", { reason: "reason" })).toEqual(
		cancellationFixture
	);
	expect(patch).toHaveBeenCalledWith("/bookings/booking-1/cancel", { reason: "reason" });
});
