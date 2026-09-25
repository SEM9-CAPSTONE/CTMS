import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreateCheckpointForm } from "./CreateCheckpointForm";

const location = { type: "Point" as const, coordinates: [108.46, 11.94] as [number, number] };
const existingCheckpoint = {
	id: "checkpoint-id",
	routeId: "route-id",
	name: "Tên tùy chỉnh",
	location,
	radiusMeters: 45,
	type: "water" as const,
	expectedArrivalOffset: 35,
	instructions: "Lấy nước tại đây",
	nearbyWaterOrShelter: true,
	routePosition: 0.5,
	createdAt: "2026-09-01T00:00:00.000Z",
	updatedAt: "2026-09-01T00:00:00.000Z",
};

describe("CreateCheckpointForm", () => {
	it("requires a map-selected location before calling the API", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		render(
			<CreateCheckpointForm
				expectedDurationMinutes={120}
				disabled={false}
				isSubmitting={false}
				error=""
				onSubmit={onSubmit}
				onCreated={vi.fn()}
			/>
		);
		await user.clear(screen.getByLabelText("Tên điểm dừng"));
		await user.type(screen.getByLabelText("Tên điểm dừng"), "Start");
		await user.type(screen.getByLabelText("Hướng dẫn"), "Begin here");
		await user.click(screen.getByRole("button", { name: "Thêm điểm dừng" }));
		expect(await screen.findByText("Vui lòng chọn vị trí trên bản đồ")).toBeInTheDocument();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("preserves all values after a failed POST and clears them only after success", async () => {
		const user = userEvent.setup();
		const onSubmit = vi
			.fn()
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ id: "checkpoint-id" });
		const onCreated = vi.fn();
		render(
			<CreateCheckpointForm
				location={location}
				expectedDurationMinutes={120}
				disabled={false}
				isSubmitting={false}
				error="Vị trí cách tuyến quá 50 mét"
				onSubmit={onSubmit}
				onCreated={onCreated}
			/>
		);
		await user.clear(screen.getByLabelText("Tên điểm dừng"));
		await user.type(screen.getByLabelText("Tên điểm dừng"), "Ridge rest");
		await user.clear(screen.getByLabelText("Thời gian đến dự kiến (phút)"));
		await user.type(screen.getByLabelText("Thời gian đến dự kiến (phút)"), "45");
		await user.type(screen.getByLabelText("Hướng dẫn"), "Rest here");
		await user.click(screen.getByRole("button", { name: "Thêm điểm dừng" }));

		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect(screen.getByLabelText("Tên điểm dừng")).toHaveValue("Ridge rest");
		expect(screen.getByLabelText("Hướng dẫn")).toHaveValue("Rest here");
		expect(onCreated).not.toHaveBeenCalled();

		await user.click(screen.getByRole("button", { name: "Thêm điểm dừng" }));
		await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
		expect(screen.getByLabelText("Tên điểm dừng")).toHaveValue("Điểm nghỉ chân");
		expect(screen.getByLabelText("Hướng dẫn")).toHaveValue("");
	});

	it("enforces the parent route duration before calling the API", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		render(
			<CreateCheckpointForm
				location={location}
				expectedDurationMinutes={60}
				disabled={false}
				isSubmitting={false}
				error=""
				onSubmit={onSubmit}
				onCreated={vi.fn()}
			/>
		);
		await user.clear(screen.getByLabelText("Tên điểm dừng"));
		await user.type(screen.getByLabelText("Tên điểm dừng"), "Finish");
		await user.clear(screen.getByLabelText("Thời gian đến dự kiến (phút)"));
		await user.type(screen.getByLabelText("Thời gian đến dự kiến (phút)"), "61");
		await user.type(screen.getByLabelText("Hướng dẫn"), "Finish safely");
		await user.click(screen.getByRole("button", { name: "Thêm điểm dừng" }));
		expect(
			await screen.findByText("Thời gian đến không được vượt quá 60 phút")
		).toBeInTheDocument();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("disables every create control for non-draft routes", () => {
		render(
			<CreateCheckpointForm
				location={location}
				expectedDurationMinutes={60}
				disabled
				isSubmitting={false}
				error=""
				onSubmit={vi.fn()}
				onCreated={vi.fn()}
			/>
		);
		expect(screen.getByRole("button", { name: "Thêm điểm dừng" })).toBeDisabled();
		expect(screen.getByLabelText("Tên điểm dừng")).toBeDisabled();
	});

	it("shows pending copy and disables duplicate form actions", () => {
		render(
			<CreateCheckpointForm
				location={location}
				expectedDurationMinutes={60}
				disabled={false}
				isSubmitting
				error=""
				onSubmit={vi.fn()}
				onCreated={vi.fn()}
			/>
		);
		expect(screen.getByRole("button", { name: "Đang thêm điểm dừng..." })).toBeDisabled();
		expect(screen.getByLabelText("Tên điểm dừng")).toBeDisabled();
		expect(screen.getByLabelText("Loại điểm dừng")).toBeDisabled();
	});

	it.each([
		["start", "Điểm bắt đầu"],
		["finish", "Điểm kết thúc"],
		["rest", "Điểm nghỉ chân"],
	] as const)("suggests the default name for %s", async (type, expectedName) => {
		const user = userEvent.setup();
		render(
			<CreateCheckpointForm
				location={location}
				expectedDurationMinutes={120}
				disabled={false}
				isSubmitting={false}
				error=""
				onSubmit={vi.fn()}
				onCreated={vi.fn()}
			/>
		);
		await user.selectOptions(screen.getByLabelText("Loại điểm dừng"), type);
		expect(screen.getByLabelText("Tên điểm dừng")).toHaveValue(expectedName);
	});

	it("keeps a manually customized name when checkpoint type changes", async () => {
		const user = userEvent.setup();
		render(
			<CreateCheckpointForm
				location={location}
				expectedDurationMinutes={120}
				disabled={false}
				isSubmitting={false}
				error=""
				onSubmit={vi.fn()}
				onCreated={vi.fn()}
			/>
		);
		const name = screen.getByLabelText("Tên điểm dừng");
		await user.clear(name);
		await user.type(name, "Mỏm đá riêng");
		await user.selectOptions(screen.getByLabelText("Loại điểm dừng"), "dangerous");
		expect(name).toHaveValue("Mỏm đá riêng");
	});

	it("loads every editable checkpoint field and cancel does not submit", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		const onCancel = vi.fn();
		render(
			<CreateCheckpointForm
				checkpoint={existingCheckpoint}
				location={existingCheckpoint.location}
				expectedDurationMinutes={120}
				disabled={false}
				isSubmitting={false}
				error=""
				onSubmit={onSubmit}
				onCreated={vi.fn()}
				onCancel={onCancel}
			/>
		);
		expect(screen.getByLabelText("Tên điểm dừng")).toHaveValue("Tên tùy chỉnh");
		expect(screen.getByLabelText("Loại điểm dừng")).toHaveValue("water");
		expect(screen.queryByLabelText("Bán kính (mét)")).not.toBeInTheDocument();
		expect(screen.getByLabelText("Thời gian đến dự kiến (phút)")).toHaveValue("35");
		expect(screen.getByLabelText("Hướng dẫn")).toHaveValue("Lấy nước tại đây");
		expect(screen.getByRole("checkbox")).toBeChecked();
		await user.click(screen.getByRole("button", { name: "Hủy" }));
		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("preserves edited values when an update fails", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn().mockResolvedValue(null);
		render(
			<CreateCheckpointForm
				checkpoint={existingCheckpoint}
				location={existingCheckpoint.location}
				expectedDurationMinutes={120}
				disabled={false}
				isSubmitting={false}
				error="Không thể cập nhật điểm dừng"
				onSubmit={onSubmit}
				onCreated={vi.fn()}
				onCancel={vi.fn()}
			/>
		);
		const name = screen.getByLabelText("Tên điểm dừng");
		await user.clear(name);
		await user.type(name, "Tên sau chỉnh sửa");
		await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect(name).toHaveValue("Tên sau chỉnh sửa");
		expect(screen.getByRole("alert")).toHaveTextContent("Không thể cập nhật điểm dừng");
	});

	it("submits only the editable checkpoint update fields", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn().mockResolvedValue({ ...existingCheckpoint, name: "Điểm bắt đầu" });
		render(
			<CreateCheckpointForm
				checkpoint={existingCheckpoint}
				location={existingCheckpoint.location}
				expectedDurationMinutes={120}
				disabled={false}
				isSubmitting={false}
				error=""
				onSubmit={onSubmit}
				onCreated={vi.fn()}
				onCancel={vi.fn()}
			/>
		);
		await user.clear(screen.getByLabelText("Tên điểm dừng"));
		await user.type(screen.getByLabelText("Tên điểm dừng"), "Điểm bắt đầu");
		await user.selectOptions(screen.getByLabelText("Loại điểm dừng"), "start");
		await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
		await waitFor(() =>
			expect(onSubmit).toHaveBeenCalledWith({
				name: "Điểm bắt đầu",
				location,
				radiusMeters: 20,
				type: "start",
				expectedArrivalOffset: 35,
				instructions: "Lấy nước tại đây",
				nearbyWaterOrShelter: true,
			})
		);
		const payload = onSubmit.mock.calls[0][0];
		expect(payload).not.toHaveProperty("id");
		expect(payload).not.toHaveProperty("routeId");
		expect(payload).not.toHaveProperty("routePosition");
	});
});
