import { expect, test } from "@playwright/test";
import { overviewFixture } from "../fixtures/host-overview";

for (const scenario of ["alerts", "404", "409", "network", "refresh", "many", "loading"]) {
	test(`Host alerts: ${scenario}`, async ({ page }, testInfo) => {
		let releaseLoading = () => {};
		const loadingGate = new Promise<void>((resolve) => {
			releaseLoading = resolve;
		});
		const host = {
			id: "host",
			role: "host",
			roles: ["host"],
			status: "active",
			email: "host@ctms.local",
			fullName: "Nguyễn Minh Anh",
		};
		const trips = ["son-tra", "hai-van"].map((id, index) => ({
			id,
			hostId: host.id,
			routeId: "route",
			title: index ? "Trekking đèo Hải Vân" : "Khám phá bán đảo Sơn Trà",
			status: "ongoing",
			startsAt: new Date().toISOString(),
			endsAt: new Date(Date.now() + 3600000).toISOString(),
		}));
		const route = {
			name: "Tuyến ven biển Sơn Trà",
			geometry: {
				type: "LineString",
				coordinates: [
					[108.28, 16.1],
					[108.31, 16.12],
				],
			},
			checkpoints: [],
		};
		const person = {
			id: "lan",
			role: "camper",
			name: "Nguyễn Ngọc Lan",
			location: { longitude: 108.29, latitude: 16.11 },
			lastSeenAt: new Date().toISOString(),
			freshness: "fresh",
			safety: { route: null, gps: null },
		};
		const offRoute = {
			participantId: person.id,
			role: person.role,
			name: person.name,
			location: person.location,
			lastLocationAt: person.lastSeenAt,
			freshness: "fresh",
			isStale: false,
			alertType: "OFF_ROUTE",
			severity: null,
			observedAt: person.lastSeenAt,
		};
		let failure = scenario;
		let reads = 0;
		let excludeFirstTrip = false;
		await page.routeWebSocket(/\/socket\.io\//, () => {});
		await page.addInitScript((user) => {
			localStorage.setItem("authUser", JSON.stringify(user));
			localStorage.setItem("accessToken", "test-token");
		}, host);
		await page.route(
			(url) => url.pathname.startsWith("/api/"),
			async (request) => {
				const path = new URL(request.request().url()).pathname;
				if (path.endsWith("/host/monitoring/overview"))
					return request.fulfill({ json: overviewFixture() });
				if (path.endsWith("/auth/me") || path.includes("/profile"))
					return request.fulfill({ json: host });
				if (path.endsWith("/trips/mine"))
					return request.fulfill({ json: excludeFirstTrip ? trips.slice(1) : trips });
				if (path.endsWith("/active-trips")) {
					if (scenario === "loading") await loadingGate;
					reads++;
					return request.fulfill({
						json: {
							items: trips.map((trip) => ({ ...trip, route, participants: [person] })),
							total: 2,
							freshnessMaxAgeSeconds: 120,
						},
					});
				}
				if (path.endsWith("/alerts")) {
					if (failure === "network") return request.abort();
					if (failure === "404" || failure === "409")
						return request.fulfill({
							status: Number(failure),
							json: { message: "Internal detail must not be displayed" },
						});
					const alerts =
						scenario === "many"
							? Array.from({ length: 25 }, (_, index) => ({
									...offRoute,
									participantId: index === 0 ? person.id : `member-${index}`,
									name: index === 0 ? person.name : `Thành viên ${index}`,
									alertType: "BEHIND_SCHEDULE",
									severity: index === 0 ? "SEVERELY_BEHIND" : "BEHIND",
								}))
							: [
									offRoute,
									{ ...offRoute, alertType: "BEHIND_SCHEDULE", severity: "SEVERELY_BEHIND" },
									{ ...offRoute, participantId: "missing", name: "Trần Quốc Huy" },
								];
					return request.fulfill({
						json: {
							tripId: "son-tra",
							generatedAt: new Date().toISOString(),
							freshnessMaxAgeSeconds: 120,
							locationSource: "server_confirmed",
							alerts: path.includes("hai-van") ? [] : alerts,
						},
					});
				}
				if (path.includes("/participants/"))
					return request.fulfill({ json: { participant: person, freshnessMaxAgeSeconds: 120 } });
				return request.fulfill({ json: [] });
			}
		);
		await page.goto("/host/trip-map");
		if (scenario === "loading") {
			await expect(page.getByText("Đang tải bản đồ chuyến đi...", { exact: true })).toBeVisible();
			await page.screenshot({ fullPage: true, path: testInfo.outputPath("mock-api-loading.png") });
			releaseLoading();
			await expect(page.getByRole("tab", { name: /Cảnh báo/ })).toBeVisible();
			return;
		}
		await page.getByRole("tab", { name: /Cảnh báo/ }).click();
		const alerts = page.getByRole("region", { name: "Danh sách cảnh báo" });
		await expect(page.getByRole("tab", { name: /Cảnh báo/ })).toHaveAttribute(
			"aria-selected",
			"true"
		);
		await expect(page.getByRole("tab", { name: /Cảnh báo/ })).toHaveCSS(
			"background-color",
			"rgb(22, 64, 39)"
		);
		await expect(
			page.getByRole("heading", { name: "Chuyến đi cần theo dõi", exact: true })
		).toBeVisible();
		await page.evaluate(() => document.fonts.ready);
		await expect(page.getByTestId("checkpoint-map")).toHaveAttribute("data-map-mode", "maplibre", {
			timeout: 30000,
		});
		await expect(page.getByTestId("checkpoint-map")).toHaveAttribute("data-map-rendered", "true", {
			timeout: 30000,
		});
		if (["404", "409", "network"].includes(scenario)) {
			await expect(page.getByRole("alert")).toContainText(
				scenario === "404"
					? "không khả dụng hoặc bạn không có quyền"
					: scenario === "409"
						? "không còn diễn ra"
						: "Không thể tải cảnh báo"
			);
			await expect(page.getByTestId("checkpoint-map")).toBeVisible();
			await page.screenshot({
				fullPage: true,
				path: testInfo.outputPath(`mock-api-${scenario}.png`),
			});
			await page.getByRole("tab", { name: "Thành viên", exact: true }).click();
			await expect(page.getByRole("list", { name: "Thành viên trên bản đồ" })).toBeVisible();
			await expect(page.getByRole("alert")).toHaveCount(0);
			await page.getByRole("tab", { name: /Cảnh báo/ }).click();
			failure = "alerts";
			if (scenario === "network")
				await page.getByRole("button", { name: "Thử lại", exact: true }).click();
			else {
				await expect(page.getByRole("button", { name: "Thử lại", exact: true })).toHaveCount(0);
				excludeFirstTrip = true;
				await page.getByRole("button", { name: "Làm mới danh sách chuyến", exact: true }).click();
				await expect(page.getByRole("button", { name: /Trekking đèo Hải Vân/ })).toBeVisible();
				await page.getByRole("tab", { name: /Cảnh báo/ }).click();
			}
			await expect(alerts).toBeVisible();
			return;
		}
		if (scenario === "many") {
			await expect(page.getByRole("tab", { name: "Cảnh báo (25)" })).toBeVisible();
			await expect(alerts.locator("button[aria-pressed]")).toHaveCount(25);
			const list = alerts.getByRole("list", { name: "Các cảnh báo của chuyến đi" });
			expect(await list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
				true
			);
			await expect(alerts.getByText(/Trang \d/)).toHaveCount(0);
			await alerts.getByLabel("Mức độ cảnh báo").selectOption("SEVERELY_BEHIND");
			await expect(alerts.locator("button[aria-pressed]")).toHaveCount(1);
			return;
		}
		await expect(page.getByRole("tab", { name: "Cảnh báo (3)" })).toBeVisible();
		await alerts.getByRole("button", { name: /Nguyễn Ngọc Lan.*nghiêm trọng/ }).click();
		await expect(alerts.locator('button[aria-pressed="true"]')).toHaveCount(2);
		await expect(
			page.getByRole("region", { name: "Chi tiết thành viên" }).getByRole("heading")
		).toContainText(person.name);
		await expect(page.getByTestId("checkpoint-map").locator('[aria-pressed="true"]')).toHaveCount(
			1
		);
		if (scenario === "refresh") {
			failure = "409";
			await page.getByRole("button", { name: "Làm mới dữ liệu giám sát", exact: true }).click();
			await expect(page.getByRole("alert")).toContainText("Đã bỏ chọn thành viên");
			await expect(page.getByRole("region", { name: "Chi tiết thành viên" })).toHaveCount(0);
			return;
		}
		await alerts.getByRole("button", { name: /Trần Quốc Huy/ }).click();
		await expect(page.getByRole("status")).toContainText("không còn dữ liệu vị trí");
		await expect(alerts.locator('button[aria-pressed="true"]')).toHaveCount(2);
		await alerts.getByLabel("Mức độ cảnh báo").selectOption("SEVERELY_BEHIND");
		await expect(alerts.getByRole("button")).toHaveCount(1);
		await expect(alerts).toContainText("không bao gồm cảnh báo lệch tuyến");
		await alerts.getByLabel("Loại cảnh báo").selectOption("OFF_ROUTE");
		await expect(alerts).toContainText("Không có cảnh báo phù hợp");
		await page.screenshot({
			fullPage: true,
			path: testInfo.outputPath("mock-api-empty-filter.png"),
		});
		const before = reads;
		await page.getByRole("button", { name: "Làm mới dữ liệu giám sát", exact: true }).click();
		await expect.poll(() => reads).toBeGreaterThan(before);
		await page.getByRole("button", { name: "Đổi chuyến", exact: true }).click();
		await page.getByRole("button", { name: /Trekking đèo Hải Vân/ }).click();
		await expect(page.getByRole("region", { name: "Chi tiết thành viên" })).toHaveCount(0);
		await page.getByRole("tab", { name: /Cảnh báo/ }).click();
		await expect(alerts.getByLabel("Mức độ cảnh báo")).toHaveValue("");
		await page.screenshot({
			fullPage: true,
			path: testInfo.outputPath("mock-api-trip-change-reset.png"),
		});
		await expect(alerts).toContainText(
			"Không có cảnh báo lệch tuyến hoặc chậm tiến độ được ghi nhận"
		);
	});
}
