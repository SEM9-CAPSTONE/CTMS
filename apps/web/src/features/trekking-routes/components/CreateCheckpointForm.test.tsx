import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RouteCheckpointType } from "../types";
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
				disabled={false}
				isSubmitting={false}
				error=""
				onSubmit={onSubmit}
				onCreated={vi.fn()}
			/>
		);
		await user.click(screen.getByRole("button", { name: "Thêm vị trí" }));
		expect(await screen.findByText("Vui lòng chọn vị trí trên bản đồ")).toBeInTheDocument();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("offers only on-route location types and no name or arrival time fields", () => {
		render(
			<CreateCheckpointForm
				location={location}
				disabled={false}
				isSubmitting={false}
				error=""
				onSubmit={vi.fn()}
				onCreated={vi.fn()}
			/>
		);
		const options = Array.from((screen.getByLabelText("Vị trí") as HTMLSelectElement).options).map(
			(option) => option.value
		);
		expect(options).toEqual([
			"",
			"start",
			"finish",
			"rest",
			"water",
			"dangerous",
			"emergency_shelter",
		]);
		expect(screen.queryByLabelText("Tên điểm dừng")).not.toBeInTheDocument();
		expect(screen.queryByLabelText("Thời gian đến dự kiến (phút)")).not.toBeInTheDocument();
	});

	it("offers Khu vực nguy hiểm for new locations and hands off to the danger area form", async () => {
		const user = userEvent.setup();
		const onSelectDangerArea = vi.fn();
		render(
			<CreateCheckpointForm
				location={location}
				onSelectDangerArea={onSelectDangerArea}
				disabled={false}
				isSubmitting={false}
				error=""
				onSubmit={vi.fn()}
				onCreated={vi.fn()}
			/>
		);
		await user.selectOptions(screen.getByLabelText("Vị trí"), "danger_area");
		expect(onSelectDangerArea).toHaveBeenCalledTimes(1);
	});

	it("starts with the type picked from the danger area form", () => {
		render(
			<CreateCheckpointForm
				location={location}
				initialType="emergency_shelter"
				disabled={false}
				isSubmitting={false}
				error=""
				onSubmit={vi.fn()}
				onCreated={vi.fn()}
			/>
		);
		expect(screen.getByLabelText("Vị trí")).toHaveValue("emergency_shelter");
	});

	it("submits without guidance and derives the name from the type", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn().mockResolvedValue({ id: "checkpoint-id" });
		render(
			<CreateCheckpointForm
				location={location}
				disabled={false}
				isSubmitting={false}
				error=""
				onSubmit={onSubmit}
				onCreated={vi.fn()}
			/>
		);
		await user.selectOptions(screen.getByLabelText("Vị trí"), "emergency_shelter");
		await user.click(screen.getByRole("button", { name: "Thêm vị trí" }));
		await waitFor(() =>
			expect(onSubmit).toHaveBeenCalledWith({
				name: "Nơi trú ẩn khẩn cấp",
				location,
				radiusMeters: 20,
				type: "emergency_shelter",
				expectedArrivalOffset: 0,
				instructions: "Nơi trú ẩn khẩn cấp",
				nearbyWaterOrShelter: false,
			})
		);
	});

	it("preserves values after a failed POST and clears them only after success", async () => {
		const user = userEvent.setup();
		const onSubmit = vi
			.fn()
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ id: "checkpoint-id" });
		const onCreated = vi.fn();
		render(
			<CreateCheckpointForm
				location={location}
				disabled={false}
				isSubmitting={false}
				error="Vị trí cách tuyến quá 50 mét"
				onSubmit={onSubmit}
				onCreated={onCreated}
			/>
		);
		await user.selectOptions(screen.getByLabelText("Vị trí"), "dangerous");
		await user.type(screen.getByLabelText("Hướng dẫn"), "Đi chậm");
		await user.click(screen.getByRole("button", { name: "Thêm vị trí" }));

		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect(screen.getByLabelText("Vị trí")).toHaveValue("dangerous");
		expect(screen.getByLabelText("Hướng dẫn")).toHaveValue("Đi chậm");
		expect(onCreated).not.toHaveBeenCalled();

		await user.click(screen.getByRole("button", { name: "Thêm vị trí" }));
		await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
		expect(screen.getByLabelText("Vị trí")).toHaveValue("water");
		expect(screen.getByLabelText("Hướng dẫn")).toHaveValue("");
	});

	it("disables every create control for non-draft routes", () => {
		render(
			<CreateCheckpointForm
				location={location}
				disabled
				isSubmitting={false}
				error=""
				onSubmit={vi.fn()}
				onCreated={vi.fn()}
			/>
		);
		expect(screen.getByRole("button", { name: "Thêm vị trí" })).toBeDisabled();
		expect(screen.getByLabelText("Vị trí")).toBeDisabled();
	});

	it("shows pending copy and disables duplicate form actions", () => {
		render(
			<CreateCheckpointForm
				location={location}
				disabled={false}
				isSubmitting
				error=""
				onSubmit={vi.fn()}
				onCreated={vi.fn()}
			/>
		);
		expect(screen.getByRole("button", { name: "Đang thêm vị trí..." })).toBeDisabled();
		expect(screen.getByLabelText("Vị trí")).toBeDisabled();
		expect(screen.getByLabelText("Hướng dẫn")).toBeDisabled();
	});

	it("loads editable fields and cancel does not submit", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		const onCancel = vi.fn();
		render(
			<CreateCheckpointForm
				checkpoint={existingCheckpoint}
				location={existingCheckpoint.location}
				disabled={false}
				isSubmitting={false}
				error=""
				onSubmit={onSubmit}
				onCreated={vi.fn()}
				onCancel={onCancel}
			/>
		);
		expect(screen.getByLabelText("Vị trí")).toHaveValue("water");
		expect(screen.getByLabelText("Hướng dẫn")).toHaveValue("Lấy nước tại đây");
		expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Hủy" }));
		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("asks for a new type when editing a checkpoint with an unrecognized type", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		render(
			<CreateCheckpointForm
				checkpoint={{
					...existingCheckpoint,
					type: "unrecognized" as unknown as RouteCheckpointType,
				}}
				location={existingCheckpoint.location}
				disabled={false}
				isSubmitting={false}
				error=""
				onSubmit={onSubmit}
				onCreated={vi.fn()}
				onCancel={vi.fn()}
			/>
		);
		expect(screen.getByLabelText("Vị trí")).toHaveValue("");
		await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
		expect(await screen.findByText("Vui lòng chọn loại vị trí")).toBeInTheDocument();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("keeps stored arrival offset and compatibility flag when updating", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn().mockResolvedValue(existingCheckpoint);
		render(
			<CreateCheckpointForm
				checkpoint={existingCheckpoint}
				location={existingCheckpoint.location}
				disabled={false}
				isSubmitting={false}
				error=""
				onSubmit={onSubmit}
				onCreated={vi.fn()}
				onCancel={vi.fn()}
			/>
		);
		await user.selectOptions(screen.getByLabelText("Vị trí"), "dangerous");
		await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
		await waitFor(() =>
			expect(onSubmit).toHaveBeenCalledWith({
				name: "Điểm nguy hiểm",
				location,
				radiusMeters: 20,
				type: "dangerous",
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
