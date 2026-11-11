import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import type { CreatedTrekkingRoute } from "../types";
import { RouteDraftWorkspace } from "./RouteDraftWorkspace";

vi.mock("../services/trekking-routes.service", () => ({
	trekkingRoutesService: {
		create: vi.fn(),
		updateDraft: vi.fn(),
		submitForApproval: vi.fn(),
		getMineById: vi.fn(),
	},
}));
vi.mock("./RouteGeometryEditor", () => ({
	RouteGeometryEditor: ({
		onChange,
	}: { onChange: (geometry: CreatedTrekkingRoute["geometry"]) => void }) => (
		<button type="button" onClick={() => onChange(route.geometry)}>
			Vẽ tuyến đường
		</button>
	),
}));

const route: CreatedTrekkingRoute = {
	id: "saved-id",
	name: "Ridge",
	description: "Existing description",
	difficulty: "moderate",
	geometry: {
		type: "LineString",
		coordinates: [
			[108, 16],
			[108.02, 16.02],
		],
	},
	lengthMeters: 3500,
	expectedDurationMinutes: 120,
	status: "draft",
	createdAt: "2026-09-01",
	updatedAt: "2026-09-01",
};
const pendingRoute: CreatedTrekkingRoute = { ...route, status: "pending_approval" };

describe("RouteDraftWorkspace", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.mocked(trekkingRoutesService.updateDraft).mockResolvedValue(route);
		vi.mocked(trekkingRoutesService.submitForApproval).mockResolvedValue(pendingRoute);
		vi.mocked(trekkingRoutesService.getMineById).mockResolvedValue(route);
	});

	it("keeps the editable form and direct submit button after saving a draft", async () => {
		render(<RouteDraftWorkspace route={route} />);
		fireEvent.change(screen.getByLabelText("Tên tuyến"), { target: { value: "Updated ridge" } });
		fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
		await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Đã lưu nháp"));
		expect(screen.getByLabelText("Tên tuyến")).toHaveValue("Updated ridge");
		expect(screen.getByRole("button", { name: "Gửi duyệt" })).toBeEnabled();
		expect(screen.queryByText("Xem trước đường đi của tuyến")).not.toBeInTheDocument();
		expect(trekkingRoutesService.submitForApproval).not.toHaveBeenCalled();
	});

	it("saves current edits before submitting for approval on the same form", async () => {
		let finishSave!: (value: CreatedTrekkingRoute) => void;
		vi.mocked(trekkingRoutesService.updateDraft).mockReturnValue(
			new Promise((resolve) => {
				finishSave = resolve;
			})
		);
		const onSubmitted = vi.fn();
		render(<RouteDraftWorkspace route={route} onSubmitted={onSubmitted} />);
		fireEvent.change(screen.getByLabelText("Tên tuyến"), { target: { value: "Current edits" } });
		fireEvent.click(screen.getByRole("button", { name: "Gửi duyệt" }));
		fireEvent.click(screen.getByRole("button", { name: "Gửi duyệt" }));
		await waitFor(() =>
			expect(trekkingRoutesService.updateDraft).toHaveBeenCalledWith(
				route.id,
				expect.objectContaining({ name: "Current edits" })
			)
		);
		expect(trekkingRoutesService.submitForApproval).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Đang gửi duyệt..." })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
		finishSave({ ...route, name: "Current edits" });
		await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith(pendingRoute));
		expect(trekkingRoutesService.submitForApproval).toHaveBeenCalledWith(route.id);
		expect(trekkingRoutesService.updateDraft).toHaveBeenCalledTimes(1);
		expect(trekkingRoutesService.submitForApproval).toHaveBeenCalledTimes(1);
		expect(screen.getByLabelText("Trạng thái tuyến")).toHaveTextContent("Chờ duyệt");
	});

	it("does not submit when saving fails and preserves form values", async () => {
		vi.mocked(trekkingRoutesService.updateDraft).mockRejectedValue(new Error("offline"));
		render(<RouteDraftWorkspace route={route} />);
		fireEvent.change(screen.getByLabelText("Tên tuyến"), { target: { value: "Keep edits" } });
		fireEvent.click(screen.getByRole("button", { name: "Gửi duyệt" }));
		await screen.findByRole("alert");
		expect(trekkingRoutesService.submitForApproval).not.toHaveBeenCalled();
		expect(screen.getByLabelText("Tên tuyến")).toHaveValue("Keep edits");
	});

	it("creates once and retries approval on the saved route after a submission failure", async () => {
		vi.mocked(trekkingRoutesService.create).mockResolvedValue(route);
		vi.mocked(trekkingRoutesService.submitForApproval)
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce(pendingRoute);
		const onSubmitted = vi.fn();
		render(<RouteDraftWorkspace onSubmitted={onSubmitted} />);
		expect(screen.getByRole("button", { name: "Lưu nháp" })).toBeEnabled();
		fireEvent.change(screen.getByLabelText("Tên tuyến"), { target: { value: "New ridge" } });
		fireEvent.change(screen.getByLabelText("Thời lượng dự kiến (phút)"), {
			target: { value: "120" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Vẽ tuyến đường" }));
		fireEvent.click(screen.getByRole("button", { name: "Gửi duyệt" }));
		await screen.findByRole("alert");
		expect(screen.getByLabelText("Tên tuyến")).toHaveValue("New ridge");
		fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
		await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith(pendingRoute));
		expect(trekkingRoutesService.create).toHaveBeenCalledTimes(1);
		expect(trekkingRoutesService.updateDraft).not.toHaveBeenCalled();
		expect(trekkingRoutesService.submitForApproval).toHaveBeenNthCalledWith(2, route.id);
	});

	it("recognizes successful submission when the response was lost", async () => {
		vi.mocked(trekkingRoutesService.submitForApproval).mockRejectedValue(new Error("offline"));
		vi.mocked(trekkingRoutesService.getMineById).mockResolvedValue(pendingRoute);
		const onSubmitted = vi.fn();
		render(<RouteDraftWorkspace route={route} onSubmitted={onSubmitted} />);
		fireEvent.click(screen.getByRole("button", { name: "Gửi duyệt" }));
		await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith(pendingRoute));
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("retries with corrected current values on the same draft", async () => {
		vi.mocked(trekkingRoutesService.submitForApproval)
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce(pendingRoute);
		const onSubmitted = vi.fn();
		render(<RouteDraftWorkspace route={route} onSubmitted={onSubmitted} />);
		fireEvent.click(screen.getByRole("button", { name: "Gửi duyệt" }));
		await screen.findByRole("alert");
		fireEvent.change(screen.getByLabelText("Tên tuyến"), { target: { value: "Corrected name" } });
		fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
		await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith(pendingRoute));
		expect(trekkingRoutesService.updateDraft).toHaveBeenLastCalledWith(
			route.id,
			expect.objectContaining({ name: "Corrected name" })
		);
		expect(trekkingRoutesService.create).not.toHaveBeenCalled();
	});

	it("keeps the server duration validation when sending for approval", async () => {
		vi.mocked(trekkingRoutesService.updateDraft).mockRejectedValue(
			new HttpError("too short", 422, { code: "ROUTE_DURATION_TOO_SHORT", minimumMinutes: 265 })
		);
		render(<RouteDraftWorkspace route={route} />);
		fireEvent.click(screen.getByRole("button", { name: "Gửi duyệt" }));
		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("265 phút"));
		expect(trekkingRoutesService.submitForApproval).not.toHaveBeenCalled();
		expect(screen.getByLabelText("Tên tuyến")).toHaveValue("Ridge");
	});

	it("does not allow editing or resubmitting a non-draft route", () => {
		render(<RouteDraftWorkspace route={pendingRoute} />);
		expect(screen.getByLabelText("Trạng thái tuyến")).toHaveTextContent("Chờ duyệt");
		expect(screen.queryByLabelText("Tên tuyến")).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Gửi duyệt" })).not.toBeInTheDocument();
	});
});
