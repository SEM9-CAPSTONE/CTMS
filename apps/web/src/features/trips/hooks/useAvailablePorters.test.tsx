import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError, queryKeys } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import { mapAvailablePortersError, useAvailablePorters } from "./useAvailablePorters";

function createWrapper() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: 0 } },
	});
	return {
		client,
		wrapper: ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={client}>{children}</QueryClientProvider>
		),
	};
}

afterEach(() => vi.restoreAllMocks());

describe("useAvailablePorters", () => {
	it("does not fetch until the Host explicitly selects a role", () => {
		const search = vi.spyOn(tripsService, "getAvailablePorters");
		const { wrapper } = createWrapper();

		renderHook(
			() =>
				useAvailablePorters({
					tripId: "trip-201",
					role: null,
					page: 1,
					limit: 20,
				}),
			{ wrapper }
		);

		expect(search).not.toHaveBeenCalled();
	});

	it("uses every authoritative input in its query key and request", async () => {
		const response = {
			items: [],
			pagination: { page: 3, limit: 20, total: 0, totalPages: 0 },
		};
		const search = vi.spyOn(tripsService, "getAvailablePorters").mockResolvedValue(response);
		const { client, wrapper } = createWrapper();

		const { result } = renderHook(
			() =>
				useAvailablePorters({
					tripId: "trip-201",
					role: "lead",
					minExperienceYears: 5,
					page: 3,
					limit: 20,
				}),
			{ wrapper }
		);

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(search).toHaveBeenCalledWith("trip-201", {
			role: "lead",
			minExperienceYears: 5,
			page: 3,
			limit: 20,
		});
		expect(
			client.getQueryData(queryKeys.trips.availablePorters("trip-201", "lead", 5, 3, 20))
		).toEqual(response);
	});

	it.each([
		[401, "authentication", false],
		[403, "forbidden", false],
		[404, "notFound", false],
		[400, "validation", false],
		[422, "validation", false],
		[503, "retryable", true],
	] as const)("maps HTTP %s without exposing backend details", (status, kind, canRetry) => {
		expect(mapAvailablePortersError(new HttpError("raw backend detail", status, {}))).toEqual(
			expect.objectContaining({ kind, canRetry })
		);
	});
});
