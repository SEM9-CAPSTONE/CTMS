import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBookingList } from "../hooks/useBookingList";
import type { BookingListItem } from "../types";
import { BookingListPage } from "./BookingListPage";

vi.mock("../hooks/useBookingList", () => ({ useBookingList: vi.fn() }));

describe("BookingListPage", () => {
	beforeEach(() => vi.clearAllMocks());

	it("announces loading with exactly one h1", () => {
		vi.mocked(useBookingList).mockReturnValue({
			bookings: [],
			isLoading: true,
			error: null,
			retry: vi.fn(),
		});
		render(<BookingListPage onViewDetails={() => {}} />);
		expect(screen.getByRole("status")).toHaveTextContent("Đang tải danh sách đơn đặt chỗ");
		expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
	});

	it("renders an alert and retries a retryable failure", () => {
		const retry = vi.fn();
		vi.mocked(useBookingList).mockReturnValue({
			bookings: [],
			isLoading: false,
			error: { kind: "retryable", message: "Mất kết nối", canRetry: true },
			retry,
		});
		render(<BookingListPage onViewDetails={() => {}} />);
		expect(screen.getByRole("alert")).toHaveTextContent("Mất kết nối");
		fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
		expect(retry).toHaveBeenCalledTimes(1);
	});

	it("does not offer retry for an authorization failure", () => {
		vi.mocked(useBookingList).mockReturnValue({
			bookings: [],
			isLoading: false,
			error: { kind: "forbidden", message: "Không có quyền", canRetry: false },
			retry: vi.fn(),
		});
		render(<BookingListPage onViewDetails={() => {}} />);
		expect(screen.getByRole("alert")).toBeVisible();
		expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument();
	});

	it("renders the loaded list", () => {
		vi.mocked(useBookingList).mockReturnValue({
			bookings: [{ id: "booking-1", tripPresentation: null }] as BookingListItem[],
			isLoading: false,
			error: null,
			retry: vi.fn(),
		});
		render(<BookingListPage onViewDetails={() => {}} />);
		expect(screen.getByText("Mã: booking-1")).toBeVisible();
	});
});
