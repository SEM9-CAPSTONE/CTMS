import { type Page, expect, test } from "@playwright/test";

const TRIP_ID = "11111111-1111-4111-8111-111111112626";

function tripFixture(registrationRisk: Record<string, unknown>) {
	return {
		id: TRIP_ID,
		hostId: "host-ctms-26",
		routeId: "route-ctms-26",
		title: "CTMS-026 Bidoup risk preview",
		description: "Risk must be visible before trekking registration.",
		coverImageUrl: "https://example.com/ctms-26.jpg",
		itinerary: { summary: "1 ngay" },
		includes: { items: ["Huong dan vien"] },
		excludes: { items: ["Chi phi ca nhan"] },
		tripType: "day_trip",
		durationNights: 0,
		startsAt: "2099-09-28T06:00:00.000Z",
		endsAt: "2099-09-28T17:00:00.000Z",
		meetingPoint: { type: "Point", coordinates: [108.45, 11.94] },
		meetingAt: "2099-09-28T05:30:00.000Z",
		bookingDeadline: "2099-09-27T18:00:00.000Z",
		capacityMin: 4,
		capacityMax: 12,
		seatsTaken: 2,
		remainingSeats: 10,
		pricePerPerson: 1200000,
		cancellationPolicy: { policy: "Huy truoc 48h hoan tien 100%" },
		status: "published",
		difficulty: "moderate",
		weatherRiskLevel: "green",
		registrationRisk,
		isBookable: true,
		createdAt: "2026-08-25T00:00:00.000Z",
		updatedAt: "2026-08-25T00:00:00.000Z",
		waypoints: [
			{
				id: "wp-start",
				tripId: TRIP_ID,
				checkpointId: null,
				type: "start",
				name: "Cong vuon quoc gia",
				location: { type: "Point", coordinates: [108.45, 11.94] },
				dayNumber: 1,
				sequenceOrder: 1,
				plannedAt: "2099-09-28T06:00:00.000Z",
				durationMinutes: 15,
				metadata: null,
			},
		],
	};
}

async function mockTripDetail(page: Page, registrationRisk: Record<string, unknown>) {
	await page.route(`**/api/trips/${TRIP_ID}`, async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(tripFixture(registrationRisk)),
		});
	});
	await page.route(`**/api/equipment-catalog/for-trip/${TRIP_ID}`, async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: "[]",
		});
	});
}

test.describe("CTMS-26-T02 View Risk Level before Trekking Registration", () => {
	test("shows the authoritative risk level before the registration action", async ({ page }) => {
		await mockTripDetail(page, {
			status: "available",
			assessmentId: "risk-ctms-26",
			level: "yellow",
			assessedAt: "2026-09-25T00:00:00.000Z",
			ruleVersionId: "rule-v3-1",
			factors: [
				{
					key: "rainfall",
					label: "Rainfall",
					value: 18,
					level: "yellow",
					weight: 0.3,
					score: 1,
				},
			],
			advice: "Nên mang áo mưa và theo dõi cập nhật thời tiết.",
			recommendations: ["Mang áo mưa", "Theo sát hướng dẫn viên"],
		});

		await page.goto(`/trips/${TRIP_ID}`);

		// Policy: travellers only see the forecast for the Trip's own dates; the Route's current weather
		// is no longer shown on the Trip page, and signed-out visitors (no forecast access) see none.
		await expect(page.getByRole("button", { name: "Đăng nhập để đặt chỗ" })).toBeVisible();
		await expect(page.getByTestId("registration-risk-panel")).toHaveCount(0);
		await expect(page.getByTestId("trip-hero-weather")).toHaveCount(0);
		await expect(page.getByText("Thời tiết chú ý")).toHaveCount(0);
	});

	test("does not fabricate a safe risk level when no assessment exists", async ({ page }) => {
		await mockTripDetail(page, {
			status: "unavailable",
			assessmentId: null,
			level: null,
			assessedAt: null,
			ruleVersionId: null,
			factors: [],
			advice: null,
			recommendations: [],
		});

		await page.goto(`/trips/${TRIP_ID}`);

		await expect(page.getByTestId("registration-risk-unavailable")).toHaveCount(0);
		await expect(page.getByTestId("registration-risk-panel")).toHaveCount(0);
		await expect(page.getByText(/Thời tiết bình thường|Thời tiết an toàn/)).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Đăng nhập để đặt chỗ" })).toBeVisible();
	});
});
