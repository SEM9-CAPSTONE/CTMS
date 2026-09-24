import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TripFilterBar } from "./TripFilterBar";

describe("TripFilterBar", () => {
	it("renders keyword search and calls onFilterChange on submit", () => {
		const onFilterChange = vi.fn();
		const onReset = vi.fn();

		render(<TripFilterBar currentFilters={{}} onFilterChange={onFilterChange} onReset={onReset} />);

		const searchInput = screen.getByLabelText("Tìm kiếm chuyến đi");
		fireEvent.change(searchInput, { target: { value: "Sơn Trà" } });

		fireEvent.click(screen.getByRole("button", { name: /tìm kiếm/i }));

		expect(onFilterChange).toHaveBeenCalledWith(
			expect.objectContaining({
				search: "Sơn Trà",
			})
		);
	});

	it("opens advanced filters and filters by difficulty and tripType", () => {
		const onFilterChange = vi.fn();
		const onReset = vi.fn();

		render(<TripFilterBar currentFilters={{}} onFilterChange={onFilterChange} onReset={onReset} />);

		fireEvent.click(screen.getByRole("button", { name: /bộ lọc nâng cao/i }));

		const tripTypeSelect = screen.getByLabelText("Loại chuyến đi");
		fireEvent.change(tripTypeSelect, { target: { value: "overnight" } });

		const difficultySelect = screen.getByLabelText("Độ khó");
		fireEvent.change(difficultySelect, { target: { value: "hard" } });

		fireEvent.click(screen.getByRole("button", { name: /tìm kiếm/i }));

		expect(onFilterChange).toHaveBeenCalledWith(
			expect.objectContaining({
				tripType: "overnight",
				difficulty: "hard",
			})
		);
	});

	it("filters by price range using dual-thumb slider and calls onFilterChange", () => {
		const onFilterChange = vi.fn();

		render(<TripFilterBar currentFilters={{}} onFilterChange={onFilterChange} onReset={vi.fn()} />);

		fireEvent.click(screen.getByRole("button", { name: /bộ lọc nâng cao/i }));

		// Should render VND currency badges
		expect(screen.getAllByText("0 VNĐ").length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText("10.000.000+ VNĐ")).toBeInTheDocument();

		const minPriceInput = screen.getByLabelText("Giá tối thiểu");
		const maxPriceInput = screen.getByLabelText("Giá tối đa");

		fireEvent.change(minPriceInput, { target: { value: "500000" } });
		fireEvent.change(maxPriceInput, { target: { value: "4000000" } });

		expect(screen.getByText("500.000 VNĐ")).toBeInTheDocument();
		expect(screen.getByText("4.000.000 VNĐ")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /tìm kiếm/i }));

		expect(onFilterChange).toHaveBeenCalledWith(
			expect.objectContaining({
				minPrice: 500000,
				maxPrice: 4000000,
			})
		);
	});

	it("validates price range and shows error when minPrice > maxPrice", () => {
		const onFilterChange = vi.fn();

		render(<TripFilterBar currentFilters={{}} onFilterChange={onFilterChange} onReset={vi.fn()} />);

		fireEvent.click(screen.getByRole("button", { name: /bộ lọc nâng cao/i }));

		const minPriceInput = screen.getByLabelText("Giá tối thiểu");
		const maxPriceInput = screen.getByLabelText("Giá tối đa");

		fireEvent.change(minPriceInput, { target: { value: "2000000" } });
		fireEvent.change(maxPriceInput, { target: { value: "1000000" } });

		fireEvent.click(screen.getByRole("button", { name: /tìm kiếm/i }));

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Giá tối thiểu không thể lớn hơn giá tối đa"
		);
		expect(onFilterChange).not.toHaveBeenCalled();
	});

	it("validates date range and shows error when startDate > endDate", () => {
		const onFilterChange = vi.fn();

		render(<TripFilterBar currentFilters={{}} onFilterChange={onFilterChange} onReset={vi.fn()} />);

		fireEvent.click(screen.getByRole("button", { name: /bộ lọc nâng cao/i }));

		const startDateInput = screen.getByLabelText("Từ ngày");
		const endDateInput = screen.getByLabelText("Đến ngày");

		fireEvent.change(startDateInput, { target: { value: "2026-10-10" } });
		fireEvent.change(endDateInput, { target: { value: "2026-10-05" } });

		fireEvent.click(screen.getByRole("button", { name: /tìm kiếm/i }));

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Ngày bắt đầu không thể diễn ra sau ngày kết thúc"
		);
		expect(onFilterChange).not.toHaveBeenCalled();
	});

	it("resets filter values and calls onReset", () => {
		const onReset = vi.fn();

		render(
			<TripFilterBar
				currentFilters={{ search: "Initial" }}
				onFilterChange={vi.fn()}
				onReset={onReset}
			/>
		);

		fireEvent.click(screen.getByRole("button", { name: /bộ lọc nâng cao/i }));
		fireEvent.click(screen.getByRole("button", { name: /xóa bộ lọc/i }));

		expect(onReset).toHaveBeenCalled();
		expect(screen.getByLabelText("Tìm kiếm chuyến đi")).toHaveValue("");
	});
});
