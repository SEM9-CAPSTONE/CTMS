import { expect, test } from "@playwright/test";

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
