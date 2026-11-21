import { expect, test } from "@playwright/test";
import { overviewFixture } from "../fixtures/host-overview";

for (const scenario of ["normal", "far", "many"]) {
	const farLocation = scenario === "far";
	const manyParticipants = scenario === "many";
	test(manyParticipants
		? "paginates a Trip with 25 participants"
		: farLocation
			? "keeps route bounds with distant GPS and preserves marker identity"
			: "shows synchronized Host locations, Porter details, missing positions and an empty trip", async ({
		page,
	}, testInfo) => {
		const host = {
			id: "host",
			role: "host",
			roles: ["host"],
			status: "active",
			email: "host@ctms.local",
			fullName: "Nguyễn Minh Anh",
		};
		const route = {
			name: "Tuyến ven biển Sơn Trà",
			geometry: {
				type: "LineString",
				coordinates: [
					[108.28, 16.1],
					[108.31, 16.12],
				],
			},
			checkpoints: [
				{ id: "start", type: "start", location: { type: "Point", coordinates: [108.28, 16.1] } },
			],
		};
		const trips = [
			{ id: "son-tra", title: "Khám phá bán đảo Sơn Trà" },
			{ id: "hai-van", title: "Trekking đèo Hải Vân" },
		].map((trip) => ({
			...trip,
			hostId: host.id,
			routeId: "route",
			status: "ongoing",
			startsAt: new Date(Date.now() - 3600000).toISOString(),
			endsAt: new Date(Date.now() + 3600000).toISOString(),
		}));
		const participants = [
			{
				id: "lan",
				name: "Nguyễn Ngọc Lan",
				role: "camper",
				freshness: "fresh",
				lastSeenAt: new Date().toISOString(),
				location: { latitude: 16.109, longitude: 108.295 },
			},
			{
				id: "huy",
				name: "Trần Quốc Huy",
				role: "porter",
				freshness: "stale",
				lastSeenAt: new Date(Date.now() - 600000).toISOString(),
				location: { latitude: 16.114, longitude: 108.303 },
			},
			{
				id: "mai",
				name: "Lê Thanh Mai",
				role: "camper",
				freshness: "unavailable",
				lastSeenAt: null,
				location: null,
			},
			...(farLocation
				? [
						{
							id: "binh",
							name: "Phạm Thanh Bình",
							role: "camper",
							freshness: "stale",
							lastSeenAt: new Date(Date.now() - 86_400_000).toISOString(),
							location: { latitude: 37.4219983, longitude: -122.084 },
						},
					]
				: []),
		].map((participant) => ({ ...participant, safety: { route: null, gps: null } }));
		if (manyParticipants) {
			const names = [
				"Nguyễn Ngọc Lan",
				"Trần Quốc Huy",
				"Lê Thanh Mai",
				"Phạm Thanh Bình",
				"Nguyễn Minh Anh",
			];
			while (participants.length < 25) {
				const index = participants.length;
				participants.push({
					...participants[0],
					id: `member-${index}`,
					name: names[index % names.length],
				});
			}
		}
		let removeSelected = false;
		await page.routeWebSocket(/\/socket\.io\//, () => {});
		await page.addInitScript((user) => {
			localStorage.setItem("authUser", JSON.stringify(user));
			localStorage.setItem("accessToken", "test-token");
		}, host);
		await page.route("https://**/*", (route) => route.abort());
		await page.route(
			(url) => url.pathname.startsWith("/api/"),
			(request) => {
				const path = new URL(request.request().url()).pathname;
				if (path.endsWith("/host/monitoring/overview"))
					return request.fulfill({ json: overviewFixture() });
				if (path.endsWith("/auth/me") || path.includes("/profile"))
					return request.fulfill({ json: host });
				if (path.endsWith("/alerts"))
					return request.fulfill({
						json: {
							tripId: "son-tra",
							generatedAt: new Date().toISOString(),
							freshnessMaxAgeSeconds: 120,
							locationSource: "server_confirmed",
							alerts: [],
						},
					});
				if (path.endsWith("/trips/mine")) return request.fulfill({ json: trips });
				if (path.endsWith("/active-trips"))
					return request.fulfill({
						json: {
							total: 2,
							freshnessMaxAgeSeconds: 120,
							items: trips.map((trip, index) => ({
								...trip,
								route,
								participants:
									index === 0
										? participants.filter((person) => !removeSelected || person.id !== "mai")
										: [],
							})),
						},
					});
				if (path.includes("/participants/"))
					return request.fulfill({
						json: {
							freshnessMaxAgeSeconds: 120,
							participant: participants.find((item) => path.endsWith(`/${item.id}`)),
						},
					});
				return request.fulfill({ json: [] });
			}
		);
		await page.goto("/dashboard");
		await expect(page.getByRole("region", { name: "Bản đồ giám sát chuyến đi" })).toHaveCount(0);
		await page.getByRole("button", { name: "Giám sát chuyến đi", exact: true }).click();
		await expect(page).toHaveURL(/host\/trip-map/);
		const map = page.getByRole("region", { name: "Bản đồ giám sát chuyến đi" });
		await expect(map.getByTestId("checkpoint-map")).toHaveAttribute("data-map-mode", "fallback");
		const roster = map.getByRole("list", { name: "Thành viên trên bản đồ" });
		const detail = map.getByRole("region", { name: "Chi tiết thành viên" });
		if (manyParticipants) {
			await expect(roster.getByRole("button")).toHaveCount(6);
			await map.getByRole("button", { name: "Tiếp theo" }).click();
			await expect(map.getByText("Trang 2 / 5")).toBeVisible();
			await roster.getByRole("button").first().click();
			await expect(detail.getByRole("heading")).toBeVisible();
			await page.screenshot({
				fullPage: true,
				path: testInfo.outputPath("host-map-many-participants.png"),
			});
			await map.getByRole("button", { name: "Tiếp theo" }).click();
			await expect(roster.getByRole("button")).toHaveCount(6);
			const svg = map.getByLabel("Bản đồ tuyến trekking", { exact: true });
			const beforeZoom = await svg.getAttribute("viewBox");
			await map.getByRole("button", { name: /Phóng to cụm/ }).click();
			await expect(svg).not.toHaveAttribute("viewBox", beforeZoom ?? "");
			await expect(roster.locator('button[aria-pressed="true"]')).toHaveCount(0);
			await expect(map.getByText(/Đang chọn:/)).toBeVisible();
			await map.getByRole("button", { name: "Hiện trong danh sách" }).click();
			await expect(roster.locator('button[aria-pressed="true"]')).toHaveCount(1);
			return;
		}
		await roster.getByRole("button", { name: /Nguyễn Ngọc Lan/ }).click();
		await expect(detail.getByText(/Vị trí mới/)).toBeVisible();
		await expect(
			map.getByRole("button", { name: /Trần Quốc Huy .*Vị trí cũ/ }).first()
		).toBeVisible();
		await page.locator("main").evaluate((element) => {
			element.scrollTop = 0;
		});
		await page.screenshot({ fullPage: true, path: testInfo.outputPath("host-map-position.png") });
		await roster.getByRole("button", { name: /Trần Quốc Huy/ }).click();
		await expect(
			detail.getByRole("heading", { name: "Trần Quốc Huy · Người hỗ trợ" })
		).toBeVisible();
		await expect(detail.getByText(/Vị trí cũ/).first()).toBeVisible();
		await expect(detail.getByText(/Cần cập nhật dữ liệu/)).toBeVisible();
		await expect(detail.getByText(/Ghi nhận lệch tuyến/)).toHaveCount(0);
		await page.screenshot({ fullPage: true, path: testInfo.outputPath("host-map-porter.png") });
		if (farLocation) {
			const svg = map.getByLabel("Bản đồ tuyến trekking", { exact: true });
			await expect(svg).toHaveAttribute("viewBox", "0 0 100 100");
			await roster.getByRole("button", { name: /Phạm Thanh Bình/ }).click();
			await expect(detail.getByText(/Vị trí nằm ngoài khu vực tuyến/)).toBeVisible();
			await expect(svg).toHaveAttribute("viewBox", "0 0 100 100");
			await expect(roster.getByRole("button", { name: /Phạm Thanh Bình/ })).toContainText("C4");
			await page.screenshot({
				fullPage: true,
				path: testInfo.outputPath("host-map-far-position.png"),
			});
			await map.getByRole("button", { name: "Đến vị trí thành viên đã chọn" }).click();
			await expect(svg).not.toHaveAttribute("viewBox", "0 0 100 100");
			await map.getByRole("button", { name: "Quay lại tuyến" }).click();
			await expect(svg).toHaveAttribute("viewBox", "0 0 100 100");
		}

		await roster.getByRole("button", { name: /Lê Thanh Mai/ }).click();
		await expect(detail.getByText("Chưa có vị trí")).toBeVisible();
		await page.locator("main").evaluate((element) => {
			element.scrollTop = 0;
		});
		await page.screenshot({
			fullPage: true,
			path: testInfo.outputPath("host-map-no-position.png"),
		});
		if (!farLocation) {
			await page.getByRole("button", { name: "Làm mới dữ liệu giám sát" }).click();
			await expect(
				detail.getByRole("heading", { name: "Lê Thanh Mai · Người tham gia" })
			).toBeVisible();
			removeSelected = true;
			await expect(page.getByRole("button", { name: "Làm mới dữ liệu giám sát" })).toBeEnabled();
			await page.getByRole("button", { name: "Làm mới dữ liệu giám sát" }).click();
			await expect(
				map.getByText("Thành viên đang chọn không còn trong chuyến đi. Đã bỏ chọn.")
			).toBeVisible();
			await expect(detail).toHaveCount(0);
		}

		await page.getByRole("button", { name: "Đổi chuyến", exact: true }).click();
		await page.getByRole("button", { name: /Trekking đèo Hải Vân/ }).click();
		await expect(map.getByText("Chưa có thành viên trong chuyến đi.")).toBeVisible();
		await page.locator("main").evaluate((element) => {
			element.scrollTop = 0;
		});
		await page.screenshot({ fullPage: true, path: testInfo.outputPath("host-map-empty.png") });
	});
}
