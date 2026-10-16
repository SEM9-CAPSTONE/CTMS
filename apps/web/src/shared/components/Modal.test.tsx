import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal", () => {
	it("renders nothing when closed", () => {
		render(
			<Modal isOpen={false} onClose={vi.fn()} title="Thêm thiết bị">
				<p>Body</p>
			</Modal>
		);

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("renders an accessible dialog labelled by its title", () => {
		render(
			<Modal isOpen onClose={vi.fn()} title="Thêm thiết bị" description="Mô tả">
				<p>Body</p>
			</Modal>
		);

		const dialog = screen.getByRole("dialog", { name: "Thêm thiết bị" });
		expect(dialog).toHaveAttribute("aria-modal", "true");
		expect(screen.getByText("Body")).toBeInTheDocument();
		expect(screen.getByText("Mô tả")).toBeInTheDocument();
	});

	it("closes from the X button and the Escape key", () => {
		const onClose = vi.fn();
		render(
			<Modal isOpen onClose={onClose} title="Thêm thiết bị" closeLabel="Đóng thêm">
				<p>Body</p>
			</Modal>
		);

		fireEvent.click(screen.getByRole("button", { name: "Đóng thêm" }));
		fireEvent.keyDown(window, { key: "Escape" });

		expect(onClose).toHaveBeenCalledTimes(2);
	});

	it("cannot be closed while closing is disabled", () => {
		const onClose = vi.fn();
		render(
			<Modal isOpen onClose={onClose} title="Thêm thiết bị" isCloseDisabled>
				<p>Body</p>
			</Modal>
		);

		fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
		fireEvent.keyDown(window, { key: "Escape" });

		expect(onClose).not.toHaveBeenCalled();
	});
});
