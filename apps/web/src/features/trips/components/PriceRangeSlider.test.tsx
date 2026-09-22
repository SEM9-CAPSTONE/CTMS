import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PriceRangeSlider, formatPriceVND } from "./PriceRangeSlider";

describe("PriceRangeSlider", () => {
	it("renders price bounds and current values in VND", () => {
		const onChange = vi.fn();
		render(
			<PriceRangeSlider
				min={0}
				max={10_000_000}
				step={100_000}
				minValue={500_000}
				maxValue={3_000_000}
				onChange={onChange}
			/>
		);

		// Label
		expect(screen.getByText("Khoảng giá (VNĐ)")).toBeInTheDocument();

		// Current value badges
		expect(screen.getByText("500.000 VNĐ")).toBeInTheDocument();
		expect(screen.getByText("3.000.000 VNĐ")).toBeInTheDocument();

		// Sliders
		const minSlider = screen.getByLabelText("Giá tối thiểu");
		const maxSlider = screen.getByLabelText("Giá tối đa");

		expect(minSlider).toHaveValue("500000");
		expect(maxSlider).toHaveValue("3000000");
	});

	it("calls onChange when dragging the min thumb", () => {
		const onChange = vi.fn();
		render(
			<PriceRangeSlider
				min={0}
				max={10_000_000}
				step={100_000}
				minValue={0}
				maxValue={5_000_000}
				onChange={onChange}
			/>
		);

		const minSlider = screen.getByLabelText("Giá tối thiểu");
		fireEvent.change(minSlider, { target: { value: "1200000" } });

		expect(onChange).toHaveBeenCalledWith(1_200_000, 5_000_000);
	});

	it("calls onChange when dragging the max thumb", () => {
		const onChange = vi.fn();
		render(
			<PriceRangeSlider
				min={0}
				max={10_000_000}
				step={100_000}
				minValue={1_000_000}
				maxValue={8_000_000}
				onChange={onChange}
			/>
		);

		const maxSlider = screen.getByLabelText("Giá tối đa");
		fireEvent.change(maxSlider, { target: { value: "6500000" } });

		expect(onChange).toHaveBeenCalledWith(1_000_000, 6_500_000);
	});

	it("renders active track properly without crashing", () => {
		render(
			<PriceRangeSlider
				min={0}
				max={10_000_000}
				step={100_000}
				minValue={1_000_000}
				maxValue={2_000_000}
				onChange={vi.fn()}
			/>
		);

		const track = screen.getByTestId("price-slider-active-track");
		expect(track).toBeInTheDocument();
		expect(track).toHaveStyle({ left: "10%", width: "10%" });
	});

	it("formatPriceVND correctly formats numbers to Vietnamese currency string", () => {
		expect(formatPriceVND(1000000)).toBe("1.000.000 VNĐ");
		expect(formatPriceVND(0)).toBe("0 VNĐ");
	});
});
