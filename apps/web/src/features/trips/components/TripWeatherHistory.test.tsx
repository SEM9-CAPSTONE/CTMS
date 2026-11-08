import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import type { TripWeatherForecast } from "../types";
import { TripWeatherHistory } from "./TripWeatherHistory";

const TRIP_ID = "2cbcbd1e-0020-42b5-9565-74a68f34a7a2";

function entry(overrides: Partial<TripWeatherForecast>): TripWeatherForecast {
	return {
		id: "f-1",
		tripId: TRIP_ID,
		status: "available",
		tripStartsAt: "2030-01-17T00:00:00.000Z",
		tripEndsAt: "2030-01-18T00:00:00.000Z",
		forecastFrom: null,
		forecastTo: null,
		coversWholeTrip: true,
		worstReading: null,
		riskLevel: "green",
		compositeScore: 0.4,
		criteriaScores: null,
		advice: null,
		horizonDays: 15,
		createdAt: "2030-01-05T03:00:00.000Z",
		checkedAt: "2030-01-05T03:00:00.000Z",
		...overrides,
	};
}

function renderHistory(fetchHistory: (tripId: string) => Promise<TripWeatherForecast[]>) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
	return render(<TripWeatherHistory tripId={TRIP_ID} fetchHistory={fetchHistory} />, { wrapper });
}

function open() {
	const details = screen.getByTestId("trip-weather-history") as HTMLDetailsElement;
	details.open = true;
	fireEvent(details, new Event("toggle"));
}

afterEach(cleanup);

it("loads the history only when opened and lists each change newest first", async () => {
	const fetchHistory = vi.fn().mockResolvedValue([
		entry({
			id: "f-2",
			riskLevel: "red",
			compositeScore: 2.6,
			createdAt: "2030-01-06T03:00:00.000Z",
			checkedAt: "2030-01-07T09:00:00.000Z",
		}),
		entry({ id: "f-1" }),
		entry({ id: "f-0", status: "out_of_range", riskLevel: null, compositeScore: null }),
	]);
	renderHistory(fetchHistory);
	expect(fetchHistory).not.toHaveBeenCalled();
	open();
	const rows = await screen.findAllByTestId("trip-weather-history-entry");
	expect(fetchHistory).toHaveBeenCalledWith(TRIP_ID);
	expect(rows).toHaveLength(3);
	expect(rows[0]).toHaveTextContent("Nguy hiểm (Đỏ)");
	expect(rows[0]).toHaveTextContent("Điểm 2.6");
	expect(rows[0]).toHaveTextContent("Kiểm tra lần cuối");
	expect(rows[1]).toHaveTextContent("An toàn (Xanh)");
	expect(rows[1]).not.toHaveTextContent("Kiểm tra lần cuối");
	expect(rows[2]).toHaveTextContent("Chưa có dự báo");
});

it("shows the empty state", async () => {
	renderHistory(vi.fn().mockResolvedValue([]));
	open();
	expect(await screen.findByText("Chưa có lịch sử dự báo.")).toBeVisible();
});

it("offers retry when the history fails to load", async () => {
	const fetchHistory = vi
		.fn()
		.mockRejectedValueOnce(new Error("offline"))
		.mockResolvedValue([entry({ id: "f-1" })]);
	renderHistory(fetchHistory);
	open();
	fireEvent.click(await screen.findByRole("button", { name: /Không tải được lịch sử dự báo/ }));
	expect(await screen.findAllByTestId("trip-weather-history-entry")).toHaveLength(1);
});
