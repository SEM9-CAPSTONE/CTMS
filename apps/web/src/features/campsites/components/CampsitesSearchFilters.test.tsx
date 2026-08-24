import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CampsitesSearchFilters } from "./CampsitesSearchFilters";

describe("CampsitesSearchFilters", () => {
	const baseProps = {
		province: "",
		amenities: "",
		minPrice: "",
		maxPrice: "",
		onProvinceChange: vi.fn(),
		onAmenitiesChange: vi.fn(),
		onMinPriceChange: vi.fn(),
		onMaxPriceChange: vi.fn(),
		onSubmit: vi.fn(),
		onReset: vi.fn(),
	};

	it("renders exactly the DB-backed contract filters -- no city/status/date/guests/type", () => {
		render(<CampsitesSearchFilters {...baseProps} isLoading={false} />);
		expect(screen.getByLabelText("Tỉnh/Thành")).toBeInTheDocument();
		expect(screen.queryByLabelText("Thành phố")).not.toBeInTheDocument();
		expect(screen.getByLabelText("Tiện ích")).toBeInTheDocument();
		expect(screen.getByLabelText("Giá từ")).toBeInTheDocument();
		expect(screen.getByLabelText("Giá đến")).toBeInTheDocument();
		expect(screen.queryByText(/trạng thái/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/ngày đi/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/số người/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/loại hình/i)).not.toBeInTheDocument();
	});

	it("loading=false: Search/Reset enabled, inputs editable", () => {
		render(<CampsitesSearchFilters {...baseProps} isLoading={false} />);
		expect(screen.getByRole("button", { name: /tìm kiếm/i })).not.toBeDisabled();
		expect(screen.getByRole("button", { name: /đặt lại/i })).not.toBeDisabled();
		expect(screen.getByLabelText("Tỉnh/Thành")).not.toBeDisabled();
	});

	it("loading=true: Search and Reset are disabled, but every input field remains editable", () => {
		render(<CampsitesSearchFilters {...baseProps} isLoading={true} />);
		expect(screen.getByRole("button", { name: /tìm kiếm/i })).toBeDisabled();
		expect(screen.getByRole("button", { name: /đặt lại/i })).toBeDisabled();
		expect(screen.getByLabelText("Tỉnh/Thành")).not.toBeDisabled();
		expect(screen.getByLabelText("Tiện ích")).not.toBeDisabled();
		expect(screen.getByLabelText("Giá từ")).not.toBeDisabled();
		expect(screen.getByLabelText("Giá đến")).not.toBeDisabled();
	});

	it("submitting the form calls onSubmit exactly once, not native navigation", () => {
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

	it("typing in each input calls its own onChange with the raw value", () => {
		const props = {
			...baseProps,
			onProvinceChange: vi.fn(),
			onAmenitiesChange: vi.fn(),
			onMinPriceChange: vi.fn(),
			onMaxPriceChange: vi.fn(),
		};
		render(<CampsitesSearchFilters {...props} isLoading={false} />);

		fireEvent.change(screen.getByLabelText("Tỉnh/Thành"), { target: { value: "Lam Dong" } });
		expect(props.onProvinceChange).toHaveBeenCalledWith("Lam Dong");

		fireEvent.change(screen.getByLabelText("Tiện ích"), { target: { value: "wifi" } });
		expect(props.onAmenitiesChange).toHaveBeenCalledWith("wifi");

		fireEvent.change(screen.getByLabelText("Giá từ"), { target: { value: "100" } });
		expect(props.onMinPriceChange).toHaveBeenCalledWith("100");

		fireEvent.change(screen.getByLabelText("Giá đến"), { target: { value: "500" } });
		expect(props.onMaxPriceChange).toHaveBeenCalledWith("500");
	});
});
