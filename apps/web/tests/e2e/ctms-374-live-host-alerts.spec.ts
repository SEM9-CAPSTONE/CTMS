import { type Locator, expect, test } from "@playwright/test";

test("real API opens current alerts and the related member on the satellite map", async ({
	page,
}, testInfo) => {
	test.skip(
		!process.env.CTMS_374_LIVE_PASSWORD,
		"Requires running local services and existing seed Host credentials"
	);
	await page.goto("http://localhost:5173/login");
	await page.locator('input[type="text"]').first().fill("host@ctms.local");
	await page.locator('input[type="password"]').fill(process.env.CTMS_374_LIVE_PASSWORD ?? "");
	await page.locator('form button[type="submit"]').click();
	await page.getByRole("button", { name: "Giám sát chuyến đi", exact: true }).click();
	const change = page.getByRole("button", { name: "Đổi chuyến", exact: true });
	await expect(change).toBeVisible();
	await change.click();
	await page.getByRole("button", { name: /Hành trình xanh Hải Vân/ }).click();
	const canvas = page.getByTestId("checkpoint-map");
	await expect(canvas).toHaveAttribute("data-map-mode", "maplibre", { timeout: 30000 });
	await expect(canvas).toHaveAttribute("data-map-rendered", "true", { timeout: 30000 });
	const sorter = page.getByLabel("Sắp xếp thành viên");
	const memberList = page.getByRole("list", { name: "Thành viên trên bản đồ" });
	await expect(sorter).toHaveValue("attention");
	await expect(memberList.getByRole("button").first()).toContainText("Chưa có vị trí");
	await sorter.selectOption("code");
	const codes = await memberList.getByRole("button").allTextContents();
	const displayedCodes = codes.map((text) => text.match(/^[CP]\d+/)?.[0] ?? "");
	expect(displayedCodes).toEqual(
		[...displayedCodes].sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
	);
	await memberList.getByRole("button").first().click();
	const chosenCode = displayedCodes[0];
	const memberHeading = page
		.getByRole("region", { name: "Chi tiết thành viên" })
		.getByRole("heading");
	await expect(memberHeading).toBeVisible();
	const chosenHeading = await memberHeading.textContent();
	await page.screenshot({
		fullPage: true,
		path: testInfo.outputPath("host-members-sort-code.png"),
	});
	await sorter.selectOption("name");
	await expect(memberHeading).toHaveText(chosenHeading ?? "");
	await expect(canvas.locator('.maplibregl-marker[aria-pressed="true"]')).toContainText(chosenCode);
	await page.screenshot({
		fullPage: true,
		path: testInfo.outputPath("host-members-sort-name.png"),
	});
	await sorter.selectOption("attention");
	await expect(memberList.getByRole("button").first()).toContainText("Chưa có vị trí");
	await page.screenshot({
		fullPage: true,
		path: testInfo.outputPath("host-members-sort-attention.png"),
	});
	await page.getByRole("tab", { name: /Cảnh báo/ }).click();
	const alerts = page.getByRole("region", { name: "Danh sách cảnh báo" });
	await expect(alerts.getByRole("button", { name: /nghiêm trọng/ }).first()).toBeVisible();
	await alerts.getByRole("button", { name: /Nguyễn Văn An.*nghiêm trọng/ }).click();
	await expect(alerts.locator('button[aria-pressed="true"]')).toHaveCount(2);
	await expect(alerts.getByText(/Vị trí mới/).first()).toBeVisible();
	await expect(page.getByLabel("Cảnh báo đang chọn")).toContainText("Chậm tiến độ nghiêm trọng");
	const selectedMarker = canvas.locator('.maplibregl-marker[aria-pressed="true"]');
	await expect(selectedMarker).toContainText("Đang chọn");
	await expectCentered(canvas);
	expect(
		(await alerts.getByRole("list", { name: "Các cảnh báo của chuyến đi" }).boundingBox())?.height
	).toBeLessThanOrEqual(321);
	await expect(page.getByRole("region", { name: "Chi tiết thành viên" })).toContainText(
		"Nguyễn Văn An"
	);
	await expect(canvas).toHaveAttribute("data-map-rendered", "true", { timeout: 30000 });
	await page.screenshot({ fullPage: true, path: testInfo.outputPath("host-alerts-real-api.png") });
	await alerts.getByText("Lưu ý về dữ liệu vị trí", { exact: true }).click();
	await expect(alerts.getByText(/Thành viên mất tín hiệu định vị/)).toBeVisible();
	await page.screenshot({
		fullPage: true,
		path: testInfo.outputPath("host-alerts-location-guidance.png"),
	});
	await alerts.getByText("Lưu ý về dữ liệu vị trí", { exact: true }).click();
	await page.setViewportSize({ width: 1440, height: 600 });
	const header = page
		.locator("main header")
		.filter({ has: page.getByRole("heading", { name: "Giám sát chuyến đi", exact: true }) });
	const headerTop = (await header.boundingBox())?.y;
	const scrollContainer = await header.evaluateHandle((element) => {
		let parent = element.parentElement;
		while (parent) {
			if (
				parent.scrollHeight > parent.clientHeight &&
				/auto|scroll/.test(getComputedStyle(parent).overflowY)
			)
				return parent;
			parent = parent.parentElement;
		}
		return document.scrollingElement as HTMLElement;
	});
	const returnControl = page.getByRole("button", { name: "Quay lại tuyến", exact: true });
	const originalControlBox = await returnControl.boundingBox();
	const originalHeaderBox = await header.boundingBox();
	if (!originalControlBox || !originalHeaderBox)
		throw new Error("Header or map control unavailable");
	const targetScroll = Math.round(
		originalControlBox.y + originalControlBox.height / 2 - originalHeaderBox.height / 2
	);
	await scrollContainer.evaluate((element, target) => {
		element.scrollTop = target;
	}, targetScroll);
	await expect
		.poll(async () =>
			Math.abs((await scrollContainer.evaluate((element) => element.scrollTop)) - targetScroll)
		)
		.toBeLessThan(1);
	await expect.poll(async () => (await header.boundingBox())?.y).toBe(headerTop);
	const controlBox = await returnControl.boundingBox();
	if (!controlBox) throw new Error("Map control unavailable after scrolling");
	expect(
		await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest("header")), {
			x: controlBox.x + controlBox.width / 2,
			y: controlBox.y + controlBox.height / 2,
		})
	).toBe(true);
	await expect(canvas).toHaveAttribute("data-map-rendered", "true", { timeout: 30000 });
	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			)
	);
	await page.screenshot({ path: testInfo.outputPath("host-alerts-sticky-header-scrolled.png") });
	await scrollContainer.evaluate((element) => {
		element.scrollTop = 0;
	});
	await expect.poll(() => scrollContainer.evaluate((element) => element.scrollTop)).toBe(0);
	await page.setViewportSize({ width: 1440, height: 1200 });
	await alerts.getByLabel("Mức độ cảnh báo").selectOption("BEHIND");
	await expect(alerts.getByRole("button")).toHaveCount(1);
	await alerts.getByRole("button").click();
	await expect(page.getByRole("region", { name: "Chi tiết thành viên" })).toContainText(
		"Trần Quốc Huy"
	);
	await expect(selectedMarker).toHaveAttribute("aria-label", /Trần Quốc Huy/);
	await expectCentered(canvas);
	await expect(canvas).toHaveAttribute("data-map-rendered", "true", { timeout: 30000 });
	await page.screenshot({
		fullPage: true,
		path: testInfo.outputPath("host-alerts-real-api-behind.png"),
	});
	await alerts.getByLabel("Mức độ cảnh báo").selectOption("");
	await alerts.getByLabel("Loại cảnh báo").selectOption("OFF_ROUTE");
	await expect(alerts.getByRole("button")).toHaveCount(1);
	await alerts.getByRole("button").click();
	await expect(page.getByLabel("Cảnh báo đang chọn")).toContainText("Lệch tuyến");
	await expect(
		page.getByRole("region", { name: "Chi tiết thành viên" }).getByText(/Ghi nhận lệch tuyến/)
	).toHaveCount(0);
	await expectCentered(canvas);
	await expect(canvas).toHaveAttribute("data-map-rendered", "true", { timeout: 30000 });
	await page.screenshot({
		fullPage: true,
		path: testInfo.outputPath("host-alerts-real-api-off-route.png"),
	});
	await alerts.getByLabel("Mức độ cảnh báo").selectOption("BEHIND");
	await expect(alerts).toContainText("Không có cảnh báo phù hợp với bộ lọc.");
	await page.screenshot({
		fullPage: true,
		path: testInfo.outputPath("host-alerts-real-api-empty-filter.png"),
	});
	await page.getByRole("button", { name: "Đổi chuyến", exact: true }).click();
	await page.getByRole("button", { name: /Chinh phục đèo Hải Vân/ }).click();
	await page.getByRole("tab", { name: "Cảnh báo (0)" }).click();
	await expect(alerts.getByLabel("Loại cảnh báo")).toHaveValue("");
	await expect(alerts.getByLabel("Mức độ cảnh báo")).toHaveValue("");
	await expect(page.getByRole("region", { name: "Chi tiết thành viên" })).toHaveCount(0);
	await expect(alerts).toContainText(
		"Không có cảnh báo lệch tuyến hoặc chậm tiến độ được ghi nhận"
	);
	await page.screenshot({
		fullPage: true,
		path: testInfo.outputPath("host-alerts-real-api-empty.png"),
	});
	for (const width of [1280, 1024, 768]) {
		await page.setViewportSize({ width, height: 1000 });
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
		).toBe(true);
	}
});

async function expectCentered(canvas: Locator) {
	await expect
		.poll(async () => {
			const mapBox = await canvas.boundingBox();
			const markerBox = await canvas
				.locator('.maplibregl-marker[aria-pressed="true"]')
				.boundingBox();
			if (!mapBox || !markerBox) return Number.POSITIVE_INFINITY;
			return Math.hypot(
				markerBox.x + markerBox.width / 2 - mapBox.x - mapBox.width / 2,
				markerBox.y + markerBox.height / 2 - mapBox.y - mapBox.height / 2
			);
		})
		.toBeLessThan(4);
}
