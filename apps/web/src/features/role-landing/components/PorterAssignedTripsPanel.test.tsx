import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tripsService } from "../../trips/services/trips.service";
import type { PorterAssignedTrip } from "../../trips/types";
import { PorterAssignedTripsPanel, PorterAssignedTripsPanelView } from "./PorterAssignedTripsPanel";

const trips: PorterAssignedTrip[] = [
	{
		tripId: "trip-upcoming",
		title: "Trekking Bạch Mã",
		status: "published",
		startsAt: "2026-10-19T23:00:00Z",
		endsAt: "2026-10-20T10:00:00Z",
		routeName: "Vườn quốc gia Bạch Mã",
	},
	{
		tripId: "trip-ongoing",
		title: "Khám phá Sơn Trà",
		status: "ongoing",
		startsAt: "2026-10-16T00:00:00Z",
		endsAt: "2026-10-17T09:00:00Z",
		routeName: "Bán đảo Sơn Trà",
	},
	{
		tripId: "trip-finished",
		title: "Chinh phục Hải Vân",
		status: "completed",
		startsAt: "2026-10-12T01:00:00Z",
		endsAt: "2026-10-14T10:00:00Z",
		routeName: "Đèo Hải Vân",
	},
	{
		tripId: "trip-cancelled",
		title: "Chuyến đã hủy",
		status: "cancelled",
		startsAt: "2026-10-12T01:00:00Z",
		endsAt: "2026-10-12T10:00:00Z",
		routeName: null,
	},
];

const baseState = {
	trips,
	isLoading: false,
	error: null,
	refetch: vi.fn().mockResolvedValue(null),
};

function rowTitles() {
	return screen.queryAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
}

describe("PorterAssignedTripsPanel", () => {
	beforeEach(() => localStorage.setItem("authUser", JSON.stringify({ id: "porter" })));
	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it("renders loading and empty states", () => {
		const { rerender } = render(
			<PorterAssignedTripsPanelView {...baseState} trips={[]} isLoading />
		);
		expect(screen.getByText("Đang tải chuyến đi được phân công...")).toBeInTheDocument();
		rerender(<PorterAssignedTripsPanelView {...baseState} trips={[]} />);
		expect(screen.getByText("Chưa có chuyến đi nào được phân công.")).toBeInTheDocument();
	});

	it("shows only the three porter statuses with same-day and multi-day schedules", () => {
		render(<PorterAssignedTripsPanelView {...baseState} />);
		expect(rowTitles()).toEqual(["Trekking Bạch Mã", "Khám phá Sơn Trà", "Chinh phục Hải Vân"]);
		expect(screen.queryByText("Chuyến đã hủy")).not.toBeInTheDocument();

		const sameDay = screen.getByText("Trekking Bạch Mã").closest("li") as HTMLElement;
		expect(within(sameDay).getByText("20/10/2026")).toBeInTheDocument();
		expect(within(sameDay).getByText("06:00 – 17:00")).toBeInTheDocument();
		expect(within(sameDay).getByText("Sắp diễn ra")).toBeInTheDocument();

		const multiDay = screen.getByText("Khám phá Sơn Trà").closest("li") as HTMLElement;
		expect(within(multiDay).getByText("16/10 – 17/10/2026")).toBeInTheDocument();
		expect(within(multiDay).getByText("07:00 – 16:00")).toBeInTheDocument();
		expect(within(multiDay).getByText("Đang diễn ra")).toBeInTheDocument();

		const finished = screen.getByText("Chinh phục Hải Vân").closest("li") as HTMLElement;
		expect(within(finished).getByText("Đã kết thúc")).toBeInTheDocument();
	});

	it("shows the status stored in the database without deriving it from the clock", () => {
		render(
			<PorterAssignedTripsPanelView
				{...baseState}
				trips={[
					{
						...trips[0],
						tripId: "past",
						title: "Chưa được chuyển trạng thái",
						startsAt: "2020-01-01T01:00:00Z",
						endsAt: "2020-01-01T10:00:00Z",
					},
				]}
			/>
		);
		const row = screen.getByText("Chưa được chuyển trạng thái").closest("li") as HTMLElement;
		expect(within(row).getByText("Sắp diễn ra")).toBeInTheDocument();
	});

	it("filters by status, searches without diacritics and resets both criteria", () => {
		render(<PorterAssignedTripsPanelView {...baseState} />);
		fireEvent.click(screen.getByRole("tab", { name: "Đang diễn ra" }));
		expect(rowTitles()).toEqual(["Khám phá Sơn Trà"]);

		fireEvent.click(screen.getByRole("tab", { name: "Tất cả" }));
		fireEvent.change(screen.getByLabelText("Tìm kiếm chuyến đi"), {
			target: { value: "hai van" },
		});
		expect(rowTitles()).toEqual(["Chinh phục Hải Vân"]);

		fireEvent.click(screen.getByRole("tab", { name: "Sắp diễn ra" }));
		expect(screen.getByText("Không tìm thấy chuyến đi phù hợp.")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /Đặt lại/ }));
		expect(screen.getByLabelText("Tìm kiếm chuyến đi")).toHaveValue("");
		expect(screen.getByRole("tab", { name: "Tất cả" })).toHaveAttribute("aria-selected", "true");
		expect(rowTitles()).toHaveLength(3);
	});

	it("opens the selected trip detail", () => {
		const onViewTripDetail = vi.fn();
		render(<PorterAssignedTripsPanelView {...baseState} onViewTripDetail={onViewTripDetail} />);
		fireEvent.click(screen.getByRole("button", { name: "Chi tiết Khám phá Sơn Trà" }));
		expect(onViewTripDetail).toHaveBeenCalledWith("trip-ongoing");
	});

	it("uses assigned trips as the check-in selection workflow", () => {
		const onViewTripDetail = vi.fn();
		const onOpenRoster = vi.fn();
		render(
			<PorterAssignedTripsPanelView
				{...baseState}
				mode="checkins"
				onViewTripDetail={onViewTripDetail}
				onOpenRoster={onOpenRoster}
			/>
		);

		expect(
			screen.getByRole("heading", { name: "Chọn chuyến đi để điểm danh" })
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Mở điểm danh Khám phá Sơn Trà" }));
		expect(onOpenRoster).toHaveBeenCalledWith("trip-ongoing");
		expect(onViewTripDetail).not.toHaveBeenCalled();
	});

	it("shows an error with retry and refreshes from the header", () => {
		const refetch = vi.fn().mockResolvedValue(null);
		const { rerender } = render(
			<PorterAssignedTripsPanelView {...baseState} error="Không thể tải" refetch={refetch} />
		);
		fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
		rerender(<PorterAssignedTripsPanelView {...baseState} refetch={refetch} />);
		fireEvent.click(screen.getByRole("button", { name: "Tải lại danh sách" }));
		expect(refetch).toHaveBeenCalledTimes(2);
	});

	it("loads assigned trips from the service", async () => {
		vi.spyOn(tripsService, "getAssignedTrips").mockResolvedValue([
			{ ...trips[0], startsAt: "2099-10-19T23:00:00Z", endsAt: "2099-10-20T10:00:00Z" },
		]);
		const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
		render(
			<QueryClientProvider client={client}>
				<PorterAssignedTripsPanel />
			</QueryClientProvider>
		);
		expect(await screen.findByText("Trekking Bạch Mã")).toBeInTheDocument();
		expect(screen.getByText("Vườn quốc gia Bạch Mã")).toBeInTheDocument();
	});
});
