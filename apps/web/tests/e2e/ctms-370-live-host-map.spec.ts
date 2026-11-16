import { expect, test } from "@playwright/test";

test("live API renders the existing seeded Host Trip and Porter details", async ({
	page,
}, testInfo) => {
	test.skip(
		!process.env.CTMS_370_LIVE_PASSWORD,
		"Requires the existing local seed Host credentials and running local services"
	);
	await page.goto("http://localhost:5173/login");
	await page.locator('input[type="text"]').first().fill("host@ctms.local");
	await page.locator('input[type="password"]').fill(process.env.CTMS_370_LIVE_PASSWORD ?? "");
	await page.locator('form button[type="submit"]').click();
	await page.getByRole("button", { name: "Giám sát chuyến đi", exact: true }).click();
	await page.getByRole("button", { name: /Chinh phục đèo Hải Vân/ }).click();
	const map = page.getByRole("region", { name: "Bản đồ giám sát chuyến đi" });
	const roster = map.getByRole("list", { name: "Thành viên trên bản đồ" });
	await expect(roster.getByRole("button")).toHaveCount(2);
	await expect(map.getByTestId("checkpoint-map")).toHaveAttribute(
		"data-map-mode",
		/maplibre|fallback/,
		{ timeout: 30000 }
	);
	await roster.getByRole("button", { name: /Nguyễn Văn An/ }).click();
	const camperDetail = map.getByRole("region", { name: "Chi tiết thành viên" });
	await expect(camperDetail.getByText(/Ghi nhận trở lại tuyến/)).toBeVisible();
	await expect(map.getByTestId("checkpoint-map")).toHaveAttribute("data-map-rendered", "true", {
		timeout: 30000,
	});
	await expect(map.getByLabel("Hướng dẫn đọc vị trí thành viên")).toContainText(
		"2 thành viên có vị trí"
	);
	await page.screenshot({ fullPage: true, path: testInfo.outputPath("host-map-live-camper.png") });
	await roster.getByRole("button", { name: /Người hỗ trợ/ }).click();
	const detail = map.getByRole("region", { name: "Chi tiết thành viên" });
	await expect(detail.getByRole("heading")).toContainText("Người hỗ trợ");
	await expect(detail.getByText(/Vị trí cũ/).first()).toBeVisible();
	await expect(detail.getByText(/Cần cập nhật dữ liệu/)).toBeVisible();
	await expect(detail.getByText(/Ghi nhận lệch tuyến/)).toHaveCount(0);
	await page.screenshot({ fullPage: true, path: testInfo.outputPath("host-map-live-porter.png") });
});

test("live API retains the Route viewport with a distant stored GPS sample", async ({
	page,
}, testInfo) => {
	test.skip(
		!process.env.CTMS_370_LIVE_PASSWORD || !process.env.CTMS_370_LIVE_FAR,
		"Requires the opt-in far-location main seed fixture"
	);
	await page.goto("http://localhost:5173/login");
	await page.locator('input[type="text"]').first().fill("host@ctms.local");
	await page.locator('input[type="password"]').fill(process.env.CTMS_370_LIVE_PASSWORD ?? "");
	await page.locator('form button[type="submit"]').click();
	await page.getByRole("button", { name: "Giám sát chuyến đi", exact: true }).click();
	await page.getByRole("button", { name: /Chinh phục đèo Hải Vân/ }).click();
	const map = page.getByRole("region", { name: "Bản đồ giám sát chuyến đi" });
	const canvas = map.getByTestId("checkpoint-map");
	await expect(canvas).toHaveAttribute("data-map-mode", "maplibre", { timeout: 30000 });
	const roster = map.getByRole("list", { name: "Thành viên trên bản đồ" });
	await roster.getByRole("button").filter({ hasText: "Ngoài khu vực tuyến" }).click();
	const detail = map.getByRole("region", { name: "Chi tiết thành viên" });
	await expect(detail.getByText(/37.42200, -122.08400/)).toBeVisible();
	await expect(detail.getByText(/Ghi nhận lệch tuyến/)).toBeVisible();
	const checkpoint = canvas.locator(".maplibregl-marker").filter({ hasText: /^4$/ });
	await expect(checkpoint).toBeVisible();
	const viewportBounds = await canvas.boundingBox();
	const checkpointBounds = await checkpoint.boundingBox();
	expect(viewportBounds).not.toBeNull();
	expect(checkpointBounds).not.toBeNull();
	if (!viewportBounds || !checkpointBounds) throw new Error("Map geometry is unavailable");
	expect(checkpointBounds.x).toBeGreaterThan(viewportBounds.x);
	expect(checkpointBounds.x + checkpointBounds.width).toBeLessThan(
		viewportBounds.x + viewportBounds.width
	);
	expect(checkpointBounds.y).toBeGreaterThan(viewportBounds.y);
	expect(checkpointBounds.y + checkpointBounds.height).toBeLessThan(
		viewportBounds.y + viewportBounds.height
	);
	await expect(canvas).toHaveAttribute("data-map-rendered", "true", { timeout: 30000 });
	await page.screenshot({
		fullPage: true,
		path: testInfo.outputPath("host-map-live-far-location.png"),
	});
	await map.getByRole("button", { name: "Đến vị trí thành viên đã chọn" }).click();
	await expect(canvas).toHaveAttribute("data-map-rendered", "true", { timeout: 30000 });
	const selectedMarker = canvas.locator('.maplibregl-marker[aria-pressed="true"]');
	const selectedBounds = await selectedMarker.boundingBox();
	expect(selectedBounds).not.toBeNull();
	if (!selectedBounds) throw new Error("Selected marker is unavailable");
	expect(selectedBounds.x).toBeGreaterThan(viewportBounds.x);
	expect(selectedBounds.x + selectedBounds.width).toBeLessThan(
		viewportBounds.x + viewportBounds.width
	);
	await page.screenshot({
		fullPage: true,
		path: testInfo.outputPath("host-map-live-far-focus.png"),
	});
	await map.getByRole("button", { name: "Xem toàn tuyến" }).click();
	await expect(canvas).toHaveAttribute("data-map-rendered", "true", { timeout: 30000 });
});

test("live API shows a 25-person Trip and a participant without GPS on the satellite map", async ({
	page,
}, testInfo) => {
	test.skip(
		!process.env.CTMS_370_LIVE_PASSWORD || !process.env.CTMS_370_LIVE_GROUP,
		"Requires the existing-account group main seed fixture"
	);
	await page.goto("http://localhost:5173/login");
	await page.locator('input[type="text"]').first().fill("host@ctms.local");
	await page.locator('input[type="password"]').fill(process.env.CTMS_370_LIVE_PASSWORD ?? "");
	await page.locator('form button[type="submit"]').click();
	await page.getByRole("button", { name: "Giám sát chuyến đi", exact: true }).click();
	await page.getByRole("button", { name: "Đổi chuyến", exact: true }).click();
	await expect(
		page.getByRole("button", { name: "Thu gọn danh sách chuyến", exact: true })
	).toHaveAttribute("aria-expanded", "true");
	await expect(page.getByTestId("checkpoint-map")).toHaveAttribute("data-map-rendered", "true", {
		timeout: 30000,
	});
	await page.screenshot({
		fullPage: true,
		path: testInfo.outputPath("host-map-live-trip-selector-expanded.png"),
	});
	await page.getByRole("button", { name: /Hành trình xanh Hải Vân/ }).click();
	const map = page.getByRole("region", { name: "Bản đồ giám sát chuyến đi" });
	const canvas = map.getByTestId("checkpoint-map");
	await expect(canvas).toHaveAttribute("data-map-mode", "maplibre", { timeout: 30000 });
	await expect(canvas).toHaveAttribute("data-map-rendered", "true", { timeout: 30000 });
	await expect(map.getByText(/trong tổng số 25/)).toBeVisible();
	await canvas
		.getByRole("button", { name: /Phóng to cụm/ })
		.first()
		.click();
	await expect(canvas.locator('[aria-pressed="true"]')).toHaveCount(0);
	await map.getByRole("button", { name: "Quay lại tuyến" }).click();
	const roster = map.getByRole("list", { name: "Thành viên trên bản đồ" });
	await roster
		.getByRole("button")
		.filter({ hasNotText: "Chưa có vị trí" })
		.filter({ hasText: "Người tham gia" })
		.first()
		.click();
	await expect(roster.locator('button[aria-pressed="true"]')).toHaveCount(1);
	await expect(
		map.getByRole("region", { name: "Chi tiết thành viên" }).getByText(/Người tham gia/)
	).toBeVisible();
	await expect(canvas).toHaveAttribute("data-map-rendered", "true", { timeout: 30000 });
	const explanation = map.getByLabel("Hướng dẫn đọc vị trí thành viên");
	const groupCounts = await canvas.getByRole("button", { name: /Phóng to cụm/ }).allTextContents();
	for (const count of groupCounts) await expect(explanation).toContainText(`${count.trim()} người`);
	const canvasBox = await canvas.boundingBox();
	const explanationBox = await explanation.boundingBox();
	expect(canvasBox).not.toBeNull();
	expect(explanationBox).not.toBeNull();
	if (canvasBox && explanationBox)
		expect(explanationBox.y).toBeGreaterThanOrEqual(canvasBox.y + canvasBox.height);

	const pins = await canvas.locator(".maplibregl-marker[aria-pressed]").evaluateAll((elements) =>
		elements.map((element) => {
			const rect = element.getBoundingClientRect();
			const pin = element.firstElementChild?.getBoundingClientRect();
			return pin
				? {
						dx: pin.x + pin.width / 2 - rect.x - rect.width / 2,
						dy: pin.y + pin.height / 2 - rect.y - rect.height / 2,
					}
				: null;
		})
	);
	for (const pin of pins) {
		expect(pin).not.toBeNull();
		if (pin) {
			expect(Math.abs(pin.dx)).toBeLessThan(1);
			expect(Math.abs(pin.dy)).toBeLessThan(1);
		}
	}

	await map.getByRole("button", { name: "Tiếp theo", exact: true }).scrollIntoViewIfNeeded();
	await expect(map.getByRole("region", { name: "Chi tiết thành viên" })).toBeInViewport();
	await page.screenshot({ path: testInfo.outputPath("host-map-live-sticky-detail.png") });

	await page.locator("main").evaluate((element) => {
		element.scrollTop = 0;
	});
	await page.evaluate(() => window.scrollTo(0, 0));

	await page.screenshot({
		fullPage: true,
		path: testInfo.outputPath("host-map-live-many-participants.png"),
	});
	await map.getByRole("textbox", { name: "Tìm thành viên theo tên" }).fill("Nguyễn Văn An");
	await expect(roster.getByRole("button")).toHaveCount(1);
	await map.getByRole("textbox", { name: "Tìm thành viên theo tên" }).fill("");
	await map.getByRole("combobox", { name: "Lọc vai trò" }).selectOption("porter");
	await expect(roster.getByRole("button")).toHaveCount(1);
	await expect(roster.getByRole("button")).toContainText("Người hỗ trợ");
	await map.getByRole("combobox", { name: "Lọc vai trò" }).selectOption("all");

	// Find the unlocated participant through the actual roster pages.
	while (await map.getByRole("button", { name: "Trước", exact: true }).isEnabled()) {
		await map.getByRole("button", { name: "Trước", exact: true }).click();
	}
	for (let pageIndex = 0; pageIndex < 5; pageIndex++) {
		const missing = roster.getByRole("button").filter({ hasText: "Chưa có vị trí" });
		if (await missing.count()) {
			await missing.click();
			await expect(
				map.getByRole("region", { name: "Chi tiết thành viên" }).getByText("Chưa có vị trí")
			).toBeVisible();
			await expect(canvas).toHaveAttribute("data-map-rendered", "true", { timeout: 30000 });
			await page.screenshot({
				fullPage: true,
				path: testInfo.outputPath("host-map-live-no-position.png"),
			});
			return;
		}
		if (pageIndex < 4) await map.getByRole("button", { name: "Tiếp theo", exact: true }).click();
	}
	throw new Error("The existing-account group Trip must include an unlocated participant");
});

test("live API keeps desktop layout within the viewport at multiple widths and zoom levels", async ({
	page,
}, testInfo) => {
	test.skip(!process.env.CTMS_370_LIVE_PASSWORD, "Requires local seed credentials");
	await page.goto("http://localhost:5173/login");
	await page.locator('input[type="text"]').first().fill("host@ctms.local");
	await page.locator('input[type="password"]').fill(process.env.CTMS_370_LIVE_PASSWORD ?? "");
	await page.locator('form button[type="submit"]').click();
	await page.getByRole("button", { name: "Giám sát chuyến đi", exact: true }).click();
	const region = page.getByRole("region", { name: "Bản đồ giám sát chuyến đi" });
	const canvas = region.getByTestId("checkpoint-map");
	await expect(canvas).toHaveAttribute("data-map-mode", "maplibre", { timeout: 30000 });
	await region
		.getByRole("list", { name: "Thành viên trên bản đồ" })
		.getByRole("button", { name: /Nguyễn Văn An/ })
		.click();
	for (const size of [
		{ width: 1440, height: 900 },
		{ width: 1280, height: 900 },
		{ width: 1024, height: 768 },
	]) {
		await page.setViewportSize(size);
		await page.locator("main").evaluate((element) => {
			element.scrollTop = 0;
		});
		await page.evaluate(() => window.scrollTo(0, 0));
		await expect
			.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
			.toBe(true);
		const bounds = await canvas.boundingBox();
		expect(bounds).not.toBeNull();
		if (bounds) expect(bounds.x + bounds.width).toBeLessThanOrEqual(size.width + 1);
		await expect(canvas).toHaveAttribute("data-map-rendered", "true", { timeout: 30000 });
		await page.screenshot({
			fullPage: true,
			path: testInfo.outputPath(`host-map-live-desktop-${size.width}.png`),
		});
	}
	await page.setViewportSize({ width: 1440, height: 900 });
	for (let step = 0; step < 3; step++)
		await canvas.getByRole("button", { name: "Zoom out", exact: true }).click();
	await expect(canvas).toHaveAttribute("data-map-rendered", "true", { timeout: 30000 });
	const selected = canvas.locator('.maplibregl-marker[aria-pressed="true"]');
	const geometry = await selected.evaluate((element) => {
		const box = element.getBoundingClientRect();
		const dot = element.firstElementChild?.getBoundingClientRect();
		return dot
			? {
					dx: dot.x + dot.width / 2 - box.x - box.width / 2,
					dy: dot.y + dot.height / 2 - box.y - box.height / 2,
				}
			: null;
	});
	expect(geometry).not.toBeNull();
	if (geometry) {
		expect(Math.abs(geometry.dx)).toBeLessThan(1);
		expect(Math.abs(geometry.dy)).toBeLessThan(1);
	}
	await page.screenshot({
		fullPage: true,
		path: testInfo.outputPath("host-map-live-zoomed-out.png"),
	});
});
