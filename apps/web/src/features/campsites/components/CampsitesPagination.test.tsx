import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CampsitesPagination } from "./CampsitesPagination";

describe("CampsitesPagination", () => {
	it("shows the total count", () => {
		render(
			<CampsitesPagination
				pagination={{ page: 1, limit: 20, total: 37, totalPages: 2 }}
				disabled={false}
				onPageChange={vi.fn()}
			/>
		);
		expect(screen.getByText("37")).toBeInTheDocument();
	});

	it("disables both buttons when disabled=true even mid-range (BR-241)", () => {
		render(
			<CampsitesPagination
				pagination={{ page: 2, limit: 20, total: 100, totalPages: 5 }}
				disabled={true}
				onPageChange={vi.fn()}
			/>
		);
		expect(screen.getByLabelText("Trang trước")).toBeDisabled();
		expect(screen.getByLabelText("Trang sau")).toBeDisabled();
	});

	it("enables both buttons mid-range when disabled=false", () => {
		render(
			<CampsitesPagination
				pagination={{ page: 2, limit: 20, total: 100, totalPages: 5 }}
				disabled={false}
				onPageChange={vi.fn()}
			/>
		);
		expect(screen.getByLabelText("Trang trước")).not.toBeDisabled();
		expect(screen.getByLabelText("Trang sau")).not.toBeDisabled();
	});

	it("disables prev on page 1 and next on the last page regardless of `disabled`", () => {
		render(
			<CampsitesPagination
				pagination={{ page: 1, limit: 20, total: 5, totalPages: 1 }}
				disabled={false}
				onPageChange={vi.fn()}
			/>
		);
		expect(screen.getByLabelText("Trang trước")).toBeDisabled();
		expect(screen.getByLabelText("Trang sau")).toBeDisabled();
	});

	it("calls onPageChange with page-1/page+1", () => {
		const onPageChange = vi.fn();
		render(
			<CampsitesPagination
				pagination={{ page: 2, limit: 20, total: 100, totalPages: 5 }}
				disabled={false}
				onPageChange={onPageChange}
			/>
		);
		fireEvent.click(screen.getByLabelText("Trang sau"));
		expect(onPageChange).toHaveBeenCalledWith(3);
		fireEvent.click(screen.getByLabelText("Trang trước"));
		expect(onPageChange).toHaveBeenCalledWith(1);
	});

	it("shows page X / totalPages, with totalPages floored at 1 when there are zero results", () => {
		render(
			<CampsitesPagination
				pagination={{ page: 1, limit: 20, total: 0, totalPages: 0 }}
				disabled={false}
				onPageChange={vi.fn()}
			/>
		);
		expect(screen.getByText(/trang 1 \/ 1/i)).toBeInTheDocument();
	});
});
