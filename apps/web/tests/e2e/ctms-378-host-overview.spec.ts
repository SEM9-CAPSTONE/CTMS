import { type Page, expect, test } from "@playwright/test";
import { overviewFixture } from "../fixtures/host-overview";

async function setup(page: Page) {
	const user = {
		id: "host-378",
		role: "host",
		roles: ["host"],
		status: "active",
		email: "host378@example.test",
		createdAt: "2026-01-01",
	};
	await page.addInitScript((user) => {
		localStorage.setItem("authUser", JSON.stringify(user));
		localStorage.setItem("accessToken", "test-token");
	}, user);
	await page.route("https://**/*", (route) => route.abort());
	await page.route(
		(url) => url.pathname.startsWith("/api/"),
		(route) => {
			const path = new URL(route.request().url()).pathname;
			if (path.endsWith("/host/monitoring/overview")) return route.fallback();
			return route.fulfill({
				json: path.endsWith("/auth/me")
					? user
					: path.includes("/profile")
						? { ...user, fullName: "Host UI", emergencyContacts: [], languages: [] }
						: [],
			});
		}
	);
}

test("renders backend KPIs, pages and supported detail navigation", async ({ page }, testInfo) => {
	await setup(page);
	await page.route("**/api/host/monitoring/overview?*", (route) => {
		const data = overviewFixture();
		data.page = Number(new URL(route.request().url()).searchParams.get("page"));
		return route.fulfill({ json: data });
	});
	await page.goto("/dashboard");
	const overview = page.getByTestId("host-dashboard-overview");
	await expect(
		overview.getByRole("region", { name: "Chỉ số vận hành" }).getByText("7", { exact: true })
	).toBeVisible();
	await expect(overview.getByText("SOS · Chấn thương")).toBeVisible();
	await expect(overview.getByText("Rủi ro cao", { exact: true })).toBeVisible();
	await overview.screenshot({ path: testInfo.outputPath("host-overview-desktop.png") });
	await overview.getByRole("button", { name: "Sau", exact: true }).click();
	await expect(
		overview.getByRole("navigation", { name: "Phân trang Booking hôm nay" })
	).toContainText("2 / 2");
	await expect(
		overview.getByRole("region", { name: "Chỉ số vận hành" }).getByText("7", { exact: true })
	).toBeVisible();
	await overview
		.getByRole("region", { name: "Trip đang diễn ra", exact: true })
		.getByRole("button", { name: "Xem Trip", exact: true })
		.click();
	await expect(page).toHaveURL(/\/trips\/trip-one$/);
});

test("shows unavailable and stale states, and hides cached data after 403", async ({ page }) => {
	await setup(page);
	let denied = false;
	await page.route("**/api/host/monitoring/overview?*", (route) => {
		if (denied) return route.fulfill({ status: 403, json: { message: "Forbidden" } });
		const data = overviewFixture();
		data.bookings.availability = "unavailable";
		data.bookings.data = null;
		data.kpis.todaysBookings = null;
		const weather = data.weather.data?.items[0];
		if (!weather) throw new Error("Missing weather fixture");
		weather.state = "stale";
		return route.fulfill({ json: data });
	});
	await page.goto("/dashboard");
	await expect(page.getByText("Nguồn dữ liệu chưa khả dụng", { exact: true })).toBeVisible();
	await expect(page.getByText("Đánh giá đã cũ", { exact: true })).toBeVisible();
	denied = true;
	await page
		.getByTestId("host-dashboard-overview")
		.getByRole("button", { name: "Làm mới", exact: true })
		.click();
	await expect(page.getByText("Bạn không có quyền xem tổng quan vận hành của Host.")).toBeVisible();
	await expect(page.getByTestId("host-dashboard-overview")).toHaveCount(0);
});

test("supports error retry and real empty state on a narrow viewport", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await setup(page);
	let failing = true;
	await page.route("**/api/host/monitoring/overview?*", (route) => {
		if (failing) return route.fulfill({ status: 503, json: { message: "Unavailable" } });
		const data = overviewFixture();
		for (const section of [
			data.bookings,
			data.activeTrips,
			data.routes,
			data.porters,
			data.sos,
			data.weather,
		])
			section.data = { total: 0, items: [] };
		data.kpis = {
			todaysBookings: 0,
			activeTrips: 0,
			routes: 0,
			assignedPorters: 0,
			unresolvedSos: 0,
		};
		return route.fulfill({ json: data });
	});
	await page.goto("/dashboard");
	await expect(page.getByText("Không tải được tổng quan vận hành.", { exact: true })).toBeVisible();
	failing = false;
	await page.getByRole("button", { name: "Thử lại", exact: true }).click();
	await expect(
		page.getByTestId("host-dashboard-overview").getByText("Chưa có dữ liệu.", { exact: true })
	).toHaveCount(3);
	await expect(page.getByText("Không có SOS đang chờ xử lý.")).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
});

test("keeps a long weather list compact without pushing other sections into empty columns", async ({
	page,
}, testInfo) => {
	await page.setViewportSize({ width: 1900, height: 1080 });
	await setup(page);
	await page.route("**/api/host/monitoring/overview?*", (route) => {
		const data = overviewFixture();
		const weather = data.weather.data?.items[0];
		const ownedRoute = data.routes.data?.items[0];
		if (!weather || !ownedRoute) throw new Error("Missing fixture");
		const requestedPage = Number(new URL(route.request().url()).searchParams.get("page"));
		data.page = requestedPage;
		data.kpis.routes = 11;
		data.bookings.data = { total: 0, items: [] };
		data.kpis.todaysBookings = 0;
		data.sos.data = { total: 0, items: [] };
		data.kpis.unresolvedSos = 0;
		data.weather.data = {
			total: 5,
			items: Array.from({ length: 5 }, (_, index) => ({
				...weather,
				id: `weather-${index}`,
				routeId: `route-${index}`,
				state: index === 0 ? "unavailable" : "stale",
				riskLevel: index === 0 ? null : weather.riskLevel,
			})),
		};
		data.routes.data = {
			total: 11,
			items: Array.from({ length: requestedPage === 3 ? 1 : 5 }, (_, row) => ({
				...ownedRoute,
				id: `route-${(requestedPage - 1) * 5 + row}`,
				name: `Tuyến kiểm tra ${(requestedPage - 1) * 5 + row + 1}`,
			})),
		};
		return route.fulfill({ json: data });
	});
	await page.goto("/dashboard");
	const overview = page.getByTestId("host-dashboard-overview");
	const weather = overview.getByRole("region", { name: "Rủi ro thời tiết", exact: true });
	await expect(weather.getByText("Tuyến kiểm tra 5", { exact: true })).toBeVisible();
	const weatherBox = await weather.boundingBox();
	const overviewBox = await overview.boundingBox();
	if (!weatherBox || !overviewBox) throw new Error("Missing dashboard bounds");
	expect(weatherBox.width).toBeLessThan(overviewBox.width * 0.6);
	expect(weatherBox.height).toBeLessThan(700);
	const inventory = overview.getByRole("tablist", { name: "Danh sách vận hành" }).locator("..");
	const inventoryBox = await inventory.boundingBox();
	if (!inventoryBox) throw new Error("Missing inventory bounds");
	expect(Math.abs(inventoryBox.width - weatherBox.width)).toBeLessThan(1);
	expect(Math.abs(inventoryBox.height - weatherBox.height)).toBeLessThan(1);
	await weather.locator("summary").first().click();
	await expect(weather.getByRole("button", { name: "Xem tuyến", exact: true })).toBeVisible();
	await weather.locator("summary").first().click();
	await overview.getByRole("tab", { name: /^Tuyến/ }).click();
	await expect(
		overview
			.getByRole("region", { name: "Tuyến của tôi", exact: true })
			.getByText("Tuyến kiểm tra 5", { exact: true })
	).toBeVisible();
	await overview.getByRole("tab", { name: /^Porter/ }).focus();
	await page.keyboard.press("ArrowLeft");
	await expect(overview.getByRole("tab", { name: /^Booking hôm nay/ })).toHaveAttribute(
		"aria-selected",
		"true"
	);
	await overview.getByRole("tab", { name: /^Tuyến/ }).click();
	await overview.getByRole("heading", { name: "Trip đang diễn ra", exact: true }).click();
	await overview.screenshot({ path: testInfo.outputPath("host-overview-long-list.png") });
	const pager = overview.getByRole("navigation", { name: "Phân trang Tuyến", exact: true });
	await pager.getByRole("button", { name: "Sau", exact: true }).click();
	await expect(
		overview
			.getByRole("region", { name: "Tuyến của tôi", exact: true })
			.getByText("Tuyến kiểm tra 6", { exact: true })
	).toBeVisible();
	await expect(pager).toContainText("6–10 / 11");
	await expect(
		overview
			.getByRole("region", { name: "Trip đang diễn ra", exact: true })
			.getByText("Chuyến Núi Chúa", { exact: true })
	).toBeVisible();
	await expect(weather.getByText("Tuyến kiểm tra 5", { exact: true })).toBeVisible();
	await pager.getByRole("button", { name: "Sau", exact: true }).click();
	await expect(
		overview
			.getByRole("region", { name: "Tuyến của tôi", exact: true })
			.getByText("Tuyến kiểm tra 11", { exact: true })
	).toBeVisible();
	await expect(pager.getByRole("button", { name: "Sau", exact: true })).toBeDisabled();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
});
