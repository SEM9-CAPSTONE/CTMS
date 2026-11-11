import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import type { TripMemberRosterResponse } from "../types";
import { useTripMemberRoster } from "./useTripMemberRoster";

const roster: TripMemberRosterResponse = {
	tripId: "trip-1",
	status: "published",
	startsAt: "2035-01-01T00:00:00.000Z",
	members: [],
};

describe("useTripMemberRoster", () => {
	beforeEach(() => vi.clearAllMocks());

	it("loads authoritative roster data, including an empty roster", async () => {
		const loadRoster = vi.fn().mockResolvedValue(roster);
		const { result } = renderHook(() => useTripMemberRoster("trip-1", loadRoster));
		expect(result.current.isLoading).toBe(true);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.data).toEqual(roster);
		expect(result.current.data?.members).toEqual([]);
	});

	it("maps load errors and supports refetch", async () => {
		const loadRoster = vi
			.fn()
			.mockRejectedValueOnce(new HttpError("down", 500, null))
			.mockResolvedValueOnce(roster);
		const { result } = renderHook(() => useTripMemberRoster("trip-1", loadRoster));
		await waitFor(() => expect(result.current.error?.kind).toBe("retryable"));
		await act(async () => void (await result.current.refetch()));
		expect(result.current.data).toEqual(roster);
		expect(result.current.error).toBeNull();
	});
});
