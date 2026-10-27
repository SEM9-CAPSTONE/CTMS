import { type Page, expect, test } from "@playwright/test";
const png =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
async function setup(page: Page, failSave = false) {
	const user = {
		id: "host-test",
		role: "host",
		roles: ["host"],
		status: "active",
		email: "host@example.test",
		fullName: "Draft Host",
	};
	const drafts = new Map<
		string,
		{
			id: string;
			values: Record<string, unknown>;
			images: { name: string; type: string; base64: string }[];
		}
	>();
	await page.addInitScript((user) => {
		localStorage.setItem("authUser", JSON.stringify(user));
		localStorage.setItem("accessToken", "host-test");
	}, user);
	await page.route("https://api.maptiler.com/**", (route) =>
		route.fulfill({ json: { version: 8, sources: {}, layers: [] } })
	);
	await page.route(
		(url) => url.pathname.startsWith("/api/"),
		async (route) => {
			const request = route.request();
			const path = new URL(request.url()).pathname;
			let body: unknown = [];
			if (path === "/api/auth/me") body = user;
			else if (path.includes("/profile")) body = { ...user, languages: [], emergencyContacts: [] };
			else if (path.startsWith("/api/trekking-routes"))
				body = {
					items: [
						{
							id: "11111111-1111-4111-8111-111111111111",
							name: "Draft route",
							status: "active",
							description: null,
							lengthMeters: 1000,
							expectedDurationMinutes: 60,
							difficulty: "easy",
							createdAt: "2026-01-01",
							updatedAt: "2026-01-01",
							geometry: {
								type: "LineString",
								coordinates: [
									[108.22, 16.04],
									[108.25, 16.06],
								],
							},
						},
					],
					pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
				};
			else if (path === "/api/trip-drafts")
				body = [...drafts.values()].map((draft) => ({
					id: draft.id,
					title: draft.values.title,
					imageCount: draft.images.length,
					updatedAt: new Date().toISOString(),
				}));
			else if (path.startsWith("/api/trip-drafts/")) {
				const id = path.split("/")[3];
				if (request.method() === "PUT") {
					if (failSave)
						return route.fulfill({ status: 503, json: { message: "Storage unavailable" } });
					const multipart = request.postDataBuffer()?.toString("utf8") ?? "";
					const match = /name="values"\r\n\r\n([\s\S]*?)\r\n--/.exec(multipart);
					if (!match) throw new Error("Missing draft values multipart field");
					const values = JSON.parse(match[1]) as Record<string, unknown>;
					const images = multipart.includes('name="preserveImages"\r\n\r\ntrue')
						? (drafts.get(id)?.images ?? [])
						: multipart.includes('filename="first.png"')
							? [{ name: "first.png", type: "image/png", base64: png }]
							: [];
					drafts.set(id, { id, values, images });
					body = { id };
				} else
					body = path.endsWith("/thumbnail") ? (drafts.get(id)?.images[0] ?? null) : drafts.get(id);
			}
			return route.fulfill({ json: body });
		}
	);
	return drafts;
}
test("Back saves incomplete values and images to the list; Create opens a fresh form; reopening restores the draft", async ({
	page,
}) => {
	const drafts = await setup(page);
	await page.goto("/host/trips/create");
	await page.getByLabel("Tên trip").fill("Bản nháp đi trekking");
	await page.getByRole("textbox", { name: "Mô tả", exact: true }).fill("Thông tin chưa hoàn chỉnh");
	await page.locator("input[type=file]").setInputFiles({
		name: "first.png",
		mimeType: "image/png",
		buffer: Buffer.from(png, "base64"),
	});
	await page.getByRole("button", { name: "Quay về trang quản lý Host" }).click();
	await expect(page).toHaveURL(/dashboard/);
	await page.getByRole("button", { name: /^Bản nháp/ }).click();
	await expect(
		page.getByRole("heading", { name: "Bản nháp đi trekking", exact: true })
	).toBeVisible();
	expect(drafts.size).toBe(1);
	await page.getByRole("button", { name: "Tạo chuyến đi", exact: true }).first().click();
	await expect(page.getByLabel("Tên trip")).toHaveValue("");
	await expect(page.getByText("0/5", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Quay về trang quản lý Host" }).click();
	expect(drafts.size).toBe(1);
	await page.getByRole("button", { name: /^Bản nháp/ }).click();
	await page.getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true }).click();
	await expect(page.getByLabel("Tên trip")).toHaveValue("Bản nháp đi trekking");
	await expect(page.getByRole("textbox", { name: "Mô tả", exact: true })).toHaveValue(
		"Thông tin chưa hoàn chỉnh"
	);
	await expect(page.getByAltText("first.png")).toBeVisible();
	await page.getByLabel("Tên trip").fill("Bản nháp đã sửa");
	await page.getByRole("button", { name: "Quay về trang quản lý Host" }).click();
	await page.getByRole("button", { name: /^Bản nháp/ }).click();
	await expect(page.getByRole("heading", { name: "Bản nháp đã sửa", exact: true })).toBeVisible();
	expect(drafts.size).toBe(1);
});
test("Browser Back saves the form before navigating away", async ({ page }) => {
	const drafts = await setup(page);
	await page.goto("/dashboard");
	await page.getByRole("button", { name: "Tạo chuyến đi", exact: true }).first().click();
	await page.getByLabel("Tên trip").fill("Browser Back draft");
	await page.goBack();
	await expect(page).toHaveURL(/dashboard/);
	await page.getByRole("button", { name: /^Bản nháp/ }).click();
	await expect(
		page.getByRole("heading", { name: "Browser Back draft", exact: true })
	).toBeVisible();
	expect(drafts.size).toBe(1);
});
test("Server failure still saves a visible local draft when leaving", async ({ page }) => {
	await setup(page, true);
	await page.goto("/host/trips/create");
	await page.getByLabel("Tên trip").fill("Không mất dữ liệu");
	await page.getByRole("button", { name: "Quay về trang quản lý Host" }).click();
	await expect(page).toHaveURL(/dashboard/);
	await page.getByRole("button", { name: /^Bản nháp/ }).click();
	await expect(page.getByRole("heading", { name: "Không mất dữ liệu", exact: true })).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
	).toHaveAttribute("title", "Đã lưu trên thiết bị · Chờ đồng bộ");
	await page.getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true }).click();
	await expect(page.getByLabel("Tên trip")).toHaveValue("Không mất dữ liệu");
});

test("Sidebar navigation also saves the current draft", async ({ page }) => {
	const drafts = await setup(page);
	await page.goto("/host/trips/create");
	await page.getByLabel("Tên trip").fill("Sidebar draft");
	await page.getByRole("button", { name: "Tổng quan vận hành", exact: true }).click();
	await expect(page).toHaveURL(/dashboard/);
	await page.getByRole("button", { name: /^Bản nháp/ }).click();
	await expect(page.getByRole("heading", { name: "Sidebar draft", exact: true })).toBeVisible();
	expect(drafts.size).toBe(1);
});
test("Reload restores the latest text and images without creating another draft", async ({
	page,
}) => {
	const drafts = await setup(page);
	await page.goto("/host/trips/create");
	await expect(page.getByRole("button", { name: "Lưu nháp", exact: true })).toHaveCount(0);
	await page.getByLabel("Tên trip").fill("Reload draft");
	await page.locator("input[type=file]").setInputFiles({
		name: "first.png",
		mimeType: "image/png",
		buffer: Buffer.from(png, "base64"),
	});
	await expect(page.getByText("Đã tự lưu bản nháp", { exact: true })).toBeVisible();
	await page.getByRole("textbox", { name: "Mô tả", exact: true }).fill("Latest unsynced text");
	await page.reload();
	await expect(page.getByLabel("Tên trip")).toHaveValue("Reload draft");
	await expect(page.getByRole("textbox", { name: "Mô tả", exact: true })).toHaveValue(
		"Latest unsynced text"
	);
	await expect(page.getByAltText("first.png")).toBeVisible();
	await page.getByRole("button", { name: "Quay về trang quản lý Host" }).click();
	expect(drafts.size).toBe(1);
	expect([...drafts.values()][0].images).toHaveLength(1);
});

test("Offline reload and browser Back retain the local draft", async ({ page }) => {
	await setup(page, true);
	await page.goto("/dashboard");
	await page.getByRole("button", { name: "Tạo chuyến đi", exact: true }).first().click();
	await page.getByLabel("Tên trip").fill("Giữ lại khi lỗi mạng");
	await page.locator("input[type=file]").setInputFiles({
		name: "first.png",
		mimeType: "image/png",
		buffer: Buffer.from(png, "base64"),
	});
	await expect(
		page.getByText("Đã lưu trên thiết bị. Bản nháp sẽ tự đồng bộ khi có kết nối.", { exact: true })
	).toBeVisible();
	await page.reload();
	await expect(page.getByLabel("Tên trip")).toHaveValue("Giữ lại khi lỗi mạng");
	await expect(page.getByAltText("first.png")).toBeVisible();
	await page.goBack();
	await expect(page).toHaveURL(/dashboard/);
	await page.getByRole("button", { name: /^Bản nháp/ }).click();
	await expect(
		page.getByRole("heading", { name: "Giữ lại khi lỗi mạng", exact: true })
	).toBeVisible();
});

test("Only an explicitly selected route appears on the map and selecting only a route still creates a draft on Back", async ({
	page,
}) => {
	const drafts = await setup(page);
	await page.goto("/host/trips/create");
	await expect(page.getByLabel("Tuyến đã duyệt")).toHaveValue("");
	await expect(page.getByText("Điểm bắt đầu: Chưa có tuyến", { exact: true })).toBeVisible();
	await expect(page.getByText("Xem checkpoint và vùng nguy hiểm", { exact: true })).toHaveCount(0);
	await page.getByLabel("Tuyến đã duyệt").selectOption("11111111-1111-4111-8111-111111111111");
	await expect(page.getByText("Điểm bắt đầu: 108.22, 16.04", { exact: true })).toBeVisible();
	await page.getByLabel("Tuyến đã duyệt").selectOption("");
	await expect(page.getByText("Điểm bắt đầu: Chưa có tuyến", { exact: true })).toBeVisible();
	await page.getByLabel("Tuyến đã duyệt").selectOption("11111111-1111-4111-8111-111111111111");
	await page.getByRole("button", { name: "Quay về trang quản lý Host" }).click();
	await expect(page).toHaveURL(/dashboard/);
	await page.getByRole("button", { name: /^Bản nháp/ }).click();
	await expect(page.getByRole("heading", { name: "-", exact: true })).toBeVisible();
	expect(drafts.size).toBe(1);
});
