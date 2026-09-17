import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CreatedTrekkingRoute } from "../../trekking-routes/types";
import { CreateTripForm } from "./CreateTripForm";

const activeRoute: CreatedTrekkingRoute = {
	id: "11111111-1111-4111-8111-111111111111",
	name: "Bidoup Trail",
	description: null,
	geometry: {
		type: "LineString",
		coordinates: [
			[108.22, 16.04],
			[108.25, 16.06],
		],
	},
	difficulty: "moderate",
	expectedDurationMinutes: 180,
	lengthMeters: 2500,
	status: "active",
	createdAt: "2026-09-01T00:00:00.000Z",
	updatedAt: "2026-09-01T00:00:00.000Z",
};

function renderForm(overrides: Partial<React.ComponentProps<typeof CreateTripForm>> = {}) {
	const props: React.ComponentProps<typeof CreateTripForm> = {
		activeRoutes: [activeRoute],
		isRouteLoading: false,
		routeError: "",
		isSubmitting: false,
		error: null,
		onSubmit: vi.fn().mockResolvedValue(null),
		onRetry: vi.fn().mockResolvedValue(null),
		onRetryRoutes: vi.fn(),
		...overrides,
	};
	render(<CreateTripForm {...props} />);
	return props;
}

function fillValidForm() {
	fireEvent.change(screen.getByLabelText("Tuyến active"), { target: { value: activeRoute.id } });
	fireEvent.change(screen.getByLabelText("Tên trip"), { target: { value: "  Bidoup morning  " } });
	fireEvent.change(screen.getByLabelText("Loại trip"), { target: { value: "day_trip" } });
	fireEvent.change(screen.getByLabelText("Bắt đầu"), { target: { value: "2026-10-01T09:00" } });
	fireEvent.change(screen.getByLabelText("Kết thúc"), { target: { value: "2026-10-01T17:00" } });
	fireEvent.change(screen.getByLabelText("Thời gian tập trung"), {
		target: { value: "2026-10-01T08:30" },
	});
	fireEvent.change(screen.getByLabelText("Hạn đặt chỗ"), { target: { value: "2026-09-30T09:00" } });
	fireEvent.change(screen.getByLabelText("Số khách tối thiểu"), { target: { value: "2" } });
	fireEvent.change(screen.getByLabelText("Số khách tối đa"), { target: { value: "12" } });
	fireEvent.change(screen.getByLabelText("Giá mỗi người"), { target: { value: "0" } });
	fireEvent.change(screen.getByLabelText("Tên waypoint 1"), { target: { value: "Trailhead" } });
	fireEvent.change(screen.getByLabelText("Tên waypoint 2"), { target: { value: "Exit" } });
	fireEvent.change(screen.getByLabelText("Thời gian waypoint 1"), {
		target: { value: "2026-10-01T09:00" },
	});
	fireEvent.change(screen.getByLabelText("Thời gian waypoint 2"), {
		target: { value: "2026-10-01T17:00" },
	});
}

describe("CreateTripForm", () => {
	it("renders the Host create trip workflow and submits the backend payload", async () => {
		const props = renderForm();
		fillValidForm();

		fireEvent.click(screen.getByRole("button", { name: "Tạo trip draft" }));

		await waitFor(() =>
			expect(props.onSubmit).toHaveBeenCalledWith(
				expect.objectContaining({
					routeId: activeRoute.id,
					title: "Bidoup morning",
					tripType: "day_trip",
					capacityMin: 2,
					capacityMax: 12,
					pricePerPerson: 0,
					waypoints: expect.arrayContaining([
						expect.objectContaining({ type: "start", name: "Trailhead" }),
						expect.objectContaining({ type: "finish", name: "Exit" }),
					]),
				})
			)
		);
	});

	it("shows required field validation messages", async () => {
		renderForm();

		fireEvent.click(screen.getByRole("button", { name: "Tạo trip draft" }));

		expect(await screen.findByText("Tên trip là bắt buộc")).toBeVisible();
		expect(screen.getByText("Thời gian bắt đầu là bắt buộc")).toBeVisible();
		expect(screen.getByLabelText("Tuyến active")).toHaveValue(activeRoute.id);
	});

	it("validates date ranges, capacity, duplicate waypoint order, and coordinates", async () => {
		renderForm();
		fillValidForm();
		fireEvent.change(screen.getByLabelText("Kết thúc"), { target: { value: "2026-10-01T08:00" } });
		fireEvent.change(screen.getByLabelText("Hạn đặt chỗ"), {
			target: { value: "2026-10-01T10:00" },
		});
		fireEvent.change(screen.getByLabelText("Số khách tối thiểu"), { target: { value: "20" } });
		fireEvent.change(screen.getByLabelText("Kinh độ điểm tập trung"), { target: { value: "200" } });
		fireEvent.change(screen.getByLabelText("Thứ tự waypoint 2"), { target: { value: "1" } });

		fireEvent.click(screen.getByRole("button", { name: "Tạo trip draft" }));

		expect(await screen.findByText("Thời gian kết thúc phải sau thời gian bắt đầu")).toBeVisible();
		expect(screen.getByText("Hạn đặt chỗ phải trước thời gian bắt đầu")).toBeVisible();
		expect(screen.getByText("Số khách tối thiểu không được lớn hơn số khách tối đa")).toBeVisible();
		expect(screen.getByText("Kinh độ phải từ -180 đến 180")).toBeVisible();
		expect(screen.getByText("Thứ tự waypoint không được trùng")).toBeVisible();
	});

	it("keeps draft inputs editable while CTMS-10 has no active route", () => {
		const { rerender } = render(
			<CreateTripForm
				activeRoutes={[activeRoute]}
				isRouteLoading={false}
				routeError=""
				isSubmitting
				error={null}
				onSubmit={vi.fn()}
				onRetry={vi.fn()}
				onRetryRoutes={vi.fn()}
			/>
		);
		expect(screen.getByRole("button", { name: /Đang tạo trip/ })).toBeDisabled();

		rerender(
			<CreateTripForm
				activeRoutes={[]}
				isRouteLoading={false}
				routeError=""
				isSubmitting={false}
				error={null}
				onSubmit={vi.fn()}
				onRetry={vi.fn()}
				onRetryRoutes={vi.fn()}
			/>
		);
		expect(screen.getByText(/Chưa có tuyến active từ CTMS-10/)).toBeVisible();
		expect(screen.getByLabelText("Tên trip")).not.toBeDisabled();
		fireEvent.change(screen.getByLabelText("Tên trip"), {
			target: { value: "Draft while waiting" },
		});
		expect(screen.getByLabelText("Tên trip")).toHaveValue("Draft while waiting");
		expect(screen.getByRole("button", { name: "Cần tuyến active để tạo trip" })).toBeDisabled();
	});

	it("preserves user-entered values after a recoverable backend failure", () => {
		renderForm({
			error: {
				status: 409,
				message: "Tuyến chưa ở trạng thái active đã duyệt, nên chưa thể tạo trip.",
				canRetry: true,
				fieldErrors: {},
			},
		});
		fireEvent.change(screen.getByLabelText("Tên trip"), { target: { value: "Keep this trip" } });

		expect(screen.getByLabelText("Tên trip")).toHaveValue("Keep this trip");
		expect(screen.getByRole("alert")).toHaveTextContent("Tuyến chưa ở trạng thái active");
	});

	it("maps backend 422 field errors back onto the form", async () => {
		renderForm({
			error: {
				status: 422,
				message: "Thông tin trip chưa hợp lệ.",
				canRetry: false,
				fieldErrors: { bookingDeadline: "bookingDeadline must be before startsAt" },
			},
		});

		expect(await screen.findByText("bookingDeadline must be before startsAt")).toBeVisible();
	});
});
