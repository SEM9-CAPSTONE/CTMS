import { afterEach, describe, expect, it, vi } from "vitest";
import { API_ENDPOINTS } from "../../../core/api/endpoints";
import { httpClient } from "../../../core/api/httpClient";
import { packagePolicyService } from "./package-policy.service";

describe("departure inbox request fan-out", () => {
	afterEach(() => vi.restoreAllMocks());
	it("enriches fifty notices for one Trip with only three GET requests", async () => {
		const get = vi.spyOn(httpClient, "get").mockImplementation(async (url) => {
			if (url === API_ENDPOINTS.PACKAGE_DEPARTURE_NOTIFICATIONS.LIST)
				return Array.from({ length: 50 }, (_, index) => ({
					id: `notice-${index}`,
					tripId: "same-trip",
					active: true,
					reasonCode: "PACKAGE_DEPARTURE_NOT_READY",
					readAt: null,
					createdAt: "2026-11-13T00:00:00Z",
				}));
			if (url === "/trips/same-trip")
				return { title: "Sơn Trà", status: "published", startsAt: "2026-11-13T00:00:00Z" };
			if (url === "/trips/same-trip/offline-package-policy/departure-status")
				return { blocked: true, reasonCode: "PACKAGE_DEPARTURE_NOT_READY" };
			throw new Error(`Unexpected GET ${url}`);
		});
		expect(await packagePolicyService.list()).toHaveLength(50);
		expect(get).toHaveBeenCalledTimes(3);
		expect(get.mock.calls.map(([url]) => url)).toEqual([
			API_ENDPOINTS.PACKAGE_DEPARTURE_NOTIFICATIONS.LIST,
			"/trips/same-trip",
			"/trips/same-trip/offline-package-policy/departure-status",
		]);
	});
});
