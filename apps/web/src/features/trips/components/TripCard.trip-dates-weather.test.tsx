import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TripSummary } from "../types";
import { TripCard } from "./TripCard";

const trip: TripSummary = {
	id: "trip-1",
	title: "Khám Phá Bán Đảo Sơn Trà",
	description: null,
	coverImageUrl: null,
	tripType: "day_trip",
	durationNights: 0,
	startsAt: "2026-11-11T00:00:00.000Z",
	endsAt: "2026-11-11T09:00:00.000Z",
	meetingPoint: { type: "Point", coordinates: [108.25, 16.1] },
	meetingAt: null,
	bookingDeadline: "2026-11-10T00:00:00.000Z",
	capacityMin: 2,
	capacityMax: 12,
	seatsTaken: 0,
	remainingSeats: 12,
	pricePerPerson: 0,
	status: "published",
	difficulty: "easy",
	weatherRiskLevel: "green",
	isBookable: true,
	createdAt: "2026-11-01T00:00:00.000Z",
	updatedAt: "2026-11-01T00:00:00.000Z",
};

afterEach(cleanup);

describe("TripCard weather badge for the Trip's own dates", () => {
	it.each([
		["available", "green", "Ngày đi: Thời tiết an toàn"],
		["available", "red", "Ngày đi: Cảnh báo rủi ro cao"],
		["out_of_range", null, "Chưa có dự báo ngày đi (còn xa)"],
		["unavailable", null, "Chưa có dự báo ngày đi"],
	] as const)("status %s / risk %s shows “%s”", (status, risk, label) => {
		render(
			<TripCard
				trip={{ ...trip, weatherForecastStatus: status, weatherRiskLevel: risk }}
				onSelect={vi.fn()}
			/>
		);
		expect(screen.getByTestId("trip-card-weather")).toHaveTextContent(label);
	});

	it("keeps the previous label when the API does not report a forecast status", () => {
		render(<TripCard trip={trip} onSelect={vi.fn()} />);
		expect(screen.getByTestId("trip-card-weather")).toHaveTextContent("Thời tiết an toàn");
	});
});
