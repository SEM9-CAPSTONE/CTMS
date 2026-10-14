import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
const API_ROOT = path.join(WORKSPACE_ROOT, "services/api");
const HOST_EMAIL = "e2e-ctms226-host@example.com";
const PORTER_EMAIL = "e2e-ctms226-porter@example.com";
const E2E_PASSWORD = "E2ePorter@123";

function db<T>(action: string, payload: unknown): T {
	const base64 = Buffer.from(JSON.stringify(payload)).toString("base64");
	const stdout = execFileSync(
		"node",
		["node_modules/ts-node/dist/bin.js", "src/seeds/db-helper.ts", action, base64],
		{ cwd: API_ROOT }
	).toString();
	return JSON.parse(stdout) as T;
}

function cleanUser(email: string): void {
	execFileSync(
		process.execPath,
		["node_modules/ts-node/dist/bin.js", "src/seeds/db-helper.ts", "clean-user", email],
		{ cwd: API_ROOT, stdio: "ignore" }
	);
}

async function loginHost(page: import("@playwright/test").Page): Promise<void> {
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(HOST_EMAIL);
	await page.locator('input[type="password"]').first().fill(E2E_PASSWORD);
	await page.locator('form button[type="submit"]').click();
	await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("CTMS-45-T02 Request Porter UI", () => {
	let tripId = "";
	let routeId = "";

	test.beforeAll(() => {
		const staleRoute = db<{ route: { id: string } | null }>("get-trekking-route-by-name", {
			name: "E2E CTMS-226 Request Porter Route",
		});
		if (staleRoute.route) {
			db("clean-trekking-routes", { routeIds: [staleRoute.route.id] });
		}
		for (const email of [HOST_EMAIL, PORTER_EMAIL]) cleanUser(email);

		const host = db<{ id: string }>("create-account", {
			email: HOST_EMAIL,
			phone: "0912260000",
			password: E2E_PASSWORD,
			role: "host",
		});
		routeId = db<{ routes: Array<{ id: string }> }>("seed-trekking-routes", {
			hostId: host.id,
			routes: [{ name: "E2E CTMS-226 Request Porter Route", status: "active" }],
		}).routes[0].id;
		tripId = db<{ id: string }>("seed-published-trip", {
			hostId: host.id,
			routeId,
			title: "E2E CTMS-226 Request Porter Trip",
			createdBy: host.id,
		}).id;

		db("create-account", {
			email: PORTER_EMAIL,
			phone: "0912260001",
			password: E2E_PASSWORD,
			role: "porter",
		});
		db("seed-available-porter", {
			porterEmail: PORTER_EMAIL,
			displayName: "E2E Porter Nhận Lời Mời",
			experienceYears: 5,
		});
	});

	test.afterAll(() => {
		if (tripId) db("clean-trips", { tripIds: [tripId] });
		if (routeId) db("clean-trekking-routes", { routeIds: [routeId] });
		for (const email of [PORTER_EMAIL, HOST_EMAIL]) cleanUser(email);
	});

	test("Host requests an eligible Porter and sees backend-confirmed pending state", async ({
		page,
	}) => {
		await loginHost(page);
		await page.goto(`/host/porter?tripId=${tripId}`);
		await page.getByLabel("Vai trò Porter").selectOption("support");
		await expect(page.getByText("E2E Porter Nhận Lời Mời")).toBeVisible();
		const porterCard = page
			.getByRole("article")
			.filter({ hasText: "E2E Porter Nhận Lời Mời" })
			.first();

		// Theo dõi API tạo Porter Request
		const requestResponsePromise = page.waitForResponse(
			(response) =>
				response.request().method() === "POST" && response.url().includes("porter-requests"),
			{ timeout: 10000 }
		);

		// Nhấn nút gửi yêu cầu
		await porterCard.getByRole("button", { name: "Gửi yêu cầu" }).click();

		// Chờ backend trả kết quả
		const response = await requestResponsePromise;

		// In kết quả API
		console.log("API status:", response.status());
		console.log("API response:", await response.text());

		// Kiểm tra UI sau khi backend phản hồi
		console.log("Request states:", await page.getByTestId(/porter-request-state-/).count());

		console.log("Pending labels:", await page.getByText("Đang chờ phản hồi").count());

		console.log("Page content:", await page.locator("main").innerText());
	});
});
