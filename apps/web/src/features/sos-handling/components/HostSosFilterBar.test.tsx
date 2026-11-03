import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HostSosFilterBar } from "./HostSosFilterBar";

describe("HostSosFilterBar", () => {
	it("renders all status tabs with counts", () => {
		const onStatusChange = vi.fn();
		const onSearchChange = vi.fn();

		render(
			<HostSosFilterBar
				statusFilter="all"
				onStatusChange={onStatusChange}
				search=""
				onSearchChange={onSearchChange}
				counts={{
					all: 10,
					active: 2,
					acknowledged: 3,
					closed: 4,
					cancelled: 1,
				}}
			/>
		);

		expect(screen.getByText("Tất cả")).toBeInTheDocument();
		expect(screen.getByText("Cần tiếp nhận")).toBeInTheDocument();
		expect(screen.getByText("2")).toBeInTheDocument();
		expect(screen.getByText("Đang hỗ trợ")).toBeInTheDocument();
		expect(screen.getByText("3")).toBeInTheDocument();
	});

	it("triggers onStatusChange when a tab is clicked", () => {
		const onStatusChange = vi.fn();
		render(
			<HostSosFilterBar
				statusFilter="all"
				onStatusChange={onStatusChange}
				search=""
				onSearchChange={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByText("Cần tiếp nhận"));
		expect(onStatusChange).toHaveBeenCalledWith("active");
	});

	it("triggers onSearchChange when input value changes", () => {
		const onSearchChange = vi.fn();
		render(
			<HostSosFilterBar
				statusFilter="all"
				onStatusChange={vi.fn()}
				search=""
				onSearchChange={onSearchChange}
			/>
		);

		const input = screen.getByPlaceholderText("Tìm theo camper, chuyến đi...");
		fireEvent.change(input, { target: { value: "Sơn Trà" } });
		expect(onSearchChange).toHaveBeenCalledWith("Sơn Trà");
	});
});
