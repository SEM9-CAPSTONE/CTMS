import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSubmitRouteForApproval } from "../hooks/useSubmitRouteForApproval";
import type { CreatedTrekkingRoute, RouteCheckpoint, RouteStatus } from "../types";
import { RouteSubmissionPanel } from "./RouteSubmissionPanel";

vi.mock("../hooks/useSubmitRouteForApproval", () => ({ useSubmitRouteForApproval: vi.fn() }));

const submit = vi.fn();
const clearError = vi.fn();

function route(status: RouteStatus = "draft"): CreatedTrekkingRoute {
	return {
		id: "route-id",
		name: "Ridge",
		description: null,
		geometry: {
			type: "LineString",
			coordinates: [
				[108.45, 11.94],
				[108.47, 11.94],
			],
		},
		lengthMeters: 2000,
		difficulty: "moderate",
		expectedDurationMinutes: 120,
		status,
		createdAt: "2026-08-28T00:00:00.000Z",
		updatedAt: "2026-08-28T00:00:00.000Z",
	};
}

function checkpoint(
	type: RouteCheckpoint["type"],
	routePosition: number,
	id = `${type}-${routePosition}`
): RouteCheckpoint {
	return {
		id,
		routeId: "route-id",
		name: type,
		location: { type: "Point", coordinates: [108.46, 11.94] },
		radiusMeters: 20,
		type,
		expectedArrivalOffset: 30,
		instructions: type,
		nearbyWaterOrShelter: false,
		routePosition,
		createdAt: "2026-08-28T00:00:00.000Z",
		updatedAt: "2026-08-28T00:00:00.000Z",
	};
}

const readyCheckpoints = [checkpoint("start", 0.0), checkpoint("finish", 1.0)];

function renderPanel(overrides: Partial<Parameters<typeof RouteSubmissionPanel>[0]> = {}) {
	return render(
		<RouteSubmissionPanel
			route={route()}
			checkpoints={readyCheckpoints}
			isLoadingCheckpoints={false}
			checkpointError=""
			onReload={vi.fn()}
			onSubmitted={vi.fn()}
			{...overrides}
		/>
	);
}

describe("RouteSubmissionPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(useSubmitRouteForApproval).mockReturnValue({
			isSubmitting: false,
			error: null,
			submit,
			clearError,
		});
	});

	it("enables submission for one ordered start and finish", () => {
		renderPanel();
		expect(screen.getByRole("button", { name: "Gửi duyệt" })).toBeEnabled();
		expect(screen.getByText("Bắt đầu: 1/1")).toBeInTheDocument();
		expect(screen.getByText("Kết thúc: 1/1")).toBeInTheDocument();
		expect(screen.queryByText("Tuyến chưa đủ điều kiện gửi duyệt.")).not.toBeInTheDocument();
	});

	it("recomputes counters and readiness from a refreshed checkpoint collection", () => {
		const water = checkpoint("water", 0.5);
		const { rerender } = renderPanel({
			checkpoints: [water, checkpoint("finish", 1.0)],
		});
		expect(screen.getByText("Bắt đầu: 0/1")).toBeInTheDocument();
		expect(screen.getByText("Kết thúc: 1/1")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Gửi duyệt" })).toBeDisabled();

		rerender(
			<RouteSubmissionPanel
				route={route()}
				checkpoints={[checkpoint("start", 0.0), checkpoint("finish", 1.0)]}
				isLoadingCheckpoints={false}
				checkpointError=""
				onReload={vi.fn()}
				onSubmitted={vi.fn()}
			/>
		);
		expect(screen.getByText("Bắt đầu: 1/1")).toBeInTheDocument();
		expect(screen.getByText("Kết thúc: 1/1")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Gửi duyệt" })).toBeEnabled();
	});

	it("disables submission and guides host when missing start or finish", () => {
		renderPanel({ checkpoints: [checkpoint("finish", 1.0)] });
		expect(screen.getByRole("button", { name: "Gửi duyệt" })).toBeDisabled();
		expect(screen.getByText("Tuyến chưa đủ điều kiện gửi duyệt.")).toBeInTheDocument();
		expect(screen.getByText("Thiếu điểm Bắt đầu (Start).")).toBeInTheDocument();
	});

	it("disables submission and guides host when missing finish", () => {
		renderPanel({ checkpoints: [checkpoint("start", 0.0)] });
		expect(screen.getByRole("button", { name: "Gửi duyệt" })).toBeDisabled();
		expect(screen.getByText("Tuyến chưa đủ điều kiện gửi duyệt.")).toBeInTheDocument();
		expect(screen.getByText("Thiếu điểm Kết thúc (Finish).")).toBeInTheDocument();
	});

	it("rejects duplicate start checkpoints", () => {
		renderPanel({
			checkpoints: [
				checkpoint("start", 0.0, "s1"),
				checkpoint("start", 0.2, "s2"),
				checkpoint("finish", 1.0),
			],
		});
		expect(screen.getByRole("button", { name: "Gửi duyệt" })).toBeDisabled();
		expect(screen.getByText("Tuyến chỉ được có một điểm Bắt đầu.")).toBeInTheDocument();
	});

	it("rejects duplicate finish checkpoints", () => {
		renderPanel({
			checkpoints: [
				checkpoint("start", 0.0),
				checkpoint("finish", 0.8, "f1"),
				checkpoint("finish", 1.0, "f2"),
			],
		});
		expect(screen.getByRole("button", { name: "Gửi duyệt" })).toBeDisabled();
		expect(screen.getByText("Tuyến chỉ được có một điểm Kết thúc.")).toBeInTheDocument();
	});

	it("rejects start occurring after finish", () => {
		renderPanel({
			checkpoints: [checkpoint("start", 0.9), checkpoint("finish", 0.1)],
		});
		expect(screen.getByRole("button", { name: "Gửi duyệt" })).toBeDisabled();
		expect(
			screen.getByText("Điểm Bắt đầu phải đứng trước điểm Kết thúc trên tuyến.")
		).toBeInTheDocument();
	});

	it("optional location such as water does not satisfy start or finish", () => {
		renderPanel({
			checkpoints: [checkpoint("water", 0.2), checkpoint("dangerous", 0.5)],
		});
		expect(screen.getByRole("button", { name: "Gửi duyệt" })).toBeDisabled();
		expect(screen.getByText("Thiếu điểm Bắt đầu (Start).")).toBeInTheDocument();
		expect(screen.getByText("Thiếu điểm Kết thúc (Finish).")).toBeInTheDocument();
	});

	it.each(["pending_approval", "active", "closed"] as RouteStatus[])(
		"does not expose submission for %s routes",
		(status) => {
			renderPanel({ route: route(status) });
			expect(screen.queryByRole("button", { name: /Gửi duyệt/ })).not.toBeInTheDocument();
		}
	);

	it("shows checkpoint loading and error states without enabling submit", () => {
		const { rerender } = renderPanel({ isLoadingCheckpoints: true });
		expect(screen.getByTestId("submission-readiness-loading")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Gửi duyệt" })).toBeDisabled();

		rerender(
			<RouteSubmissionPanel
				route={route()}
				checkpoints={readyCheckpoints}
				isLoadingCheckpoints={false}
				checkpointError="load failure"
				onReload={vi.fn()}
				onSubmitted={vi.fn()}
			/>
		);
		expect(
			screen.getByText("Không thể xác định mức độ sẵn sàng. Hãy tải lại danh sách điểm dừng.")
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Gửi duyệt" })).toBeDisabled();
	});

	it("disables the action while mutation is pending", () => {
		vi.mocked(useSubmitRouteForApproval).mockReturnValue({
			isSubmitting: true,
			error: null,
			submit,
			clearError,
		});
		renderPanel();
		expect(screen.getByRole("button", { name: "Đang gửi duyệt..." })).toBeDisabled();
	});

	it("submits once and reports only the authoritative pending response", async () => {
		const user = userEvent.setup();
		const onSubmitted = vi.fn();
		submit.mockResolvedValue(route("pending_approval"));
		renderPanel({ onSubmitted });

		await user.click(screen.getByRole("button", { name: "Gửi duyệt" }));

		expect(submit).toHaveBeenCalledWith("route-id");
		expect(submit).toHaveBeenCalledTimes(1);
		expect(onSubmitted).toHaveBeenCalledWith(
			expect.objectContaining({ status: "pending_approval" })
		);
	});

	it.each([
		"Bạn không có quyền gửi duyệt tuyến đường này.",
		"Trạng thái tuyến đường đã thay đổi.",
		"Tuyến phải có đúng một điểm kết thúc.",
	])("shows mapped API feedback: %s", (message) => {
		vi.mocked(useSubmitRouteForApproval).mockReturnValue({
			isSubmitting: false,
			error: { message },
			submit,
			clearError,
		});
		renderPanel();
		expect(screen.getByRole("alert")).toHaveTextContent(message);
	});
});
