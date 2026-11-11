import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { type APIRequestContext, type Page, expect, test } from "@playwright/test";
import type {
	LocalIncidentRecord,
	ReportIncidentPayload,
} from "../../src/features/trip-incidents/types";

const API = "http://127.0.0.1:3002/api";
const API_ROOT = resolve(process.cwd(), "../../services/api");
const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlS8AAAAASUVORK5CYII=",
	"base64"
);
interface Fixture {
	tripId: string;
	publishedTripId: string;
	title: string;
	porterEmail: string;
	hostEmail: string;
	outsiderEmail: string;
	password: string;
}
interface StoredIncident {
	id: string;
	description: string;
	occurredAt: string;
	capturedOffline: boolean;
	mediaUrl: string | null;
	locationStatus: string;
}
interface QueueSnapshot {
	id: string;
	payload: ReportIncidentPayload;
	syncState: string;
	photoSize: number;
}

function fixtureCommand<T>(action: string, fixture?: Fixture): T {
	return JSON.parse(
		execFileSync(
			process.execPath,
			[
				"node_modules/ts-node/dist/bin.js",
				"--transpile-only",
				"test/e2e/incident-fixture.ts",
				action,
				Buffer.from(JSON.stringify(fixture ?? {})).toString("base64"),
			],
			{ cwd: API_ROOT, timeout: 30_000 }
		).toString()
	) as T;
}

async function queue(page: Page): Promise<QueueSnapshot[]> {
	return page.evaluate(
		() =>
			new Promise<QueueSnapshot[]>((resolveQueue, reject) => {
				const open = indexedDB.open("ctms-offline");
				open.onerror = () => reject(open.error);
				open.onsuccess = () => {
					const database = open.result;
					const request = database
						.transaction("trip-incidents", "readonly")
						.objectStore("trip-incidents")
						.getAll();
					request.onsuccess = () => {
						resolveQueue(
							(request.result as LocalIncidentRecord[]).map((item) => ({
								id: item.id,
								payload: item.payload,
								syncState: item.syncState,
								photoSize: item.photo?.size ?? 0,
							}))
						);
						database.close();
					};
					request.onerror = () => {
						database.close();
						reject(request.error);
					};
				};
			})
	);
}

async function login(page: Page, fixture: Fixture, email = fixture.porterEmail): Promise<void> {
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(email);
	await page.locator('input[type="password"]').fill(fixture.password);
	await page.locator('form button[type="submit"]').click();
	await expect.poll(() => page.evaluate(() => localStorage.getItem("accessToken"))).toBeTruthy();
}

async function openIncidents(page: Page, tripId: string): Promise<void> {
	await page.goto(`/porter/assignments/${tripId}`);
	await page.getByRole("tab", { name: "Sự cố", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Sự cố đã báo cáo" })).toBeVisible();
}

async function fillReport(page: Page, description: string): Promise<void> {
	await page.getByRole("button", { name: "Báo cáo sự cố", exact: true }).click();
	await page.getByRole("combobox", { name: "Loại sự cố", exact: true }).selectOption("injury");
	await page.getByRole("combobox", { name: "Mức độ", exact: true }).selectOption("high");
	await page.getByLabel("Mô tả", { exact: true }).fill(description);
	await expect(page.getByText(/Đang lấy vị trí/)).toBeHidden();
}

async function bearer(page: Page): Promise<Record<string, string>> {
	return {
		Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("accessToken"))}`,
	};
}
async function signIn(
	request: APIRequestContext,
	email: string,
	password: string
): Promise<Record<string, string>> {
	const response = await request.post(`${API}/auth/login`, {
		data: { identifier: email, password },
	});
	expect(response.status()).toBe(200);
	const result = (await response.json()) as { accessToken: string };
	return { Authorization: `Bearer ${result.accessToken}` };
}

test.describe("CTMS-49 report incident (real API + database)", () => {
	let fixture: Fixture | undefined;
	test.beforeEach(async ({ page }) => {
		fixture = fixtureCommand<Fixture>("seed");
		await login(page, fixture);
		await openIncidents(page, fixture.tripId);
	});
	test.afterEach(() => {
		if (fixture) fixtureCommand("clean", fixture);
		fixture = undefined;
	});
	const current = () => {
		if (!fixture) throw new Error("Missing fixture");
		return fixture;
	};
	const stored = () => fixtureCommand<StoredIncident[]>("read", current());

	test("offline photo survives reload and navigation, then syncs once with Host visibility", async ({
		page,
		context,
		request,
	}) => {
		const description = "Offline injury at stream crossing";
		await fillReport(page, description);
		await page
			.getByLabel("Ảnh (không bắt buộc)")
			.setInputFiles({ name: "incident.png", mimeType: "image/png", buffer: PNG });
		await context.setOffline(true);
		await page.getByRole("button", { name: "Lưu trên thiết bị", exact: true }).click();
		await expect(page.getByText("Chờ đồng bộ", { exact: true })).toBeVisible();
		await expect(page.getByText("Đã đồng bộ", { exact: true })).toHaveCount(0);
		const [original] = await queue(page);
		expect(original.photoSize).toBe(PNG.length);
		expect(original.payload.capturedOffline).toBe(true);
		expect(stored()).toHaveLength(0);
		// Restore assets but continue dropping actual API connections during reload.
		await page.route("**/api/**", (route) => route.abort("internetdisconnected"));
		await context.setOffline(false);
		await page.reload();
		await expect.poll(async () => (await queue(page))[0]?.id).toBe(original.id);
		const [restored] = await queue(page);
		expect(restored.payload).toEqual(original.payload);
		expect(restored.photoSize).toBe(PNG.length);
		expect(stored()).toHaveLength(0);
		// Stay away from the Trip: the application outbox must synchronize too.
		await page.goto("/porter/assignments");
		await page.unroute("**/api/**");
		await page.reload();
		await expect.poll(stored, { timeout: 45_000 }).toHaveLength(1);
		await expect.poll(() => stored()[0]?.mediaUrl, { timeout: 45_000 }).toBeTruthy();
		const [authoritative] = stored();
		expect(authoritative).toMatchObject({
			id: original.id,
			description,
			occurredAt: original.payload.occurredAt,
			capturedOffline: true,
		});
		const replay = await request.post(`${API}/trips/${current().tripId}/incidents`, {
			headers: await bearer(page),
			data: original.payload,
		});
		expect(replay.status()).toBe(200);
		expect((await replay.json()).outcome).toBe("duplicate");
		expect(stored()).toHaveLength(1);
		const host = await signIn(request, current().hostEmail, current().password);
		const hostList = await request.get(`${API}/trips/${current().tripId}/incidents`, {
			headers: host,
		});
		expect(hostList.status()).toBe(200);
		expect((await hostList.json()).items).toHaveLength(1);
		await openIncidents(page, current().tripId);
		await expect(page.getByText("Đã đồng bộ", { exact: true })).toBeVisible();
		await expect(
			page.getByRole("list", { name: "Danh sách sự cố" }).getByRole("listitem")
		).toHaveCount(1);
	});

	test("lost response after server commit retries the same UUID without duplicate", async ({
		page,
	}) => {
		let first = true;
		const ids: string[] = [];
		await page.route(`**/trips/${current().tripId}/incidents`, async (route) => {
			if (route.request().method() !== "POST") return route.continue();
			ids.push((route.request().postDataJSON() as ReportIncidentPayload).id);
			if (!first) return route.continue();
			first = false;
			const response = await route.fetch();
			expect(response.status()).toBe(200);
			await route.abort("connectionreset");
		});
		await fillReport(page, "Lost acknowledgement");
		await page.getByRole("button", { name: "Gửi báo cáo", exact: true }).click();
		await expect(page.getByText("Chờ đồng bộ", { exact: true })).toBeVisible();
		expect(stored()).toHaveLength(1);
		await expect(page.getByText("Đã đồng bộ", { exact: true })).toBeVisible({ timeout: 45_000 });
		expect(ids.length).toBeGreaterThanOrEqual(2);
		expect(new Set(ids).size).toBe(1);
		expect(stored()).toHaveLength(1);
	});

	test("real business rejection shows failed state and allows local discard", async ({ page }) => {
		await fillReport(page, "Outside trip window");
		await page.getByLabel("Thời điểm xảy ra").fill("2020-01-01T08:30");
		await page.getByRole("button", { name: "Gửi báo cáo", exact: true }).click();
		await expect(page.getByText("Đồng bộ thất bại", { exact: true })).toBeVisible();
		await expect(page.getByRole("alert")).toContainText("Thời điểm sự cố nằm ngoài");
		expect(stored()).toHaveLength(0);
		await page.getByRole("button", { name: "Xóa khỏi thiết bị" }).click();
		await expect(page.getByText("Chưa có sự cố nào được báo cáo.")).toBeVisible();
		expect(await queue(page)).toHaveLength(0);
	});

	test("invalid photo fails separately while the incident remains synced", async ({ page }) => {
		await fillReport(page, "Parent survives invalid media");
		await page.getByLabel("Ảnh (không bắt buộc)").setInputFiles({
			name: "fake.png",
			mimeType: "image/png",
			buffer: Buffer.from("not an image"),
		});
		await page.getByRole("button", { name: "Gửi báo cáo", exact: true }).click();
		await expect(page.getByText("Đã đồng bộ", { exact: true })).toBeVisible();
		await expect(page.getByText("Tải ảnh thất bại", { exact: true })).toBeVisible();
		expect(stored()).toHaveLength(1);
		expect(stored()[0].mediaUrl).toBeNull();
		await page.getByRole("button", { name: "Bỏ ảnh", exact: true }).click();
		await expect(page.getByText("Tải ảnh thất bại", { exact: true })).toHaveCount(0);
		expect(stored()).toHaveLength(1);
	});

	test("GPS denial records unavailable location without fabricated coordinates", async ({
		page,
		context,
	}) => {
		await context.clearPermissions();
		await fillReport(page, "GPS permission denied");
		await expect(page.getByText(/Không lấy được vị trí/)).toBeVisible();
		await page.getByRole("button", { name: "Gửi báo cáo", exact: true }).click();
		await expect(page.getByText("Đã đồng bộ", { exact: true })).toBeVisible();
		expect(stored()[0].locationStatus).toBe("unavailable");
	});

	test("unassigned Porter cannot access the form or submit an incident", async ({
		page,
		request,
	}) => {
		await page.evaluate(() => localStorage.clear());
		await login(page, current(), current().outsiderEmail);
		await page.goto(`/porter/assignments/${current().tripId}`);
		await expect(page.getByRole("alert")).toContainText("Phân công không còn hợp lệ");
		await expect(page.getByRole("button", { name: "Báo cáo sự cố", exact: true })).toHaveCount(0);
		const denied = await request.post(`${API}/trips/${current().tripId}/incidents`, {
			headers: await bearer(page),
			data: {
				id: crypto.randomUUID(),
				category: "injury",
				severity: "low",
				description: "Forbidden",
				occurredAt: new Date().toISOString(),
				location: null,
			},
		});
		expect(denied.status()).toBe(403);
		expect(stored()).toHaveLength(0);
	});

	test("assigned Porter cannot create a new report before the Trip starts", async ({ page }) => {
		await openIncidents(page, current().publishedTripId);
		await expect(
			page.getByText("Chỉ có thể báo cáo sự cố mới khi chuyến đi đang diễn ra.")
		).toBeVisible();
		await expect(page.getByRole("button", { name: "Báo cáo sự cố", exact: true })).toHaveCount(0);
		expect(stored()).toHaveLength(0);
	});
});
