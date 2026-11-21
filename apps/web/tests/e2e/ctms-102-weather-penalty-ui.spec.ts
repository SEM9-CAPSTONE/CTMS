import { type Page, expect, test } from "@playwright/test";

/**
 * CTMS-102: UI of the Host weather penalty (CTMS-94 API, policy §6).
 * A Host sees the penalty on the wallet and asks for a waiver with a PDF; an Admin approves it.
 * The backend is mocked; the realtime refresh is covered by the Vitest suite.
 */

const PENALTY_ID = "5c1d2e3f-102a-4c2e-9d10-0f5f4b1e1021";
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type Role = "host" | "admin";

async function signIn(page: Page, role: Role) {
	const user = {
		id: `${role}-102`,
		role,
		roles: [role],
		status: "active",
		email: `${role}102@example.test`,
		fullName: `${role} 102`,
		createdAt: "2026-01-01",
	};
	// These UI tests mock the backend, so the authenticated realtime channel is mocked too.
	await page.routeWebSocket(/\/socket\.io\//, () => {});
	await page.addInitScript((user) => {
		localStorage.setItem("authUser", JSON.stringify(user));
		localStorage.setItem("accessToken", "test-token");
	}, user);
	await page.route("https://**/*", (route) => route.abort());
	await page.route(
		(url) => url.pathname.startsWith("/api/"),
		(route) => {
			const path = new URL(route.request().url()).pathname;
			if (path.endsWith("/auth/me")) return route.fulfill({ json: user });
			if (path.includes("/profile") && !path.endsWith("/bank-accounts")) {
				return route.fulfill({ json: { ...user, emergencyContacts: [], languages: [] } });
			}
			if (path.endsWith("/me/weather-notices") || path.endsWith("/me/weather-decision-alerts")) {
				return route.fulfill({ json: { items: [], unreadCount: 0 } });
			}
			return route.fulfill({ json: [] });
		}
	);
	return user;
}

function penalty(overrides: Record<string, unknown> = {}) {
	const startsAt = new Date(Date.now() - 10 * HOUR);
	return {
		id: PENALTY_ID,
		tripId: "trip-102",
		tripTitle: "Tà Năng – Phan Dũng",
		tripStartsAt: startsAt.toISOString(),
		hostId: "host-102",
		hostName: "Nguyễn Văn Host",
		violationNumber: 2,
		bookingValue: "10000000.00",
		ratePercent: 10,
		capAmount: "5000000.00",
		amount: "1000000.00",
		deductedAmount: "570000.00",
		outstandingAmount: "430000.00",
		status: "applied",
		hostingBlockedUntil: new Date(Date.now() + 14 * DAY).toISOString(),
		waiverDeadline: new Date(startsAt.getTime() + 48 * HOUR).toISOString(),
		waiver: {
			reason: null,
			evidenceUrls: [],
			requestedAt: null,
			reviewDueAt: null,
			decision: null,
			reviewedAt: null,
			reviewNote: null,
		},
		createdAt: new Date(Date.now() - 12 * HOUR).toISOString(),
		...overrides,
	};
}

test("Host sees the penalty on the wallet and asks for a waiver with a PDF", async ({
	page,
}, testInfo) => {
	await signIn(page, "host");
	await page.route("**/api/settlements/host/wallet", (route) =>
		route.fulfill({
			json: {
				id: "w-102",
				hostId: "host-102",
				balance: "0.00",
				pendingPayout: null,
				transactions: [
					{
						id: "t-2",
						type: "penalty_debit",
						baseAmount: "0.00",
						feeAmount: "0.00",
						netAmount: "-570000.00",
						balanceAfter: "0.00",
						description: "Trừ phạt thời tiết: Tà Năng – Phan Dũng",
						createdAt: new Date().toISOString(),
					},
					{
						id: "t-1",
						type: "settlement_credit",
						baseAmount: "600000.00",
						feeAmount: "30000.00",
						netAmount: "570000.00",
						balanceAfter: "570000.00",
						description: "Quyết toán doanh thu chuyến đi: Bidoup",
						createdAt: new Date(Date.now() - 60_000).toISOString(),
					},
				],
			},
		})
	);
	let requested = false;
	await page.route("**/api/me/weather-penalties", (route) =>
		route.fulfill({
			json: {
				items: [
					requested
						? penalty({
								waiver: {
									...penalty().waiver,
									reason: "Nhập viện cấp cứu",
									evidenceUrls: ["https://cdn.example/giay-vien.pdf"],
									requestedAt: new Date().toISOString(),
									reviewDueAt: new Date(Date.now() + 7 * DAY).toISOString(),
								},
							})
						: penalty(),
				],
				outstandingTotal: "430000.00",
				hostingBlockedUntil: penalty().hostingBlockedUntil,
				suspended: false,
			},
		})
	);
	await page.route("**/api/uploads/document**", (route) =>
		route.fulfill({ status: 201, json: { url: "https://cdn.example/giay-vien.pdf" } })
	);
	let body: unknown = null;
	await page.route(`**/api/host/weather-penalties/${PENALTY_ID}/waiver-request`, (route) => {
		body = route.request().postDataJSON();
		requested = true;
		return route.fulfill({ json: penalty() });
	});

	await page.goto("/host/wallet");
	const card = page.getByTestId("host-weather-penalties-card");
	await expect(card).toContainText("Vi phạm lần 2");
	await expect(page.getByTestId("weather-penalty-hosting-block")).toContainText(
		"Bạn đang bị khoá tạo Trip mới"
	);
	await expect(page.getByText("Trừ phạt thời tiết", { exact: true })).toBeVisible();
	await card.screenshot({ path: testInfo.outputPath("host-weather-penalties.png") });

	await card.getByRole("button", { name: "Xin miễn phạt" }).click();
	const modal = page.getByTestId("weather-penalty-waiver-modal");
	await modal.getByLabel("Lý do (bắt buộc)").fill("Nhập viện cấp cứu");
	await modal.getByTestId("weather-penalty-evidence-input").setInputFiles({
		name: "giay-vien.pdf",
		mimeType: "application/pdf",
		buffer: Buffer.from("%PDF-1.4\n%test"),
	});
	await expect(modal.getByText("giay-vien.pdf")).toBeVisible();
	await modal.screenshot({ path: testInfo.outputPath("host-weather-penalty-waiver.png") });
	await modal.getByRole("button", { name: "Gửi yêu cầu miễn phạt" }).click();
	await page.getByTestId("confirm-modal").getByRole("button", { name: "Xác nhận" }).click();
	await expect(modal).toHaveCount(0);
	await expect(card).toContainText("Chờ duyệt miễn");
	expect(body).toEqual({
		reason: "Nhập viện cấp cứu",
		evidenceUrls: ["https://cdn.example/giay-vien.pdf"],
	});
});

test("Admin approves a waiver request from the penalty list", async ({ page }, testInfo) => {
	await signIn(page, "admin");
	const requestedWaiver = {
		...penalty().waiver,
		reason: "Host nhập viện cấp cứu từ tối hôm trước",
		evidenceUrls: ["https://cdn.example/weather-penalty-waivers/giay-vien.pdf"],
		requestedAt: new Date(Date.now() - 2 * HOUR).toISOString(),
		reviewDueAt: new Date(Date.now() + 7 * DAY).toISOString(),
	};
	let reviewed: unknown = null;
	await page.route("**/api/admin/weather-penalties**", (route) => {
		const url = new URL(route.request().url());
		if (url.pathname.endsWith("/waiver-review")) {
			reviewed = route.request().postDataJSON();
			return route.fulfill({
				json: penalty({
					status: "waived",
					deductedAmount: "0.00",
					outstandingAmount: "0.00",
					hostingBlockedUntil: null,
					waiver: {
						...requestedWaiver,
						decision: "approved",
						reviewedAt: new Date().toISOString(),
						reviewNote: "Giấy viện hợp lệ",
					},
				}),
			});
		}
		const filter = url.searchParams.get("status");
		return route.fulfill({
			json: filter === "waiver_pending" ? [penalty({ waiver: requestedWaiver })] : [],
		});
	});

	await page.goto("/admin/weather?tab=penalties");
	const row = page.getByTestId("weather-penalty-row");
	await expect(row).toContainText("Chờ duyệt miễn");
	await expect(row).toContainText("Nguyễn Văn Host");
	await page.screenshot({ path: testInfo.outputPath("admin-weather-penalties.png") });

	await row.click();
	const dialog = page.getByTestId("admin-weather-penalty-dialog");
	await expect(dialog.getByRole("link", { name: "giay-vien.pdf" })).toBeVisible();
	await dialog.getByLabel("Lý do của bạn (bắt buộc)").fill("Giấy viện hợp lệ");
	await page.screenshot({ path: testInfo.outputPath("admin-weather-penalty-review.png") });
	await dialog.getByRole("button", { name: "Duyệt miễn phạt" }).click();
	await page.getByTestId("confirm-modal").getByRole("button", { name: "Xác nhận" }).click();
	await expect(dialog.getByText(/Đã duyệt miễn/)).toBeVisible();
	expect(reviewed).toEqual({ approve: true, note: "Giấy viện hợp lệ" });
});
