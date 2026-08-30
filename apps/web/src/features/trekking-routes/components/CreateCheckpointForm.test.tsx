import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreateCheckpointForm } from "./CreateCheckpointForm";

const location = { type: "Point" as const, coordinates: [108.46, 11.94] as [number, number] };

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
				onRadiusChange={vi.fn()}
				onSubmit={onSubmit}
				onCreated={vi.fn()}
			/>
		);
		await user.type(screen.getByLabelText("Tên checkpoint"), "Start");
		await user.type(screen.getByLabelText("Hướng dẫn"), "Begin here");
		await user.click(screen.getByRole("button", { name: "Tạo checkpoint" }));
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
				onRadiusChange={vi.fn()}
				onSubmit={onSubmit}
				onCreated={onCreated}
			/>
		);
		await user.type(screen.getByLabelText("Tên checkpoint"), "Ridge rest");
		await user.clear(screen.getByLabelText("Thời gian đến dự kiến (phút)"));
		await user.type(screen.getByLabelText("Thời gian đến dự kiến (phút)"), "45");
		await user.type(screen.getByLabelText("Hướng dẫn"), "Rest here");
		await user.click(screen.getByRole("button", { name: "Tạo checkpoint" }));

		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect(screen.getByLabelText("Tên checkpoint")).toHaveValue("Ridge rest");
		expect(screen.getByLabelText("Hướng dẫn")).toHaveValue("Rest here");
		expect(onCreated).not.toHaveBeenCalled();

		await user.click(screen.getByRole("button", { name: "Tạo checkpoint" }));
		await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
		expect(screen.getByLabelText("Tên checkpoint")).toHaveValue("");
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
				onRadiusChange={vi.fn()}
				onSubmit={onSubmit}
				onCreated={vi.fn()}
			/>
		);
		await user.type(screen.getByLabelText("Tên checkpoint"), "Finish");
		await user.clear(screen.getByLabelText("Thời gian đến dự kiến (phút)"));
		await user.type(screen.getByLabelText("Thời gian đến dự kiến (phút)"), "61");
		await user.type(screen.getByLabelText("Hướng dẫn"), "Finish safely");
		await user.click(screen.getByRole("button", { name: "Tạo checkpoint" }));
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
				onRadiusChange={vi.fn()}
				onSubmit={vi.fn()}
				onCreated={vi.fn()}
			/>
		);
		expect(screen.getByRole("button", { name: "Tạo checkpoint" })).toBeDisabled();
		expect(screen.getByLabelText("Tên checkpoint")).toBeDisabled();
	});

	it("shows pending copy and disables duplicate form actions", () => {
		render(
			<CreateCheckpointForm
				location={location}
				expectedDurationMinutes={60}
				disabled={false}
				isSubmitting
				error=""
				onRadiusChange={vi.fn()}
				onSubmit={vi.fn()}
				onCreated={vi.fn()}
			/>
		);
		expect(screen.getByRole("button", { name: "Đang tạo checkpoint..." })).toBeDisabled();
		expect(screen.getByLabelText("Tên checkpoint")).toBeDisabled();
		expect(screen.getByLabelText("Loại checkpoint")).toBeDisabled();
	});
});
