import { type Page, expect, test } from "@playwright/test";
async function setup(page: Page, role: string) {
	page.on("pageerror", (error) => console.error("UI_PAGE_ERROR", error.message));
	// Keep rendering deterministic: exercise the real MapLibre renderer without external tile availability.
	await page.route("https://api.maptiler.com/maps/hybrid-v4/style.json?*", (route) =>
		route.fulfill({
			json: {
				version: 8,
				sources: {},
				layers: [
					{ id: "test-background", type: "background", paint: { "background-color": "#e1e9df" } },
				],
			},
		})
	);

	const user = {
		id: "ui-test",
		role,
		roles: [role],
		status: "active",
		email: `${role}@example.test`,
		createdAt: "2026-01-01",
	};
	await page.addInitScript((user) => {
		localStorage.setItem("authUser", JSON.stringify(user));
		localStorage.setItem("accessToken", "ui-test");
	}, user);
	await page.route(
		(url) => url.pathname.startsWith("/api/"),
		(route) => {
			const path = new URL(route.request().url()).pathname;
			let body: unknown = [];
			if (path.endsWith("/auth/me")) body = user;
			if (path.includes("/profile"))
				body = { ...user, fullName: "UI Test", languages: [], emergencyContacts: [] };
			if (path === "/api/porter/verification")
				body = { porterId: "ui-test", status: "approved", version: 1, documents: [] };
			if (path === "/api/users")
				body = { items: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } };
			if (path === "/api/bookings")
				body = [
					{
						id: "booking",
						tripId: "trip",
						status: "confirmed",
						tripStartsAtSnapshot: "2099-01-01",
						tripEndsAtSnapshot: "2099-01-02",
						createdAt: "2026-01-01",
					},
				];
			if (path === "/api/trips/trip")
				body = {
					id: "trip",
					title: "Chuyến UI kiểm tra",
					startsAt: "2099-01-01T06:00:00Z",
					status: "published",
					meetingPoint: { type: "Point", coordinates: [108.25, 16.1] },
					waypoints: [
						{ name: "Điểm nghỉ", location: { type: "Point", coordinates: [108.26, 16.11] } },
					],
				};
			const mapRoute = {
				id: "route",
				name: "Tuyến đã lưu",
				status: "active",
				updatedAt: "2026-01-01",
				geometry: {
					type: "LineString",
					coordinates: [
						[108.25, 16.1],
						[108.26, 16.11],
						[108.27, 16.12],
					],
				},
				checkpoints: [],
				dangerZones: [],
			};
			if (path === "/api/trips/trip/route-map")
				body = {
					tripId: "trip",
					title: "Chuyến UI kiểm tra",
					meetingPoint: { type: "Point", coordinates: [108.25, 16.1] },
					route: mapRoute,
				};
			if (path === "/api/trips/assigned")
				body = [
					{
						tripId: "trip",
						title: "Chuyến Porter kiểm tra",
						status: "published",
						startsAt: "2099-01-01T06:00:00Z",
						endsAt: "2099-01-02T06:00:00Z",
						routeName: mapRoute.name,
					},
				];
			if (path === "/api/trips/assigned/trip")
				body = {
					tripId: "trip",
					title: "Chuyến Porter kiểm tra",
					meetingPoint: { type: "Point", coordinates: [108.25, 16.1] },
					route: mapRoute,
				};

			return route.fulfill({ json: body });
		}
	);
}
test("host bell opens and closes inbox beside branding", async ({ page }) => {
	await setup(page, "host");
	await page.goto("/dashboard");
	const bell = page.locator("aside").getByRole("button", { name: /Thông báo hủy đặt chỗ/ });
	await expect(bell).toBeVisible();
	await bell.click();
	await expect(page.getByRole("dialog", { name: "Thông báo hủy đặt chỗ" })).toBeVisible();
	await page.getByRole("button", { name: "Đóng thông báo" }).click();
	await expect(page.getByRole("dialog")).not.toBeVisible();
	await page.screenshot({ path: "test-results/mentor-host-bell.png" });
});
test("admin logout remains inside viewport at short desktop heights", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 600 });
	await setup(page, "admin");
	await page.goto("/admin/users");
	const logout = page.getByRole("button", { name: "Đăng xuất", exact: true });
	await expect(logout).toBeVisible();
	const box = await logout.boundingBox();
	if (!box) throw new Error("Logout button is outside the rendered layout");
	expect(box.y + box.height).toBeLessThanOrEqual(600);
	await expect(page.locator("aside nav")).toHaveCSS("overflow-y", "auto");
	await page.screenshot({ path: "test-results/mentor-admin-sidebar.png" });
});
test("camper renders a real geographic map from confirmed booking data", async ({ page }) => {
	await setup(page, "camper");
	await page.goto("/dashboard");

	const map = page.getByTestId("checkpoint-map");
	await expect(map).toBeVisible();
	await expect(map).toHaveAttribute("data-map-mode", "maplibre", { timeout: 20000 });
	await expect(map.locator("canvas.maplibregl-canvas")).toBeVisible();
	await expect(page.getByText("Bản đồ tuyến · Tuyến đã lưu")).toBeVisible();

	await page.screenshot({ path: "test-results/mentor-camper-map.png" });
});
test("trip creation has one map and no endpoint picker", async ({ page }) => {
	await setup(page, "host");
	await page.goto("/host/trips/create");
	await expect(page.getByTestId("trip-route-map")).toHaveCount(1);
	await expect(page.getByText("Chọn điểm bắt đầu và kết thúc trên bản đồ")).toHaveCount(0);
	await expect(page.getByTestId("route-map-surface")).toHaveCount(0);
});

test("porter dashboard loads the assigned saved route with the same map renderer", async ({
	page,
}) => {
	await setup(page, "porter");
	await page.goto("/dashboard");
	await expect(page.getByText("Chuyến Porter kiểm tra", { exact: true })).toBeVisible();
	const map = page.getByTestId("checkpoint-map");
	await expect(map).toBeVisible();
	await expect(map).toHaveAttribute("data-map-mode", "maplibre", { timeout: 20000 });
	await expect(page.getByText("Bản đồ tuyến · Tuyến đã lưu")).toBeVisible();
	await page.screenshot({ path: "test-results/mentor-porter-map.png" });
});
