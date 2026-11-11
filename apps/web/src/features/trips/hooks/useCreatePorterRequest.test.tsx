import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { PorterRequest } from "../types";
import { mapCreatePorterRequestError, useCreatePorterRequest } from "./useCreatePorterRequest";

const REQUEST: PorterRequest = {
	id: "request-1",
	tripId: "trip-201",
	porterId: "porter-1",
	requestedBy: "host-1",
	requestedRole: "support",
	note: "Support river crossing",
	status: "pending",
	expiresAt: "2035-07-10T08:00:00.000Z",
	respondedAt: null,
	createdAt: "2035-07-08T08:00:00.000Z",
	updatedAt: "2035-07-08T08:00:00.000Z",
};

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

describe("useCreatePorterRequest", () => {
	it("delegates to the service and returns the authoritative backend request", async () => {
		const create = vi.spyOn(tripsService, "createPorterRequest").mockResolvedValue(REQUEST);
		const { wrapper } = createWrapper();
		const { result } = renderHook(() => useCreatePorterRequest(), { wrapper });

		result.current.mutate({
			tripId: "trip-201",
			porterId: "porter-1",
			requestedRole: "support",
			note: "Support river crossing",
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(create).toHaveBeenCalledWith("trip-201", {
			porterId: "porter-1",
			requestedRole: "support",
			note: "Support river crossing",
		});
		expect(result.current.data).toBe(REQUEST);
	});

	it.each([
		[401, "authentication", false],
		[403, "forbidden", false],
		[404, "notFound", false],
		[409, "conflict", true],
		[422, "validation", false],
		[503, "retryable", true],
	] as const)("maps HTTP %s without exposing backend details", (status, kind, canRetry) => {
		expect(mapCreatePorterRequestError(new HttpError("raw backend detail", status, {}))).toEqual(
			expect.objectContaining({ kind, canRetry })
		);
	});
});
