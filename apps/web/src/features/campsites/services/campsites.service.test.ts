import { beforeEach, describe, expect, it, vi } from "vitest";
import { campsitesService } from "./campsites.service";

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
			amenities: ["wifi", "bbq"],
			minPrice: 100,
			maxPrice: 500,
			page: 2,
			limit: 10,
		});

		const url = new URL(capturedUrl);
		expect(url.pathname.endsWith("/campsites")).toBe(true);
		expect(url.searchParams.get("province")).toBe("Lam Dong");
		expect(url.searchParams.get("city")).toBeNull();
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

describe("campsitesService.create", () => {
	beforeEach(() => {
		localStorage.clear();
		localStorage.setItem("accessToken", "host-access-token");
	});

	it("POSTs the Create Campsite contract with Bearer authentication", async () => {
		let capturedRequest: RequestInit | undefined;
		let capturedUrl = "";

		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				capturedUrl = input.toString();
				capturedRequest = init;

				return new Response(
					JSON.stringify({
						id: "campsite-id",
						hostId: "host-id",
						name: "Da Lat Pine Camp",
						description: "Description",
						latitude: 11.940419,
						longitude: 108.458313,
						province: "Lam Dong",
						policies: { rules: "No fire" },
						operatingHours: { opensAt: "08:00", closesAt: "18:00" },
						status: "pending_approval",
						media: [],
						createdAt: "2026-08-19T00:00:00.000Z",
						updatedAt: "2026-08-19T00:00:00.000Z",
					}),
					{
						status: 201,
						headers: {
							"Content-Type": "application/json",
						},
					}
				);
			})
		);

		await campsitesService.create({
			name: "Da Lat Pine Camp",
			description: "Description",
			latitude: 11.940419,
			longitude: 108.458313,
			province: "Lam Dong",
			policies: { rules: "No fire" },
			operatingHours: { opensAt: "08:00", closesAt: "18:00" },
			media: [
				{
					url: "https://example.com/camp.jpg",
					type: "photo",
					sortOrder: 1,
				},
			],
		});

		expect(capturedUrl.endsWith("/campsites")).toBe(true);

		expect(capturedRequest?.method).toBe("POST");

		expect((capturedRequest?.headers as Record<string, string>).Authorization).toBe(
			"Bearer host-access-token"
		);

		const body = JSON.parse(String(capturedRequest?.body)) as Record<string, unknown>;

		expect(body.status).toBeUndefined();
		expect(body.hostId).toBeUndefined();

		expect(body.operatingHours).toEqual({ opensAt: "08:00", closesAt: "18:00" });
	});
});

describe("campsitesService.getMine", () => {
	beforeEach(() => {
		localStorage.clear();
		localStorage.setItem("accessToken", "host-access-token");
	});

	it("loads the authenticated Host campsites with Bearer authentication", async () => {
		let capturedRequest: RequestInit | undefined;
		let capturedUrl = "";

		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				capturedUrl = input.toString();
				capturedRequest = init;

				return new Response(JSON.stringify([]), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			})
		);

		await campsitesService.getMine();

		expect(capturedUrl.endsWith("/campsites/my")).toBe(true);
		expect(capturedRequest?.method).toBe("GET");
		expect((capturedRequest?.headers as Record<string, string>).Authorization).toBe(
			"Bearer host-access-token"
		);
	});
});

describe("campsitesService.uploadMedia", () => {
	beforeEach(() => {
		localStorage.clear();
		localStorage.setItem("accessToken", "host-access-token");
	});

	it("uploads a device image as multipart form data with Bearer authentication", async () => {
		let capturedRequest: RequestInit | undefined;
		let capturedUrl = "";

		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				capturedUrl = input.toString();
				capturedRequest = init;

				return new Response(
					JSON.stringify({ url: "http://localhost:3000/uploads/campsites/pending/a.jpg" }),
					{
						status: 201,
						headers: { "Content-Type": "application/json" },
					}
				);
			})
		);

		const result = await campsitesService.uploadMedia(
			new File(["fake image"], "campsite.jpg", { type: "image/jpeg" })
		);

		expect(capturedUrl.endsWith("/campsites/media")).toBe(true);
		expect(capturedRequest?.method).toBe("POST");
		expect(capturedRequest?.body).toBeInstanceOf(FormData);
		expect((capturedRequest?.headers as Record<string, string>).Authorization).toBe(
			"Bearer host-access-token"
		);
		expect((capturedRequest?.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
		expect(result.url).toBe("http://localhost:3000/uploads/campsites/pending/a.jpg");
	});
});
