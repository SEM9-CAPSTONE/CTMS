import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PackingListModal } from "./PackingListModal";

vi.mock("./PackingListPanel", () => ({
	PackingListPanel: ({ bookingId }: { bookingId: string }) => (
		<div data-testid="packing-list-panel-mock">{bookingId}</div>
	),
}));

describe("PackingListModal", () => {
	it("renders hidden container when isOpen is false", () => {
		render(<PackingListModal isOpen={false} onClose={vi.fn()} bookingId="booking-123" />);

		const dialog = screen.getByRole("dialog", { hidden: true });
		expect(dialog).toHaveClass("hidden");
	});

	it("renders modal dialog when isOpen is true", () => {
		render(<PackingListModal isOpen={true} onClose={vi.fn()} bookingId="booking-123" />);

		const dialog = screen.getByRole("dialog");
		expect(dialog).toBeVisible();
		expect(dialog).not.toHaveClass("hidden");
		expect(screen.getByText("Danh sách đồ cần chuẩn bị")).toBeVisible();
		expect(screen.getByTestId("packing-list-panel-mock")).toHaveTextContent("booking-123");
	});

	it("calls onClose when close button is clicked", () => {
		const onClose = vi.fn();
		render(<PackingListModal isOpen={true} onClose={onClose} bookingId="booking-123" />);

		fireEvent.click(screen.getByRole("button", { name: "Đóng pop-up" }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("calls onClose when footer close button is clicked", () => {
		const onClose = vi.fn();
		render(<PackingListModal isOpen={true} onClose={onClose} bookingId="booking-123" />);

		fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("closes on Escape key press", () => {
		const onClose = vi.fn();
		render(<PackingListModal isOpen={true} onClose={onClose} bookingId="booking-123" />);

		fireEvent.keyDown(window, { key: "Escape" });
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
