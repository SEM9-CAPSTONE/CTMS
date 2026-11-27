import { expect, test } from "@playwright/test";
import type { Position } from "../../src/features/trekking-routes/types";

test("login and reload only request the current page chunk", async ({ page }) => {
	const scripts: string[] = [];
	const errors: string[] = [];
	page.on("request", (request) => {
		if (request.resourceType() === "script") scripts.push(request.url());
	});
	page.on("pageerror", (error) => errors.push(error.message));
	const session = await page.context().newCDPSession(page);
	await session.send("Network.enable");
	await session.send("Network.setCacheDisabled", { cacheDisabled: true });

	for (const reload of [false, true]) {
		scripts.length = 0;
		if (reload) await page.reload();
		else await page.goto("/login");
		await expect(page.locator('input[type="password"]')).toBeVisible();
		const uiMs = Math.round(await page.evaluate(() => performance.now()));
		await page.waitForLoadState("networkidle");
		expect(scripts.some((url) => /\/LoginPage-[^/]+\.js/.test(url))).toBe(true);
		const otherPageChunks = scripts.filter(
			(url) => /Page-[^/]+\.js/.test(url) && !/\/LoginPage-/.test(url)
		);
		expect(otherPageChunks).toEqual([]);
		expect(
			scripts.filter((url) => /\/(Admin|Host|Porter|Trip|Booking|maplibre)/.test(url))
		).toEqual([]);
		console.log(`${reload ? "Reload" : "Cold load"} login UI: ${uiMs} ms`);
	}
	expect(errors).toEqual([]);
});

test("trip discovery offers sign-in when the server requires authentication", async ({ page }) => {
	await page.route(
		(url) => url.pathname.startsWith("/api/"),
		(route) => route.fulfill({ status: 401, json: { message: "Unauthorized", statusCode: 401 } })
	);
	await page.goto("/trips");
	const alert = page.getByRole("alert");
	await expect(alert).toContainText("Vui lòng đăng nhập để xem danh sách chuyến đi.");
	await expect(alert.getByRole("link", { name: "Đăng nhập" })).toHaveAttribute("href", "/login");
	await expect(alert).not.toContainText("kết nối mạng");
});

test("production route editor loads its real worker and draws a pedestrian route", async ({
	page,
}) => {
	const user = {
		id: "host",
		role: "host",
		roles: ["host"],
		status: "active",
		email: "host@ctms.local",
		fullName: "Nguyễn Minh Anh",
	};
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error") errors.push(message.text());
	});
	await page.routeWebSocket(/\/socket\.io\//, () => {});
	await page.addInitScript((host) => {
		localStorage.setItem("authUser", JSON.stringify(host));
		localStorage.setItem("accessToken", "test-token");
	}, user);
	// Stub external data only; the map engine and worker come from the build.
	await page.route("https://api.maptiler.com/**", (route) =>
		route.fulfill({
			json: {
				version: 8,
				sources: {},
				layers: [
					{ id: "background", type: "background", paint: { "background-color": "#ecf1e8" } },
				],
			},
		})
	);
	let routedCoordinates: Position[] = [];
	await page.route("https://api.maptiler.com/routing/v1/directions?*", (route) => {
		const request = route.request();
		const { profile, locations } = request.postDataJSON() as {
			profile: string;
			locations: { lon: number; lat: number }[];
		};
		expect(request.method()).toBe("POST");
		expect(profile).toBe("pedestrian");
		expect(locations).toHaveLength(2);
		const [start, end] = locations;
		// Use the actual click coordinates so both endpoints satisfy the snap limit.
		routedCoordinates = [
			[start.lon, start.lat],
			[start.lon, end.lat],
			[end.lon, end.lat],
		];
		return route.fulfill({ json: { route: { legs: [{ geometry: routedCoordinates }] } } });
	});
	await page.route(
		(url) => url.pathname.startsWith("/api/"),
		(route) => {
			const path = new URL(route.request().url()).pathname;
			if (path === "/api/auth/me") return route.fulfill({ json: user });
			if (path === "/api/route-safety/verified-zones")
				return route.fulfill({
					json: {
						type: "FeatureCollection",
						features: [],
						generatedAt: new Date().toISOString(),
						truncated: false,
					},
				});
			if (path === "/api/route-safety/analyze")
				return route.fulfill({
					json: {
						features: { type: "FeatureCollection", features: [] },
						riskLevel: "UNKNOWN",
						analyzedAt: new Date().toISOString(),
						dataVersion: "1",
						truncated: false,
						coverage: "PARTIAL",
						proximityMeters: 500,
						summary: {
							activeWarnings: 0,
							nearbyIncidents: 0,
							hostDefinedDangerZones: 0,
							historicalFeatures: 0,
						},
					},
				});
			return route.fulfill({ json: [] });
		}
	);
	const workerPromise = page.waitForEvent("worker");
	await page.goto("/host/trekking-routes/create");
	const worker = await workerPromise;
	expect(worker.url()).toMatch(/\/assets\/maplibre-gl-worker-[^/]+\.js$/);
	const response = await page.request.get(worker.url());
	expect(response.ok()).toBe(true);
	expect(response.headers()["content-type"]).toMatch(/javascript/);
	expect(await response.text()).not.toMatch(/<!doctype html/i);

	const map = page.getByTestId("route-map-surface");
	const canvas = map.locator("canvas");
	const markers = map.locator("button.maplibregl-marker");
	const preview = page.getByTestId("preview-length");
	await expect(canvas).toBeVisible();
	await canvas.click({ position: { x: 160, y: 170 } });
	await expect(preview).toContainText("1 điểm");
	await expect(markers).toHaveCount(1);
	const safetyRequest = page.waitForRequest(
		(request) => new URL(request.url()).pathname === "/api/route-safety/analyze"
	);
	await canvas.click({ position: { x: 280, y: 200 } });
	await expect(preview).toContainText("2 điểm");
	await expect(markers).toHaveCount(2);
	expect((await safetyRequest).postDataJSON()).toMatchObject({
		geometry: { type: "LineString", coordinates: routedCoordinates },
	});
	await page.getByRole("button", { name: "Hoàn tác", exact: true }).click();
	await expect(preview).toContainText("1 điểm");
	await expect(markers).toHaveCount(1);
	expect(errors).toEqual([]);
});
