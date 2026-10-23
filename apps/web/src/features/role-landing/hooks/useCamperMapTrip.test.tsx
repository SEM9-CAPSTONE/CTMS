import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { bookingListService } from "../../booking-list/services/booking-list.service";
import type { BookingListItem } from "../../booking-list/types";
import { tripsService } from "../../trips/services/trips.service";
import type { TripDetails } from "../../trips/types";
import { useCamperMapTrip } from "./useCamperMapTrip";
function wrapper({ children }: { children: ReactNode }) {
	return (
		<QueryClientProvider
			client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
		>
			{children}
		</QueryClientProvider>
	);
}
beforeEach(() => localStorage.setItem("accessToken", "test"));
afterEach(() => {
	localStorage.clear();
	vi.restoreAllMocks();
});
const booking = (
	id: string,
	status: BookingListItem["status"],
	starts: string,
	ends: string
): BookingListItem => ({
	id,
	tripId: id,
	status,
	tripStartsAtSnapshot: starts,
	tripEndsAtSnapshot: ends,
	numPeople: 1,
	paymentStatus: "paid",
	holdExpiresAt: null,
	totalAmount: "100",
	createdAt: starts,
	tripPresentation: null,
});
it("maps only confirmed future/ongoing bookings, preferring the earliest departure", async () => {
	vi.spyOn(bookingListService, "getMyBookings").mockResolvedValue([
		booking("cancelled", "cancelled", "2030-01-01", "2030-01-02"),
		booking("expired", "confirmed", "2020-01-01", "2020-01-02"),
		booking("later", "confirmed", "2030-01-03", "2030-01-04"),
		booking("next", "confirmed", "2030-01-01", "2030-01-02"),
	]);
	const get = vi
		.spyOn(tripsService, "getById")
		.mockResolvedValue({ id: "next", status: "published" } as TripDetails);
	const { result } = renderHook(() => useCamperMapTrip("camper", true), { wrapper });
	await waitFor(() => expect(result.current.data?.id).toBe("next"));
	expect(get).toHaveBeenCalledExactlyOnceWith("next");
});
it("does not invent a trip when there is no eligible booking", async () => {
	vi.spyOn(bookingListService, "getMyBookings").mockResolvedValue([]);
	const get = vi.spyOn(tripsService, "getById");
	const { result } = renderHook(() => useCamperMapTrip("camper", true), { wrapper });
	await waitFor(() => expect(result.current.isSuccess).toBe(true));
	expect(result.current.data).toBeNull();
	expect(get).not.toHaveBeenCalled();
});
it("never requests camper bookings for another active role", () => {
	const list = vi.spyOn(bookingListService, "getMyBookings");
	renderHook(() => useCamperMapTrip("host", false), { wrapper });
	expect(list).not.toHaveBeenCalled();
});
