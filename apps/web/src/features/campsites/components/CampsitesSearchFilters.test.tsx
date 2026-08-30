import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CampsitesSearchFilters } from "./CampsitesSearchFilters";

describe("CampsitesSearchFilters", () => {
	const baseProps = {
		name: "",
		maxPrice: "",
		rating: "",
		onNameChange: vi.fn(),
		onMaxPriceChange: vi.fn(),
		onRatingChange: vi.fn(),
		onSubmit: vi.fn(),
		onReset: vi.fn(),
	};

	it("renders name, max price, and rating filters", () => {
		render(<CampsitesSearchFilters {...baseProps} isLoading={false} />);
		expect(screen.getByLabelText("Tên khu cắm trại")).toBeInTheDocument();
		expect(screen.getByLabelText(/khoảng giá tối đa/i)).toBeInTheDocument();
		expect(screen.getByText("Đánh giá")).toBeInTheDocument();
		expect(screen.queryByText(/trạng thái/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/tiện ích/i)).not.toBeInTheDocument();
	});

	it("loading=false: Search/Reset enabled, inputs editable", () => {
		render(<CampsitesSearchFilters {...baseProps} isLoading={false} />);
		expect(screen.getByRole("button", { name: /tìm kiếm/i })).not.toBeDisabled();
		expect(screen.getByRole("button", { name: /đặt lại/i })).not.toBeDisabled();
		expect(screen.getByLabelText("Tên khu cắm trại")).not.toBeDisabled();
	});

	it("loading=true: Search and Reset are disabled, but input fields remain editable", () => {
		render(<CampsitesSearchFilters {...baseProps} isLoading={true} />);
		expect(screen.getByRole("button", { name: /tìm kiếm/i })).toBeDisabled();
		expect(screen.getByRole("button", { name: /đặt lại/i })).toBeDisabled();
		expect(screen.getByLabelText("Tên khu cắm trại")).not.toBeDisabled();
	});

	it("submitting the form calls onSubmit exactly once", () => {
		const onSubmit = vi.fn();
		render(<CampsitesSearchFilters {...baseProps} isLoading={false} onSubmit={onSubmit} />);
		fireEvent.click(screen.getByRole("button", { name: /tìm kiếm/i }));
		expect(onSubmit).toHaveBeenCalledTimes(1);
	});

	it("clicking Reset calls onReset", () => {
		const onReset = vi.fn();
		render(<CampsitesSearchFilters {...baseProps} isLoading={false} onReset={onReset} />);
		fireEvent.click(screen.getByRole("button", { name: /đặt lại/i }));
		expect(onReset).toHaveBeenCalledTimes(1);
	});

	it("typing in name input calls onNameChange", () => {
		const onNameChange = vi.fn();
		render(<CampsitesSearchFilters {...baseProps} isLoading={false} onNameChange={onNameChange} />);
		fireEvent.change(screen.getByLabelText("Tên khu cắm trại"), { target: { value: "Đà Lạt" } });
		expect(onNameChange).toHaveBeenCalledWith("Đà Lạt");
	});

	it("clicking a rating option calls onRatingChange", () => {
		const onRatingChange = vi.fn();
		render(
			<CampsitesSearchFilters {...baseProps} isLoading={false} onRatingChange={onRatingChange} />
		);
		fireEvent.click(screen.getByRole("button", { name: /4\+/i }));
		expect(onRatingChange).toHaveBeenCalledWith("4");
	});
});
