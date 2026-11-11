import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PorterLedTripHistory } from "./PorterLedTripHistory";

const pagination = { page: 1, limit: 5, total: 1, totalPages: 1 };

describe("PorterLedTripHistory", () => {
	it("renders authoritative completed Lead history without private member data", () => {
		render(
			<PorterLedTripHistory
				items={[
					{
						tripId: "trip-1",
						tripTitle: "Trekking Tà Năng",
						routeId: "route-1",
						routeName: "Tà Năng - Phan Dũng",
						startsAt: "2026-05-01T00:00:00.000Z",
						endsAt: "2026-05-03T00:00:00.000Z",
						role: "lead",
						status: "completed",
					},
				]}
				isLoading={false}
				errorMessage={null}
				pagination={pagination}
				onPageChange={vi.fn()}
				onRetry={vi.fn()}
			/>
		);

		expect(screen.getByRole("heading", { name: "Lịch sử chuyến đi đã dẫn" })).toBeVisible();
		expect(screen.getByText("Trekking Tà Năng")).toBeVisible();
		expect(screen.getByText("Tà Năng - Phan Dũng")).toBeVisible();
		expect(screen.getByText("Vai trò: Trưởng nhóm")).toBeVisible();
		expect(screen.getByText("Đã hoàn thành")).toBeVisible();
		expect(screen.queryByText(/camper/i)).not.toBeInTheDocument();
	});

	it("renders loading and empty states", () => {
		const { rerender } = render(
			<PorterLedTripHistory
				items={[]}
				isLoading={true}
				errorMessage={null}
				pagination={{ ...pagination, total: 0, totalPages: 0 }}
				onPageChange={vi.fn()}
				onRetry={vi.fn()}
			/>
		);
		expect(screen.getByTestId("led-trip-history-loading")).toBeVisible();

		rerender(
			<PorterLedTripHistory
				items={[]}
				isLoading={false}
				errorMessage={null}
				pagination={{ ...pagination, total: 0, totalPages: 0 }}
				onPageChange={vi.fn()}
				onRetry={vi.fn()}
			/>
		);
		expect(screen.getByTestId("led-trip-history-empty")).toBeVisible();
	});

	it("renders an error and retries", async () => {
		const user = userEvent.setup();
		const onRetry = vi.fn();
		render(
			<PorterLedTripHistory
				items={[]}
				isLoading={false}
				errorMessage="Không thể tải lịch sử"
				pagination={{ ...pagination, total: 0, totalPages: 0 }}
				onPageChange={vi.fn()}
				onRetry={onRetry}
			/>
		);

		await user.click(screen.getByRole("button", { name: "Thử lại" }));
		expect(onRetry).toHaveBeenCalledOnce();
	});

	it("uses the shared pagination control", async () => {
		const user = userEvent.setup();
		const onPageChange = vi.fn();
		render(
			<PorterLedTripHistory
				items={[
					{
						tripId: "trip-1",
						tripTitle: "Trip 1",
						routeId: "route-1",
						routeName: "Route 1",
						startsAt: "2026-05-01T00:00:00.000Z",
						endsAt: "2026-05-02T00:00:00.000Z",
						role: "lead",
						status: "completed",
					},
				]}
				isLoading={false}
				errorMessage={null}
				pagination={{ page: 1, limit: 5, total: 6, totalPages: 2 }}
				onPageChange={onPageChange}
				onRetry={vi.fn()}
			/>
		);

		await user.click(screen.getByRole("button", { name: "Tiếp theo" }));
		expect(onPageChange).toHaveBeenCalledWith(2);
	});
});
