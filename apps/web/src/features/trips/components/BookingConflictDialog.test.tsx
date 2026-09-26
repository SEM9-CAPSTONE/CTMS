import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookingConflictDialog } from "./BookingConflictDialog";

describe("BookingConflictDialog", () => {
	it("renders nothing when open is false", () => {
		const { container } = render(
			<BookingConflictDialog open={false} onClose={vi.fn()} onReload={vi.fn()} />
		);

		expect(container.firstChild).toBeNull();
	});

	it("renders dialog with message and triggers onReload and onClose", () => {
		const onClose = vi.fn();
		const onReload = vi.fn();
		const onRetry = vi.fn();

		render(
			<BookingConflictDialog
				open={true}
				message="Chuyến đi chỉ còn 1 chỗ trống nhưng bạn yêu cầu 2 chỗ."
				requestedSeats={2}
				onClose={onClose}
				onReload={onReload}
				onRetry={onRetry}
			/>
		);

		expect(screen.getByTestId("booking-conflict-dialog")).toBeInTheDocument();
		expect(
			screen.getByText("Chuyến đi chỉ còn 1 chỗ trống nhưng bạn yêu cầu 2 chỗ.")
		).toBeInTheDocument();
		expect(screen.getByText(/Bạn đã yêu cầu 2 chỗ/)).toBeInTheDocument();

		// Reload button
		fireEvent.click(screen.getByRole("button", { name: /tải lại dữ liệu/i }));
		expect(onReload).toHaveBeenCalledTimes(1);

		// Retry button
		fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
		expect(onRetry).toHaveBeenCalledTimes(1);

		// Close button
		fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
		expect(onClose).toHaveBeenCalledTimes(1);

		// X button
		fireEvent.click(screen.getByRole("button", { name: "Đóng thông báo xung đột" }));
		expect(onClose).toHaveBeenCalledTimes(2);
	});

	it("renders loading state when isReloading is true", () => {
		render(
			<BookingConflictDialog open={true} isReloading={true} onClose={vi.fn()} onReload={vi.fn()} />
		);

		const reloadBtn = screen.getByRole("button", { name: /đang tải lại/i });
		expect(reloadBtn).toBeDisabled();
	});
});
