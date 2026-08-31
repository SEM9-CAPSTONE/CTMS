import { expect, test } from "@playwright/test";

const camper = {
	id: "camper-1",
	email: "camper@example.com",
	phone: "+84912345678",
	fullName: "Nguyen Camper",
	role: "camper",
	roles: ["camper"],
	status: "active",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

const mockCampsite = {
	id: "11111111-1111-1111-1111-111111111111",
	name: "Da Lat Pine Camp E2E",
	description: "Beautiful pine forest experience",
	latitude: 11.940419,
	longitude: 108.458313,
	province: "Lâm Đồng",
	policies: { rules: "Quiet hours after 10 PM." },
	operatingHours: { opensAt: "08:00", closesAt: "22:00" },
	seasonStartDate: "2026-06-01",
	seasonEndDate: "2026-09-30",
	maxAdvanceBookingDays: 30,
	minNights: 1,
	maxNights: 7,
	status: "active",
	media: [{ id: "media-1", url: "https://example.com/e2e-photo.jpg", type: "photo", sortOrder: 0 }],
	upcomingTrips: [],
};

test.describe("Camper Campsite Details View (E2E)", () => {
	test.beforeEach(async ({ page }) => {
		// Inject auth session
		await page.addInitScript((user) => {
			localStorage.setItem("accessToken", "camper-token");
			localStorage.setItem("authUser", JSON.stringify(user));
		}, camper);

		// Mock profiles/me
		await page.route("**/api/profiles/me", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(camper),
			})
		);

		// Mock campsites search list globally for these tests
		await page.route("**/api/campsites?*", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					items: [
						{
							id: mockCampsite.id,
							name: mockCampsite.name,
							location: {
								province: mockCampsite.province,
								latitude: mockCampsite.latitude,
								longitude: mockCampsite.longitude,
							},
							coverImage: mockCampsite.media[0].url,
							activeRoutes: [],
						},
					],
					pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
				}),
			})
		);
	});

	test("navigates from search results to campsite details successfully", async ({ page }) => {
		// Mock campsites detail endpoint
		await page.route(`**/api/campsites/${mockCampsite.id}`, (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(mockCampsite),
			})
		);

		// Go to search page
		await page.goto("/campsites");

		// Wait for search indicator to disappear
		await expect(page.getByText(/đang tìm kiếm khu cắm trại/i)).not.toBeVisible();

		// Check search list has the card
		const card = page.locator(`#campsite-card-${mockCampsite.id}`);
		await expect(card).toBeVisible();

		// Click the campsite card to navigate to details
		await card.click();

		// Verify url changed to details path
		await expect(page).toHaveURL(new RegExp(`/campsites/${mockCampsite.id}$`));

		// Verify campsite details rendered correctly
		await expect(page.getByText(mockCampsite.name)).toBeVisible();
		await expect(page.getByText(mockCampsite.description)).toBeVisible();
		await expect(page.getByText(mockCampsite.province).first()).toBeVisible();
		await expect(page.getByText(mockCampsite.policies.rules)).toBeVisible();
		await expect(page.getByText("08:00 - 22:00")).toBeVisible();
		await expect(page.getByText("2026-06-01 đến 2026-09-30")).toBeVisible();
		await expect(page.getByText("1 đêm")).toBeVisible();
		await expect(page.getByText("7 đêm")).toBeVisible();
		await expect(page.getByText("30 ngày")).toBeVisible();

		// Verify static reviews & upcoming trips placeholders are visible
		await expect(page.getByText("Đánh giá từ Camper")).toBeVisible();
		await expect(page.getByText("Chưa có đánh giá nào")).toBeVisible();
		await expect(page.getByText("Chuyến đi sắp tới")).toBeVisible();
		await expect(page.getByText("Không có chuyến đi nào sắp diễn ra")).toBeVisible();

		// Verify zones & route details are absent
		await expect(page.getByText("Zone capacity")).not.toBeVisible();
		await expect(page.getByText("campsite slots")).not.toBeVisible();
		await expect(page.getByText("Route detail")).not.toBeVisible();

		// Test click back button
		await page.locator("#btn-back").click();
		await expect(page).toHaveURL(/\/campsites$/);
	});

	test("shows 404 error page if campsite is not active or not found", async ({ page }) => {
		// Mock campsites detail endpoint to return 404
		await page.route(`**/api/campsites/${mockCampsite.id}`, (route) =>
			route.fulfill({
				status: 404,
				contentType: "application/json",
				body: JSON.stringify({ message: "Campsite not found" }),
			})
		);

		await page.goto(`/campsites/${mockCampsite.id}`);

		// Check mapped error string is visible
		await expect(
			page.getByText("Không tìm thấy khu cắm trại hoặc khu cắm trại không hoạt động.")
		).toBeVisible();

		// Click back button inside error page
		await page.locator("#btn-error-back").click();
		await expect(page).toHaveURL(/\/campsites$/);
	});
});
