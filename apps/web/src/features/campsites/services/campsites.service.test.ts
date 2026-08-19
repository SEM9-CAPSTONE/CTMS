import { beforeEach, describe, expect, it, vi } from "vitest";
import { campsitesService } from "./campsites.service";

/**
 * CTMS-17-T02. Stubs `fetch` to capture the exact request httpClient
 * builds, proving the real query-serialization contract against CTMS-77's
 * `GET /campsites` (services/api/.../search-campsites-query.dto.ts):
 * amenities comma-joined, `status` never sent, empty filters dropped
 * (not sent as `""`), response passed through untransformed.
 */
describe("campsitesService.search", () => {
	let capturedUrl = "";

	beforeEach(() => {
		capturedUrl = "";
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) => {
				capturedUrl = input.toString();
				return new Response(
					JSON.stringify({
						items: [],
						pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } }
				);
			})
		);
	});

	it("serializes the full filter set correctly and never sends status", async () => {
		await campsitesService.search({
			province: "Lam Dong",
			city: "Da Lat",
			amenities: ["wifi", "bbq"],
			minPrice: 100,
			maxPrice: 500,
			page: 2,
			limit: 10,
		});

		const url = new URL(capturedUrl);
		expect(url.pathname.endsWith("/campsites")).toBe(true);
		expect(url.searchParams.get("province")).toBe("Lam Dong");
		expect(url.searchParams.get("city")).toBe("Da Lat");
		expect(url.searchParams.get("amenities")).toBe("wifi,bbq");
		expect(url.searchParams.get("minPrice")).toBe("100");
		expect(url.searchParams.get("maxPrice")).toBe("500");
		expect(url.searchParams.get("page")).toBe("2");
		expect(url.searchParams.get("limit")).toBe("10");
		expect(url.searchParams.get("status")).toBeNull();
	});

	it("drops omitted filters instead of sending empty strings", async () => {
		await campsitesService.search({ page: 1, limit: 20 });

		const url = new URL(capturedUrl);
		expect(url.searchParams.get("province")).toBeNull();
		expect(url.searchParams.get("city")).toBeNull();
		expect(url.searchParams.get("amenities")).toBeNull();
		expect(url.searchParams.get("minPrice")).toBeNull();
		expect(url.searchParams.get("maxPrice")).toBeNull();
		expect(url.searchParams.get("page")).toBe("1");
		expect(url.searchParams.get("limit")).toBe("20");
	});

	it("sends a single amenity without a trailing comma", async () => {
		await campsitesService.search({ amenities: ["wifi"], page: 1, limit: 20 });

		const url = new URL(capturedUrl);
		expect(url.searchParams.get("amenities")).toBe("wifi");
	});

	it("passes the response body straight through with no client-side transformation", async () => {
		const result = await campsitesService.search({ page: 1, limit: 20 });

		expect(result).toEqual({
			items: [],
			pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
		});
	});
});
