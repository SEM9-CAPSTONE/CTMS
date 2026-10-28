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
	await expect(overview.getByText("Trang 2 / 2")).toBeVisible();
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
	).toHaveCount(6);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
});
