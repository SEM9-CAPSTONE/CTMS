import { type Page, expect, test } from "@playwright/test";

const mockPerformanceReport = {
	timeWindow: {
		from: "2026-10-01T00:00:00.000Z",
		to: "2026-10-31T23:59:59.999Z",
		preset: "30d",
	},
	scope: { role: "admin" },
	bookings: {
		total: 48,
		confirmed: 28,
		completed: 15,
		cancelled: 4,
		pending: 1,
	},
	trips: {
		total: 10,
		completed: 6,
		ongoing: 1,
		published: 3,
		cancelled: 0,
	},
	fillRate: 82.5,
	cancellationRate: 8.3,
	revenue: {
		estimated: {
			amount: 145000000,
			label: "Estimated",
			isEstimated: true,
		},
		actual: {
			amount: 118000000,
			label: "Actual",
			isEstimated: false,
			ledgerSource: "settlements",
		},
	},
	timeSeries: [
		{
			date: "2026-10-10",
			bookingCount: 8,
			tripCount: 2,
			fillRate: 75.0,
			cancellationRate: 0.0,
			estimatedRevenue: 24000000,
			actualRevenue: 20000000,
		},
		{
			date: "2026-10-20",
			bookingCount: 12,
			tripCount: 3,
			fillRate: 85.0,
			cancellationRate: 8.3,
			estimatedRevenue: 36000000,
			actualRevenue: 32000000,
		},
	],
	breakdown: [
		{
			id: "trip-e2e-1",
			title: "Trekking Tà Năng - Phan Dũng 3N2Đ",
			routeName: "Cung Tà Năng - Phan Dũng",
			status: "published",
			bookingCount: 16,
			seatsTaken: 20,
			capacity: 20,
			fillRate: 100.0,
			cancellationRate: 6.25,
			estimatedRevenue: 40000000,
			actualRevenue: 38000000,
		},
	],
};

async function setupAdmin(page: Page) {
	const user = {
		id: "admin-e2e",
		role: "admin",
		roles: ["admin"],
		status: "active",
		email: "admin@ctms.test",
		fullName: "Quản trị viên",
	};

	await page.addInitScript((u) => {
		localStorage.setItem("authUser", JSON.stringify(u));
		localStorage.setItem("accessToken", "mock-admin-token");
	}, user);

	await page.route("**/api/profiles/me", (route) => {
		route.fulfill({ json: user });
	});

	await page.route("**/api/reports/performance*", (route) => {
		route.fulfill({ json: mockPerformanceReport });
	});
}

test.describe("CTMS-101: View Booking and Trip Performance Reports", () => {
	test("Admin views platform-wide performance metrics, charts, and breakdown", async ({ page }) => {
		await setupAdmin(page);

		await page.goto("/admin/reports/performance");

		// Header & scope badge
		await expect(page.getByText("Báo cáo hiệu suất hoạt động")).toBeVisible();
		await expect(page.getByText("Toàn bộ hệ thống (Admin)")).toBeVisible();

		// Metrics Cards (PB AC-3, AC-4, AC-5, AC-6)
		await expect(page.getByText("Đơn đặt chỗ")).toBeVisible();
		await expect(page.getByText("48", { exact: true })).toBeVisible();

		await expect(page.getByText("Chuyến đi")).toBeVisible();
		await expect(page.getByText("10", { exact: true })).toBeVisible();

		await expect(page.getByText("Tỷ lệ lấp đầy")).toBeVisible();
		await expect(page.getByText("82.5%")).toBeVisible();

		await expect(page.getByText("Tỷ lệ hủy")).toBeVisible();
		await expect(page.getByText("8.3%")).toBeVisible();

		// Actual Revenue (PB AC-8)
		await expect(page.getByText("Doanh thu thực tế")).toBeVisible();
		await expect(page.getByText("Đã quyết toán")).toBeVisible();

		// Estimated Revenue with mandatory "Ước tính" label (PB AC-7)
		await expect(page.getByText("Doanh thu dự kiến")).toBeVisible();
		await expect(page.getByText("Ước tính", { exact: true })).toBeVisible();

		// Quick filter pills (PB AC-1)
		await expect(page.getByText("7 ngày qua")).toBeVisible();
		await expect(page.getByText("30 ngày qua")).toBeVisible();
		await expect(page.getByText("Tháng này")).toBeVisible();

		// Breakdown Table (PB AC-2)
		await expect(page.getByText("Trekking Tà Năng - Phan Dũng 3N2Đ")).toBeVisible();
		await expect(page.getByText("Cung Tà Năng - Phan Dũng")).toBeVisible();
		await expect(page.getByText("100%")).toBeVisible();
	});

	test("Host views scoped performance report", async ({ page }) => {
		const hostUser = {
			id: "host-e2e",
			role: "host",
			roles: ["host"],
			status: "active",
			email: "host@ctms.test",
			fullName: "Đối tác Host",
		};

		await page.addInitScript((u) => {
			localStorage.setItem("authUser", JSON.stringify(u));
			localStorage.setItem("accessToken", "mock-host-token");
		}, hostUser);

		await page.route("**/api/profiles/me", (route) => {
			route.fulfill({ json: hostUser });
		});

		await page.route("**/api/reports/performance*", (route) => {
			route.fulfill({
				json: {
					...mockPerformanceReport,
					scope: { role: "host", hostId: hostUser.id },
				},
			});
		});

		await page.goto("/host/reports/performance");

		await expect(page.getByText("Báo cáo hiệu suất hoạt động")).toBeVisible();
		await expect(page.getByText("Phạm vi chuyến của bạn (Host)")).toBeVisible();
	});
});
