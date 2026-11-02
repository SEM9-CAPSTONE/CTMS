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
	await expect(overview.getByRole("region", { name: "Rủi ro thời tiết", exact: true })).toHaveCount(
		0
	);
	await overview.screenshot({ path: testInfo.outputPath("host-overview-desktop.png") });
	await overview.getByRole("button", { name: "Sau", exact: true }).click();
	await expect(
		overview.getByRole("navigation", { name: "Phân trang Đặt chỗ hôm nay" })
	).toContainText("2 / 2");
	await expect(
		overview.getByRole("region", { name: "Chỉ số vận hành" }).getByText("7", { exact: true })
	).toBeVisible();
	await overview
		.getByRole("region", { name: "Chuyến đi đang diễn ra", exact: true })
		.getByRole("button", { name: "Xem chuyến đi", exact: true })
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
		data.generatedAt = new Date(Date.now() - 120_000).toISOString();
		return route.fulfill({ json: data });
	});
	await page.goto("/dashboard");
	await expect(page.getByText("Nguồn dữ liệu chưa khả dụng", { exact: true })).toBeVisible();
	await expect(page.getByText("Chưa cập nhật", { exact: true })).toBeVisible();
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
		page.getByRole("region", { name: "Chuyến đi đang diễn ra", exact: true })
	).toContainText("Chưa có dữ liệu.");
	await expect(page.getByRole("region", { name: "Đặt chỗ hôm nay", exact: true })).toContainText(
		"Chưa có dữ liệu."
	);
	await expect(page.getByText("Hiện không có yêu cầu cứu trợ cần xử lý.")).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
});

test("pages active Trips independently in groups of three and keeps rescue cards aligned", async ({
	page,
}, testInfo) => {
	await page.setViewportSize({ width: 1900, height: 1080 });
	await setup(page);
	await page.route("**/api/host/monitoring/overview?*", (route) => {
		const url = new URL(route.request().url());
		const data = overviewFixture();
		const trip = data.activeTrips.data?.items[0];
		if (!trip) throw new Error("Missing Trip fixture");
		data.page = Number(url.searchParams.get("page"));
		data.limit = Number(url.searchParams.get("limit"));
		data.kpis.activeTrips = 7;
		data.activeTrips.data = {
			total: 7,
			items: Array.from(
				{ length: Math.min(data.limit, 7 - (data.page - 1) * data.limit) },
				(_, index) => ({
					...trip,
					id: `trip-${(data.page - 1) * data.limit + index + 1}`,
					title: `Chuyến kiểm tra ${(data.page - 1) * data.limit + index + 1}`,
				})
			),
		};
		data.sos.data = { total: 0, items: [] };
		data.kpis.unresolvedSos = 0;
		return route.fulfill({ json: data });
	});
	await page.goto("/dashboard");
	const overview = page.getByTestId("host-dashboard-overview");
	const trips = overview.getByRole("region", { name: "Chuyến đi đang diễn ra", exact: true });
	const rescue = overview.getByRole("region", { name: "Yêu cầu cứu trợ", exact: true });
	const pager = overview.getByRole("navigation", {
		name: "Phân trang Chuyến đi đang diễn ra",
		exact: true,
	});
	await expect(trips.getByRole("button", { name: "Xem chuyến đi", exact: true })).toHaveCount(3);
	await expect(pager).toContainText("1–3 / 7");
	const tripsBox = await trips.locator("..").boundingBox();
	const rescueBox = await rescue.boundingBox();
	if (!tripsBox || !rescueBox) throw new Error("Missing dashboard bounds");
	expect(Math.abs(tripsBox.width - rescueBox.width)).toBeLessThan(1);
	expect(Math.abs(tripsBox.height - rescueBox.height)).toBeLessThan(1);
	await overview.screenshot({ path: testInfo.outputPath("host-overview-three-trips.png") });
	await pager.getByRole("button", { name: "Sau", exact: true }).click();
	await expect(trips.getByText("Chuyến kiểm tra 4", { exact: true })).toBeVisible();
	await expect(trips.getByText("Chuyến kiểm tra 1", { exact: true })).toHaveCount(0);
	await expect(pager).toContainText("4–6 / 7");
	await pager.getByRole("button", { name: "Sau", exact: true }).click();
	await expect(trips.getByRole("button", { name: "Xem chuyến đi", exact: true })).toHaveCount(1);
	await expect(pager).toContainText("7–7 / 7");
	await expect(pager.getByRole("button", { name: "Sau", exact: true })).toBeDisabled();
	await expect(rescue).toContainText("Hiện không có yêu cầu cứu trợ cần xử lý.");
});

test("refreshes silently without requiring a manual refresh", async ({ page }) => {
	await setup(page);
	await page.clock.install();
	let refreshed = false;
	await page.route("**/api/host/monitoring/overview?*", (route) => {
		const data = overviewFixture();
		data.kpis.todaysBookings = refreshed ? 8 : 7;
		return route.fulfill({ json: data });
	});
	await page.goto("/dashboard");
	const kpis = page.getByRole("region", { name: "Chỉ số vận hành" });
	await expect(kpis.getByText("7", { exact: true })).toBeVisible();
	refreshed = true;
	await page.clock.fastForward(30_000);
	await expect(kpis.getByText("8", { exact: true })).toBeVisible();
	await expect(page.getByText(/Dữ liệu đang cũ/)).toHaveCount(0);
	await expect(page.getByText(/Cập nhật .*Asia\/Ho_Chi_Minh/)).toHaveCount(0);
});
