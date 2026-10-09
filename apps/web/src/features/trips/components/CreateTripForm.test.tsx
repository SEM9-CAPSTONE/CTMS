import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CreatedTrekkingRoute } from "../../trekking-routes/types";
import { type CreateTripFormValues, createTripFormSchema } from "../schema/create-trip.schema";
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

const fiveKilometerRoute: CreatedTrekkingRoute = {
	...activeRoute,
	id: "22222222-2222-4222-8222-222222222222",
	name: "Five Kilometer Trail",
	expectedDurationMinutes: 50,
	lengthMeters: 5000,
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
	const view = render(<CreateTripForm {...props} />);
	return { ...props, ...view };
}

function fillValidForm() {
	fireEvent.change(screen.getByLabelText("Tuyến đã duyệt"), { target: { value: activeRoute.id } });
	fireEvent.change(screen.getByLabelText("Tên trip"), { target: { value: "  Bidoup morning  " } });
	fireEvent.change(screen.getByLabelText("Bắt đầu"), { target: { value: "2099-10-01T09:00" } });
	fireEvent.change(screen.getByLabelText("Kết thúc"), { target: { value: "2099-10-01T17:00" } });
	fireEvent.change(screen.getByLabelText("Thời gian tập trung"), {
		target: { value: "2099-10-01T08:30" },
	});
	fireEvent.change(screen.getByLabelText("Hạn đặt chỗ"), { target: { value: "2099-09-30T09:00" } });
	fireEvent.change(screen.getByLabelText("Số khách tối thiểu"), { target: { value: "2" } });
	fireEvent.change(screen.getByLabelText("Số khách tối đa"), { target: { value: "12" } });
	fireEvent.change(screen.getByLabelText("Giá mỗi người"), { target: { value: "0" } });
}

function submitFormDirectly() {
	const form = screen
		.getByRole("button", { name: "Tạo bản nháp và cấu hình điểm dừng" })
		.closest("form");
	if (!form) throw new Error("Create trip form not found");
	fireEvent.submit(form);
}

const rangePickerDefaults: CreateTripFormValues = {
	routeId: activeRoute.id,
	title: "Bidoup morning",
	description: "",
	coverImageUrl: "",
	tripType: "day_trip",
	startsAt: "2099-10-09T14:43",
	endsAt: "2099-10-10T13:28",
	meetingLongitude: "108.2208",
	meetingLatitude: "16.0471",
	meetingAt: "2099-10-09T14:00",
	bookingDeadline: "2099-10-08T14:00",
	capacityMin: "2",
	capacityMax: "12",
	pricePerPerson: "0",
	waypoints: [
		{
			type: "start",
			name: "Bidoup Trail - điểm bắt đầu",
			longitude: "108.22",
			latitude: "16.04",
			plannedAt: "2099-10-09T14:43",
		},
		{
			type: "finish",
			name: "Bidoup Trail - điểm kết thúc",
			longitude: "108.25",
			latitude: "16.06",
			plannedAt: "2099-10-10T13:28",
		},
	],
};

describe("CreateTripForm", () => {
	it("shows a concrete trip type label instead of the pending auto-detect text", () => {
		renderForm();

		expect(screen.getByText("Trong ngày")).toBeVisible();
		expect(screen.queryByText(/Sẽ tự xác định/)).not.toBeInTheDocument();

		fireEvent.change(screen.getByLabelText("Bắt đầu"), { target: { value: "2099-10-01T09:00" } });
		fireEvent.change(screen.getByLabelText("Kết thúc"), { target: { value: "2099-10-02T17:00" } });

		expect(screen.getByText("Qua đêm")).toBeVisible();
		expect(screen.queryByText(/Sẽ tự xác định/)).not.toBeInTheDocument();
	});

	it("restores unsaved draft values after the form is mounted again", () => {
		const draftStorageKey = "ctms:test:create-trip-form:draft";
		window.localStorage.removeItem(draftStorageKey);
		const { unmount } = renderForm({ draftStorageKey });

		fireEvent.change(screen.getByLabelText("Tên trip"), { target: { value: "Nháp không mất" } });
		fireEvent.change(screen.getByLabelText("Bắt đầu"), { target: { value: "2099-10-01T09:00" } });
		fireEvent.change(screen.getByLabelText("Kết thúc"), { target: { value: "2099-10-01T17:00" } });

		unmount();
		renderForm({ draftStorageKey });

		expect(screen.getByLabelText("Tên trip")).toHaveValue("Nháp không mất");
		expect(screen.getByLabelText("Bắt đầu")).toHaveValue("2099-10-01T09:00");
		expect(screen.getByLabelText("Kết thúc")).toHaveValue("2099-10-01T17:00");

		window.localStorage.removeItem(draftStorageKey);
	});

	it("renders the Host create trip workflow and submits the backend payload", async () => {
		const props = renderForm();
		fillValidForm();

		fireEvent.click(screen.getByRole("button", { name: "Tạo bản nháp và cấu hình điểm dừng" }));

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
						expect.objectContaining({
							type: "start",
							name: "Bidoup Trail - điểm bắt đầu",
							location: expect.objectContaining({ coordinates: [108.22, 16.04] }),
						}),
						expect.objectContaining({
							type: "finish",
							name: "Bidoup Trail - điểm kết thúc",
							location: expect.objectContaining({ coordinates: [108.25, 16.06] }),
						}),
					]),
				})
			)
		);
	});

	it("allows maximum guests to be empty and sends null", async () => {
		const props = renderForm();
		fillValidForm();
		fireEvent.change(screen.getByLabelText("Số khách tối đa"), { target: { value: "" } });

		submitFormDirectly();

		await waitFor(() =>
			expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ capacityMax: null }))
		);
		expect(screen.queryByText("Số khách tối đa phải là số nguyên dương")).not.toBeInTheDocument();
		expect(
			screen.queryByText("Số khách tối thiểu không được lớn hơn số khách tối đa")
		).not.toBeInTheDocument();
	});

	it("shows required field validation messages", async () => {
		renderForm();

		submitFormDirectly();

		expect(await screen.findByText("Tên trip là bắt buộc")).toBeVisible();
		expect(screen.getByText("Thời gian bắt đầu là bắt buộc")).toBeVisible();
		expect(screen.getByLabelText("Tuyến đã duyệt")).toHaveValue(activeRoute.id);
	});

	it("validates date ranges and capacity without manual stop inputs", async () => {
		renderForm();
		fillValidForm();
		fireEvent.change(screen.getByLabelText("Kết thúc"), { target: { value: "2099-10-01T08:00" } });
		fireEvent.change(screen.getByLabelText("Hạn đặt chỗ"), {
			target: { value: "2099-10-01T10:00" },
		});
		fireEvent.change(screen.getByLabelText("Số khách tối thiểu"), { target: { value: "20" } });

		submitFormDirectly();

		expect(
			await screen.findByText("Thời gian bắt đầu không được sau thời gian kết thúc")
		).toBeVisible();
		expect(screen.getByText("Hạn đặt chỗ phải trước thời gian bắt đầu")).toBeVisible();
		expect(screen.getByText("Số khách tối thiểu không được lớn hơn số khách tối đa")).toBeVisible();
		expect(screen.queryByText("Điểm đầu tiên phải là điểm bắt đầu")).not.toBeInTheDocument();
		expect(screen.queryByLabelText("Kinh độ điểm tập trung")).not.toBeInTheDocument();
		expect(screen.queryByLabelText("Tên điểm dừng 1")).not.toBeInTheDocument();
	});

	it("derives overnight trip type when the schedule spans another date", async () => {
		const props = renderForm();
		fillValidForm();
		fireEvent.change(screen.getByLabelText("Kết thúc"), { target: { value: "2099-10-02T17:00" } });

		submitFormDirectly();

		await waitFor(() =>
			expect(props.onSubmit).toHaveBeenCalledWith(
				expect.objectContaining({ tripType: "overnight" })
			)
		);
	});

	it("limits date pickers to valid future ranges as soon as dates are selected", () => {
		renderForm();

		const startsAtInput = screen.getByLabelText("Bắt đầu");
		const endsAtInput = screen.getByLabelText("Kết thúc");
		const meetingAtInput = screen.getByLabelText("Thời gian tập trung");
		const bookingDeadlineInput = screen.getByLabelText("Hạn đặt chỗ");

		expect(startsAtInput).toHaveAttribute("min");
		expect(endsAtInput).toHaveAttribute("min");
		expect(meetingAtInput).toHaveAttribute("min");
		expect(bookingDeadlineInput).toHaveAttribute("min");

		fireEvent.change(startsAtInput, { target: { value: "2099-10-01T09:00" } });

		expect(endsAtInput).toHaveAttribute("min", "2099-10-01T09:00");
		expect(meetingAtInput).toHaveAttribute("max", "2099-10-01T09:00");
		expect(bookingDeadlineInput).toHaveAttribute("max", "2099-10-01T09:00");
	});

	it("keeps the selected invalid range and shows an inline error", async () => {
		renderForm({ defaultValues: rangePickerDefaults });

		fireEvent.click(screen.getByRole("button", { name: "Mở thời gian" }));
		fireEvent.click(screen.getByText("Kết thúc"));
		fireEvent.click(screen.getByRole("button", { name: "9" }));

		await waitFor(() => expect(screen.getByLabelText("Kết thúc")).toHaveValue("2099-10-09T13:28"));
		expect(
			await screen.findByText("Thời gian bắt đầu không được sau thời gian kết thúc")
		).toBeVisible();
	});

	it("keeps a start date after the end date and shows an inline error", async () => {
		renderForm({ defaultValues: rangePickerDefaults });

		fireEvent.click(screen.getByRole("button", { name: "Mở thời gian" }));
		fireEvent.click(screen.getByRole("button", { name: "17" }));

		await waitFor(() => expect(screen.getByLabelText("Bắt đầu")).toHaveValue("2099-10-17T14:43"));
		await waitFor(() =>
			expect(screen.getByTestId("date-time-card-start")).toHaveTextContent(
				"Thời gian bắt đầu không được sau thời gian kết thúc"
			)
		);
		expect(screen.getByTestId("date-time-card-end")).not.toHaveTextContent(
			"Thời gian bắt đầu không được sau thời gian kết thúc"
		);
	});

	it("does not block the trip info step with waypoint ordering errors", () => {
		const result = createTripFormSchema.safeParse({
			...rangePickerDefaults,
			startsAt: "2099-10-09T08:00",
			endsAt: "2099-10-17T18:00",
			meetingAt: "2099-10-09T07:00",
			waypoints: [
				{
					type: "start",
					name: "Bidoup Trail - điểm bắt đầu",
					longitude: "108.22",
					latitude: "16.04",
					plannedAt: "2099-10-09T08:00",
				},
				{
					type: "finish",
					name: "Bidoup Trail - điểm kết thúc",
					longitude: "108.25",
					latitude: "16.06",
					plannedAt: "2099-10-17T18:00",
				},
				{
					type: "checkpoint",
					name: "Điểm đã cấu hình trước đó",
					longitude: "108.24",
					latitude: "16.05",
					plannedAt: "2099-10-10T08:00",
				},
			],
		});

		expect(result.success).toBe(true);
	});

	it("rejects past dates even when values are typed manually", async () => {
		renderForm();
		fillValidForm();
		fireEvent.change(screen.getByLabelText("Bắt đầu"), { target: { value: "2020-01-01T09:00" } });
		fireEvent.change(screen.getByLabelText("Kết thúc"), { target: { value: "2020-01-01T17:00" } });

		submitFormDirectly();

		expect(await screen.findByText("Thời gian bắt đầu không được ở quá khứ")).toBeVisible();
		expect(screen.getByText("Thời gian kết thúc không được ở quá khứ")).toBeVisible();
	});

	it("rejects a trip duration that is too short for the selected route distance", async () => {
		const props = renderForm({ activeRoutes: [fiveKilometerRoute] });
		fireEvent.change(screen.getByLabelText("Tuyến đã duyệt"), {
			target: { value: fiveKilometerRoute.id },
		});
		fireEvent.change(screen.getByLabelText("Tên trip"), { target: { value: "Too fast" } });
		fireEvent.change(screen.getByLabelText("Bắt đầu"), { target: { value: "2099-10-01T09:00" } });
		fireEvent.change(screen.getByLabelText("Kết thúc"), { target: { value: "2099-10-01T09:12" } });
		fireEvent.change(screen.getByLabelText("Thời gian tập trung"), {
			target: { value: "2099-10-01T08:30" },
		});
		fireEvent.change(screen.getByLabelText("Hạn đặt chỗ"), {
			target: { value: "2099-09-30T09:00" },
		});
		fireEvent.change(screen.getByLabelText("Số khách tối thiểu"), { target: { value: "2" } });
		fireEvent.change(screen.getByLabelText("Số khách tối đa"), { target: { value: "12" } });
		fireEvent.change(screen.getByLabelText("Giá mỗi người"), { target: { value: "0" } });

		submitFormDirectly();

		expect(
			await screen.findByText(/Thời lượng trip quá ngắn cho tuyến 5.0 km/)
		).toBeInTheDocument();
		expect(screen.getByText(/Cần tối thiểu 50 phút/)).toBeVisible();
		expect(props.onSubmit).not.toHaveBeenCalled();
	});

	it("shows the route duration warning even when maximum guests is empty", async () => {
		renderForm({ activeRoutes: [fiveKilometerRoute] });
		fireEvent.change(screen.getByLabelText("Tuyến đã duyệt"), {
			target: { value: fiveKilometerRoute.id },
		});
		fireEvent.change(screen.getByLabelText("Bắt đầu"), { target: { value: "2099-10-01T09:00" } });
		fireEvent.change(screen.getByLabelText("Kết thúc"), { target: { value: "2099-10-01T09:01" } });
		fireEvent.change(screen.getByLabelText("Số khách tối thiểu"), { target: { value: "12" } });
		fireEvent.change(screen.getByLabelText("Số khách tối đa"), { target: { value: "" } });

		expect(
			await screen.findByText(/Thời lượng trip quá ngắn cho tuyến 5.0 km/)
		).toBeInTheDocument();
		expect(screen.queryByText("Số khách tối đa phải là số nguyên dương")).not.toBeInTheDocument();
		expect(
			screen.queryByText("Số khách tối thiểu không được lớn hơn số khách tối đa")
		).not.toBeInTheDocument();
	});

	it("uses a local cover image picker instead of a URL input", () => {
		const createObjectURL = vi.fn(() => "blob:cover-image");
		const revokeObjectURL = vi.fn();
		Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
		Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
		renderForm();

		expect(screen.queryByLabelText("URL ảnh bìa")).not.toBeInTheDocument();
		const imageInput = screen.getByLabelText("Ảnh bìa");
		const image = new File(["cover"], "cover.png", { type: "image/png" });

		fireEvent.change(imageInput, { target: { files: [image] } });

		expect(createObjectURL).toHaveBeenCalledWith(image);
		expect(screen.getByAltText("Ảnh bìa đã chọn")).toBeVisible();
	});

	it("shows the map-driven route section", () => {
		renderForm();

		expect(screen.getByTestId("trip-route-map")).toBeVisible();
		expect(screen.getByText("Tuyến và điểm tập trung")).toBeVisible();
		expect(screen.getByText(/bấm trên bản đồ để đặt điểm tập trung/)).toBeVisible();
	});

	it("keeps draft inputs editable while there is no approved route", () => {
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
		expect(screen.getByText(/Chưa có tuyến trekking đã duyệt/)).toBeVisible();
		expect(screen.getByLabelText("Tên trip")).not.toBeDisabled();
		fireEvent.change(screen.getByLabelText("Tên trip"), {
			target: { value: "Draft while waiting" },
		});
		expect(screen.getByLabelText("Tên trip")).toHaveValue("Draft while waiting");
		expect(screen.getByRole("button", { name: "Cần tuyến đã duyệt để tạo trip" })).toBeDisabled();
	});

	it("preserves user-entered values after a recoverable backend failure", () => {
		renderForm({
			error: {
				status: 409,
				message: "Tuyến chưa ở trạng thái đã duyệt, nên chưa thể tạo trip.",
				canRetry: true,
				fieldErrors: {},
			},
		});
		fireEvent.change(screen.getByLabelText("Tên trip"), { target: { value: "Keep this trip" } });

		expect(screen.getByLabelText("Tên trip")).toHaveValue("Keep this trip");
		expect(screen.getByRole("alert")).toHaveTextContent("Tuyến chưa ở trạng thái đã duyệt");
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
