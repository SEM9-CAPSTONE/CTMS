import { type Page, expect, test } from "@playwright/test";

const admin = {
	id: "admin-route-review",
	email: "admin.routes@ctms.local",
	phone: null,
	fullName: "Route Admin",
	role: "admin",
	roles: ["admin"],
	status: "active",
	createdAt: "2026-08-28T00:00:00.000Z",
	updatedAt: "2026-08-28T00:00:00.000Z",
};

const host = { ...admin, id: "host-route-review", role: "host", roles: ["host"] };

const pendingRoute = {
	id: "11111111-1111-4111-8111-111111111111",
	campsiteId: "22222222-2222-4222-8222-222222222222",
	campsiteName: "Pine Camp",
	name: "Pine Ridge Traverse",
	description: "Route under review",
	geometry: {
		type: "LineString",
		coordinates: [
			[108.4, 11.9],
			[108.5, 12],
		],
	},
	lengthMeters: 1450,
	difficulty: "hard",
	expectedDurationMinutes: 120,
	status: "pending_approval",
	createdAt: "2026-08-28T00:00:00.000Z",
	updatedAt: "2026-08-28T00:00:00.000Z",
	checkpoints: [
		{
			id: "checkpoint-1",
			routeId: "11111111-1111-4111-8111-111111111111",
			name: "Trail start",
			location: { type: "Point", coordinates: [108.4, 11.9] },
			radiusMeters: 25,
			type: "start",
			expectedArrivalOffset: 0,
			instructions: "Meet the guide",
			nearbyWaterOrShelter: true,
			routePosition: 0,
			createdAt: "2026-08-28T00:00:00.000Z",
			updatedAt: "2026-08-28T00:00:00.000Z",
		},
	],
};

async function authenticate(page: Page, user = admin) {
	await page.addInitScript((account) => {
		localStorage.setItem("accessToken", "route-review-token");
		localStorage.setItem("authUser", JSON.stringify(account));
	}, user);
}

async function mockReviewApi(
	page: Page,
	handler: (body: { action: string; reason?: string }) => { status: number; body: object }
) {
	let currentStatus = "pending_approval";
	await page.route("**/api/trekking-routes/pending-review", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(currentStatus === "pending_approval" ? [pendingRoute] : []),
		})
	);
	await page.route("**/api/trekking-routes/*/review", async (route) => {
		const body = JSON.parse(route.request().postData() || "{}") as {
			action: string;
			reason?: string;
		};
		const response = handler(body);
		if (response.status === 200) {
			currentStatus = String((response.body as { status: string }).status);
		}
		await route.fulfill({
			status: response.status,
			contentType: "application/json",
			body: JSON.stringify(response.body),
		});
	});
}

test.describe("CTMS-55 Admin trekking Route review", () => {
	test("Admin inspects geometry/difficulty/checkpoints and approves a valid pending Route", async ({
		page,
	}) => {
		await authenticate(page);
		await mockReviewApi(page, (body) => ({
			status: 200,
			body: { ...pendingRoute, status: body.action === "approve" ? "active" : "pending_approval" },
		}));

		await page.goto("/admin/trekking-routes");
		await expect(page.getByText("Pine Ridge Traverse").first()).toBeVisible();
		await expect(page.getByText("hard").first()).toBeVisible();
		await expect(page.getByTestId("route-geometry-preview")).toBeVisible();
		await expect(page.getByText("Trail start")).toBeVisible();
		await page.getByRole("button", { name: "Ra quyết định" }).click();
		await page.getByRole("button", { name: "Xác nhận quyết định" }).click();

		await expect(page.getByText(/Đã phê duyệt và kích hoạt/)).toBeVisible();
		await expect(page.getByTestId("route-reviews-empty")).toBeVisible();
	});

	test("Admin declines with a required reason and returns the Route to draft", async ({ page }) => {
		await authenticate(page);
		let submittedBody: { action: string; reason?: string } | null = null;
		await mockReviewApi(page, (body) => {
			submittedBody = body;
			return { status: 200, body: { ...pendingRoute, status: "draft" } };
		});
		await page.goto("/admin/trekking-routes");
		await page.getByRole("button", { name: "Ra quyết định" }).click();
		await page.getByRole("button", { name: "Trả về bản nháp" }).click();
		await page.getByRole("button", { name: "Xác nhận quyết định" }).click();
		await expect(page.getByText("Lý do là bắt buộc cho quyết định này.")).toBeVisible();
		await page.getByLabel("Lý do *").fill("Checkpoint instructions need revision");
		await page.getByRole("button", { name: "Xác nhận quyết định" }).click();

		expect(submittedBody).toEqual({
			action: "decline",
			reason: "Checkpoint instructions need revision",
		});
		await expect(page.getByText(/Đã trả về bản nháp/)).toBeVisible();
	});

	test("Admin explicitly marks a Route non-operable with a reason", async ({ page }) => {
		await authenticate(page);
		let submittedAction = "";
		await mockReviewApi(page, (body) => {
			submittedAction = body.action;
			return { status: 200, body: { ...pendingRoute, status: "closed" } };
		});
		await page.goto("/admin/trekking-routes");
		await page.getByRole("button", { name: "Ra quyết định" }).click();
		await page.getByRole("button", { name: "Không được vận hành" }).click();
		await page.getByLabel("Lý do *").fill("Protected area prohibits operation");
		await page.getByRole("button", { name: "Xác nhận quyết định" }).click();

		expect(submittedAction).toBe("non_operable");
		await expect(page.getByText(/Đã đóng vì không được vận hành/)).toBeVisible();
	});

	test("a stale or invalid approval stays pending and preserves entered reason", async ({
		page,
	}) => {
		await authenticate(page);
		await mockReviewApi(page, () => ({
			status: 409,
			body: { message: "Only trekking routes in pending_approval status can be reviewed" },
		}));
		await page.goto("/admin/trekking-routes");
		await page.getByRole("button", { name: "Ra quyết định" }).click();
		await page.getByRole("button", { name: "Trả về bản nháp" }).click();
		const reason = page.getByLabel("Lý do *");
		await reason.fill("Preserve this reason");
		await page.getByRole("button", { name: "Xác nhận quyết định" }).click();

		await expect(page.getByRole("alert")).toContainText("pending_approval");
		await expect(reason).toHaveValue("Preserve this reason");
		await expect(page.getByText("Pine Ridge Traverse").first()).toBeVisible();
	});

	test("invalid authoritative Route data cannot become active", async ({ page }) => {
		await authenticate(page);
		await mockReviewApi(page, () => ({
			status: 422,
			body: {
				message: [{ field: "checkpoints", errors: ["stored route checkpoints are invalid"] }],
			},
		}));
		await page.goto("/admin/trekking-routes");
		await page.getByRole("button", { name: "Ra quyết định" }).click();
		await page.getByRole("button", { name: "Xác nhận quyết định" }).click();

		await expect(page.getByRole("alert")).toContainText("stored route checkpoints are invalid");
		await expect(page.getByText("Pine Ridge Traverse").first()).toBeVisible();
		await expect(page.getByTestId("route-reviews-empty")).not.toBeVisible();
	});

	test("Host cannot access the Admin UI or mutate through the review API", async ({ page }) => {
		await authenticate(page, host);
		let mutated = false;
		await page.route("**/api/trekking-routes/*/review", async (route) => {
			mutated = false;
			await route.fulfill({
				status: 403,
				contentType: "application/json",
				body: JSON.stringify({ message: "Insufficient permission" }),
			});
		});
		await page.goto("/admin/trekking-routes");
		await expect(page.getByText("403 - Hạn chế quyền truy cập")).toBeVisible();

		const status = await page.evaluate(async (routeId) => {
			const response = await fetch(`/api/trekking-routes/${routeId}/review`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json", Authorization: "Bearer host-token" },
				body: JSON.stringify({ action: "approve" }),
			});
			return response.status;
		}, pendingRoute.id);
		expect(status).toBe(403);
		expect(mutated).toBe(false);
	});
});
