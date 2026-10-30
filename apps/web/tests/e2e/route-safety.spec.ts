import { type Page, expect, test } from "@playwright/test";
import type {
	CreatedTrekkingRoute,
	RouteStatusCounts,
} from "../../src/features/trekking-routes/types";

const user = {
	id: "11111111-1111-4111-8111-111111111111",
	role: "host",
	roles: ["host"],
	status: "active",
	email: "host@example.test",
	phone: null,
	createdAt: "2026-10-29T00:00:00Z",
};
const browserRoutes: CreatedTrekkingRoute[] = Array.from(
	{ length: 36 },
	(_, index): CreatedTrekkingRoute => ({
		id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index + 1).padStart(12, "0")}`,
		name:
			[
				"Hải Vân Quan",
				"Đỉnh Bạch Mã",
				"Sơn Trà",
				"Tà Năng – Phan Dũng",
				"Cung đường ven biển",
				"Đèo Hải Vân",
			][index] ?? `Tuyến ${String(index + 1).padStart(2, "0")}`,
		description: "Đường tuyến tái sử dụng cho chuyến trekking.",
		geometry: {
			type: "LineString",
			coordinates: [
				[108.2208 + index * 0.0003, 16.0471],
				[108.2508 + index * 0.0003, 16.0671],
			],
		},
		difficulty: (["easy", "moderate", "hard"] as const)[index % 3],
		expectedDurationMinutes: 30 + index * 10,
		lengthMeters: 991 + index * 280,
		status: index === 35 ? "closed" : (["draft", "pending_approval", "active"] as const)[index % 3],
		createdAt: new Date(Date.UTC(2026, 9, 30 - index, 8)).toISOString(),
		updatedAt: "2026-10-30T08:00:00Z",
	})
);
function browserResponse(url: URL) {
	const search = (url.searchParams.get("search") ?? "").toLocaleLowerCase("vi");
	const status = url.searchParams.get("status") ?? "all";
	const scoped = browserRoutes.filter((route) =>
		route.name.toLocaleLowerCase("vi").includes(search)
	);
	const statusCounts: RouteStatusCounts = {
		all: scoped.length,
		draft: 0,
		pending_approval: 0,
		active: 0,
		closed: 0,
	};
	for (const route of scoped) statusCounts[route.status]++;
	const matches = scoped.filter((route) => status === "all" || route.status === status);
	const sort = url.searchParams.get("sort") ?? "newest";
	matches.sort((a, b) =>
		sort === "name"
			? a.name.localeCompare(b.name, "vi")
			: sort === "oldest"
				? a.createdAt.localeCompare(b.createdAt)
				: b.createdAt.localeCompare(a.createdAt)
	);
	const page = Number(url.searchParams.get("page") ?? 1);
	const limit = Number(url.searchParams.get("limit") ?? 20);
	return {
		items: matches.slice((page - 1) * limit, page * limit),
		statusCounts,
		pagination: {
			page,
			limit,
			total: matches.length,
			totalPages: Math.ceil(matches.length / limit),
		},
	};
}
async function setup(
	page: Page,
	failed = false,
	sourceStatus: "LIVE" | "UNAVAILABLE" = "LIVE",
	waterGate?: Promise<void>,
	startAt = "/host/trekking-routes/create"
) {
	page.on("pageerror", (error) => console.error("PAGE_ERROR", error.message));
	page.on("console", (message) => {
		if (message.type() === "error") console.error("BROWSER_ERROR", message.text());
	});
	await page.addInitScript((user) => {
		localStorage.setItem("authUser", JSON.stringify(user));
		localStorage.setItem("accessToken", "test");
	}, user);
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
	await page.route(
		(url) => url.pathname.startsWith("/api/"),
		async (route) => {
			const path = new URL(route.request().url()).pathname;
			if (path === "/api/auth/me") return route.fulfill({ json: user });
			if (path === "/api/trekking-routes/paginated")
				return route.fulfill({ json: browserResponse(new URL(route.request().url())) });
			if (path === "/api/route-safety/analyze") {
				if (failed)
					return route.fulfill({ status: 503, json: { message: "Provider unavailable" } });
				const body = route.request().postDataJSON() as {
					geometry: { coordinates: number[][] };
					source?: string;
				};
				if (body.source === "OSM" && waterGate) await waterGate;
				const [lng, lat] = body.geometry.coordinates[0];
				const ring = [
					[lng - 0.001, lat - 0.001],
					[lng + 0.001, lat - 0.001],
					[lng + 0.001, lat + 0.001],
					[lng - 0.001, lat + 0.001],
					[lng - 0.001, lat - 0.001],
				];
				const geometries = [
					{ type: "Point", coordinates: [lng, lat - 0.0025] },
					{
						type: "LineString",
						coordinates: [
							[lng, lat - 0.01],
							[lng, lat + 0.01],
						],
					},
					{ type: "Polygon", coordinates: [ring] },
					{ type: "MultiPolygon", coordinates: [[ring]] },
					{ type: "Point", coordinates: [lng + 0.003, lat] },
				];
				return route.fulfill({
					status: 201,
					json: {
						liveSource: {
							source: "NCHMF",
							status: sourceStatus,
							checkedAt: new Date().toISOString(),
							dataTime: sourceStatus === "LIVE" ? new Date().toISOString() : null,
							validUntil:
								sourceStatus === "LIVE" ? new Date(Date.now() + 3600000).toISOString() : null,
						},
						sources: (body.source ? [body.source] : ["NCHMF", "VNDMS", "OSM"]).map((source) => ({
							source,
							status: sourceStatus,
							checkedAt: new Date().toISOString(),
							dataTime: null,
							validUntil: null,
						})),
						riskLevel: sourceStatus === "LIVE" ? "HIGH" : "UNKNOWN",
						summary: {
							activeWarnings: sourceStatus === "LIVE" ? 4 : 0,
							nearbyIncidents: 0,
							hostDefinedDangerZones: 0,
							historicalFeatures: 0,
						},
						analyzedAt: new Date().toISOString(),
						dataVersion: "e2e",
						truncated: false,
						coverage: "PARTIAL",
						proximityMeters: 300,
						features: {
							type: "FeatureCollection",
							features: (sourceStatus === "LIVE" ? geometries : [])
								.map((geometry, index) => ({
									type: "Feature",
									id: `hazard-${index}`,
									geometry,
									properties: {
										sourceType: index === 4 ? "RESOURCE" : "OFFICIAL_CURRENT",
										source: index === 4 ? "OSM" : "Approved test feed",
										sourceReference: "fixture",
										hazardType: index === 4 ? "water_spring" : "landslide",
										severity: "HIGH",
										geometryRole: "administrative_warning_area",
										description: index === 4 ? "Suối tự nhiên" : `Warning ${index}`,
										observedAt: null,
										issuedAt: new Date().toISOString(),
										fetchedAt: new Date().toISOString(),
										validFrom: null,
										validUntil: new Date(Date.now() + 3600000).toISOString(),
										updatedAt: new Date().toISOString(),
										lifecycleStatus: index === 4 ? "UNKNOWN" : "ACTIVE",
										verificationStatus: "SOURCE_PROVIDED",
										accuracyMeters: null,
										distanceMeters: 0,
										intersects: true,
										radiusMeters: null,
									},
								}))
								.filter(
									(_feature, index) =>
										!body.source ||
										index === 1 ||
										(body.source === "VNDMS" && index === 0) ||
										(body.source === "NCHMF" && [2, 3].includes(index)) ||
										(body.source === "OSM" && index === 4)
								),
						},
					},
				});
			}
			if (path === "/api/trekking-routes" && route.request().method() === "POST") {
				const body = route.request().postDataJSON() as Record<string, unknown>;
				return route.fulfill({
					status: 201,
					json: {
						...body,
						id: "22222222-2222-4222-8222-222222222222",
						hostId: user.id,
						lengthMeters: 1000,
						status: "draft",
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
					},
				});
			}
			return route.fulfill({ json: [] });
		}
	);
	await page.goto(startAt);
	if (startAt === "/host/trekking-routes") {
		await expect(page.getByRole("heading", { name: "Tuyến trekking của Host" })).toBeVisible({
			timeout: 15000,
		});
		return;
	}
	await expect(page.getByRole("heading", { name: "Vẽ tuyến đường" })).toBeVisible({
		timeout: 15000,
	});
	const surface = page.getByTestId("route-map-surface");
	await expect(surface.locator("canvas")).toBeVisible();
	await surface.click({ position: { x: 300, y: 200 } });
	await surface.click({ position: { x: 450, y: 250 } });
	await expect(page.getByTestId("preview-length")).toContainText("2 điểm");
}

test("shows map symbols with a corner legend and opens point details without editing the route", async ({
	page,
}, info) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await setup(page);
	const surface = page.getByTestId("route-map-surface");
	const legend = surface.getByRole("region", { name: "Chú giải bản đồ" });
	await expect(surface.locator('[data-safety-symbol="hazard"]')).toHaveCount(1);
	await expect(surface.locator('[data-safety-symbol="water"]')).toHaveCount(1);
	await expect(legend.getByText("Vùng nguy hiểm")).toBeVisible();
	await expect(legend.locator("details")).toHaveCount(0);
	const mapBox = await surface.boundingBox();
	const legendBox = await legend.boundingBox();
	expect(mapBox && legendBox && legendBox.x > mapBox.x + mapBox.width / 2).toBeTruthy();
	expect(
		mapBox && legendBox && Math.abs(mapBox.y + mapBox.height - legendBox.y - legendBox.height) < 20
	).toBeTruthy();
	await surface.locator('[data-safety-symbol="hazard"]').click();
	await expect(page.locator(".maplibregl-popup-content")).toContainText("Approved test feed");
	await expect(page.getByTestId("preview-length")).toContainText("2 điểm");
	await page.screenshot({ path: info.outputPath("route-symbols.png"), fullPage: true });
	await page.getByRole("button", { name: "Xóa điểm cuối" }).click();
	await expect(surface.locator("[data-safety-symbol]")).toHaveCount(0);
	await expect(legend.getByRole("button", { name: "Kiểm tra lại" })).toBeDisabled();
	expect(errors).toEqual([]);
});

test("omits provider diagnostics and refresh does not add a drawing vertex", async ({ page }) => {
	await setup(page, false, "UNAVAILABLE");
	const legend = page.getByRole("region", { name: "Chú giải bản đồ" });
	await expect(legend.getByRole("alert")).toHaveCount(0);
	await expect(legend.getByLabel(/^NCHMF:/)).toHaveCount(0);
	const response = page.waitForResponse((response) =>
		response.url().includes("/route-safety/analyze")
	);
	await legend.getByRole("button", { name: "Kiểm tra lại" }).click();
	await response;
	await expect(legend.getByRole("alert")).toHaveCount(0);
	await expect(page.getByTestId("preview-length")).toContainText("2 điểm");
});

test("shows hazard symbols while water is still loading", async ({ page }) => {
	let releaseWater: () => void = () => undefined;
	const gate = new Promise<void>((resolve) => {
		releaseWater = resolve;
	});
	await setup(page, false, "LIVE", gate);
	const surface = page.getByTestId("route-map-surface");
	await expect(surface.locator('[data-safety-symbol="hazard"]')).toHaveCount(1);
	await expect(surface.locator('[data-safety-symbol="water"]')).toHaveCount(0);
	await expect(surface.getByRole("button", { name: "Kiểm tra lại" })).toBeDisabled();
	releaseWater();
	await expect(surface.locator('[data-safety-symbol="water"]')).toHaveCount(1);
});

test("analysis failure cannot block saving the Host draft", async ({ page }) => {
	await setup(page, true);
	const legend = page.getByRole("region", { name: "Chú giải bản đồ" });
	await expect(legend.getByRole("button", { name: "Kiểm tra lại" })).toHaveAttribute(
		"title",
		"Không tải được dữ liệu. Kiểm tra lại"
	);
	await page.getByLabel("Tên tuyến", { exact: true }).fill("Tuyến thử Route Safety");
	await page.getByLabel("Thời lượng dự kiến (phút)", { exact: true }).fill("120");
	await page.getByRole("button", { name: "Lưu tuyến", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "Tuyến đường đã lưu", exact: true })
	).toBeVisible();
	await expect(page.getByRole("button", { name: "Gửi duyệt", exact: true })).toBeEnabled();
});

test("saves and submits geometry with safety context without planning trip waypoints", async ({
	page,
}) => {
	await setup(page);
	const checkpointRequests: string[] = [];
	page.on("request", (request) => {
		if (new URL(request.url()).pathname.includes("/checkpoints"))
			checkpointRequests.push(request.url());
	});
	let saved: Record<string, unknown> | null = null;
	await page.route(
		(url) => url.pathname.startsWith("/api/trekking-routes"),
		async (route) => {
			const request = route.request();
			const path = new URL(request.url()).pathname;
			if (request.method() === "POST" && path === "/api/trekking-routes") {
				saved = {
					...request.postDataJSON(),
					id: "22222222-2222-4222-8222-222222222222",
					hostId: user.id,
					lengthMeters: 1000,
					status: "draft",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				};
				return route.fulfill({ status: 201, json: saved });
			}
			if (request.method() === "PATCH" && path.endsWith("/submit-for-approval")) {
				saved = { ...saved, status: "pending_approval" };
				return route.fulfill({ json: saved });
			}
			return route.fulfill({ json: saved ? [saved] : [] });
		}
	);
	await expect(page.getByRole("button", { name: "Đỉnh 1", exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Điểm bắt đầu", exact: true })).toHaveCount(0);
	await page.getByLabel("Tên tuyến", { exact: true }).fill("Đường tuyến dùng lại");
	await page.getByLabel("Thời lượng dự kiến (phút)", { exact: true }).fill("120");
	await page.getByRole("button", { name: "Lưu tuyến", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "Tuyến đường đã lưu", exact: true })
	).toBeVisible();
	await expect(page.getByTestId("route-checkpoints-panel")).toHaveCount(0);
	await expect(page.getByTestId("route-geometry-preview").locator("canvas")).toBeVisible();
	const panel = page.getByRole("region", { name: "Chú giải bản đồ" });
	await expect(panel).toBeVisible();
	await expect(page.locator('[data-safety-symbol="water"]')).toHaveCount(1);
	await expect(page.getByRole("button", { name: "Gửi duyệt", exact: true })).toBeEnabled();
	await page.getByRole("button", { name: "Gửi duyệt", exact: true }).click();
	await expect(page.getByRole("status", { name: "Trạng thái tuyến" })).toHaveText("Chờ duyệt");
	await expect(page.getByRole("button", { name: "Gửi duyệt", exact: true })).toHaveCount(0);
	expect(checkpointRequests).toEqual([]);
	expect(saved).not.toHaveProperty("checkpoints");
});

test("Host route browser uses the split layout, server pagination and full-list filtering", async ({
	page,
}, info) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await setup(page, false, "LIVE", undefined, "/host/trekking-routes");
	const list = page.getByRole("complementary", { name: "Danh sách tuyến của Host" });
	const detail = page.getByRole("region", { name: "Tuyến được chọn" });
	await expect(list.locator("article")).toHaveCount(5);
	await expect(detail.getByRole("heading", { name: "Hải Vân Quan", exact: true })).toBeVisible();
	await expect(detail.getByTestId("route-geometry-preview").locator("canvas")).toBeVisible();
	await expect(detail.getByTestId("route-geometry-preview")).toHaveAttribute("aria-busy", "false");
	await expect(detail.locator('[data-safety-symbol="water"]')).toBeVisible();
	await expect(detail.getByRole("region", { name: "Cảnh báo quanh tuyến" })).toBeVisible();
	await expect(page.getByRole("tab")).toHaveCount(0);
	await expect(page.getByText("Điểm trên tuyến", { exact: true })).toHaveCount(0);
	const left = await list.boundingBox();
	const right = await detail.boundingBox();
	expect(left && right && left.x + left.width <= right.x).toBeTruthy();
	const pagination = list.getByRole("navigation", { name: "Phân trang danh sách tuyến" });
	const pagingBox = await pagination.boundingBox();
	expect(
		pagingBox && right && Math.abs(pagingBox.y + pagingBox.height - right.y - right.height) <= 20
	).toBeTruthy();
	const canvas = detail.getByTestId("route-geometry-preview").locator("canvas");
	const originalCanvas = await canvas.elementHandle();
	for (const index of [1, 2, 3, 4, 0]) {
		await list.locator("article").nth(index).click();
		await expect(
			detail.getByRole("heading", { name: browserRoutes[index].name, exact: true })
		).toBeVisible();
		expect(await canvas.evaluate((element, original) => element === original, originalCanvas)).toBe(
			true
		);
	}
	await expect(detail.getByRole("button", { name: "Xem toàn tuyến", exact: true })).toBeVisible();
	await expect(detail.locator(".maplibregl-ctrl-attrib")).toHaveCount(0);
	await page.screenshot({ path: info.outputPath("host-route-browser.png"), fullPage: true });
	await pagination.getByRole("button", { name: "Trang 2", exact: true }).click();
	await expect(list.locator("article").first()).toContainText(browserRoutes[5].name);
	await expect(pagination.getByRole("button", { name: "Trang 2", exact: true })).toHaveAttribute(
		"aria-current",
		"page"
	);
	await pagination.getByRole("button", { name: "Trang 8", exact: true }).click();
	await expect(list.locator("article")).toHaveCount(1);
	await expect(list.locator("article").first()).toContainText("Tuyến 36");
	await page.getByLabel("Tìm tuyến", { exact: true }).fill("Tuyến 30");
	await expect(list.locator("article")).toHaveCount(1);
	await expect(detail.getByRole("heading", { name: "Tuyến 30", exact: true })).toBeVisible();
	await expect(pagination.getByRole("button", { name: "Trang 1", exact: true })).toHaveAttribute(
		"aria-current",
		"page"
	);
	await page.getByLabel("Tìm tuyến", { exact: true }).fill("");
	await expect(list.locator("article")).toHaveCount(5);
	await page.getByRole("button", { name: "Nháp", exact: true }).click();
	await expect(list.locator("article")).toHaveCount(5);
	await expect(list.locator("article").first()).toContainText("Hải Vân Quan");
	await page.getByLabel("Sắp xếp tuyến", { exact: true }).selectOption("oldest");
	await expect(list.locator("article").first()).toContainText("Tuyến 34");
	await page.setViewportSize({ width: 1600, height: 760 });
	await page.evaluate(() => window.scrollTo(0, 120));
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(20);
	await expect
		.poll(async () => (await page.getByTestId("route-browser-heading").boundingBox())?.y)
		.toBe(0);
	await expect(page.getByLabel("Tìm tuyến", { exact: true })).toBeVisible();
});

test("Host route browser fits a narrow viewport", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await setup(page, false, "LIVE", undefined, "/host/trekking-routes");
	const list = page.getByRole("complementary", { name: "Danh sách tuyến của Host" });
	await expect(list.locator("article")).toHaveCount(5);
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
	).toBeTruthy();
	await page.getByRole("region", { name: "Tuyến được chọn" }).scrollIntoViewIfNeeded();
	await expect(page.getByRole("region", { name: "Chú giải bản đồ" })).toBeVisible();
});

test("context loss removes the native canvas and keeps the route and safety overlay usable", async ({
	page,
}) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await setup(page, false, "LIVE", undefined, "/host/trekking-routes");
	const surface = page.getByTestId("route-geometry-preview");
	await expect(surface).toHaveAttribute("aria-busy", "false");
	await expect(surface.locator('[data-safety-symbol="water"]')).toHaveCount(1);
	await surface.locator("canvas").evaluate((canvas) => {
		canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
	});
	await expect(surface.locator("canvas")).toHaveCount(0);
	await expect(surface.getByTestId("route-preview-line")).toBeVisible();
	await expect(surface.getByRole("region", { name: "Chú giải bản đồ" })).toBeVisible();
	await expect(surface.locator('[data-safety-symbol="water"]')).toHaveCount(1);
	await expect(
		surface.getByText("Bộ nhớ đồ họa không đủ; đang dùng chế độ tọa độ dự phòng.")
	).toBeVisible();
	expect(errors).toEqual([]);
});
