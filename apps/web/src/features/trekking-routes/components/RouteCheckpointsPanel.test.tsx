import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateRouteCheckpoint } from "../hooks/useCreateRouteCheckpoint";
import { useCreateRouteDangerZone } from "../hooks/useCreateRouteDangerZone";
import { useRouteCheckpoints } from "../hooks/useRouteCheckpoints";
import { useRouteDangerZones } from "../hooks/useRouteDangerZones";
import { useUpdateRouteCheckpoint } from "../hooks/useUpdateRouteCheckpoint";
import type { CreatedTrekkingRoute, RouteCheckpoint } from "../types";
import { RouteCheckpointsPanel } from "./RouteCheckpointsPanel";

vi.mock("../hooks/useRouteCheckpoints", () => ({ useRouteCheckpoints: vi.fn() }));
vi.mock("../hooks/useCreateRouteCheckpoint", () => ({ useCreateRouteCheckpoint: vi.fn() }));
vi.mock("../hooks/useRouteDangerZones", () => ({ useRouteDangerZones: vi.fn() }));
vi.mock("../hooks/useCreateRouteDangerZone", () => ({ useCreateRouteDangerZone: vi.fn() }));
vi.mock("../hooks/useUpdateRouteCheckpoint", () => ({ useUpdateRouteCheckpoint: vi.fn() }));
vi.mock("./RouteCheckpointMap", () => ({
	RouteCheckpointMap: ({
		disabled,
		mode,
		selectedLocation,
		onSelectLocation,
	}: {
		disabled?: boolean;
		mode?: string;
		selectedLocation?: { type: "Point"; coordinates: [number, number] };
		onSelectLocation: (location: { type: "Point"; coordinates: [number, number] }) => void;
	}) => (
		<div
			data-testid="panel-map"
			data-disabled={String(Boolean(disabled))}
			data-mode={mode}
			data-selected={selectedLocation?.coordinates.join(",") ?? ""}
		>
			{[
				[108.45, 11.94],
				[108.46, 11.95],
				[108.47, 11.94],
			].map((coordinates, index) => (
				<button
					key={coordinates.join("-")}
					type="button"
					onClick={() =>
						onSelectLocation({ type: "Point", coordinates: coordinates as [number, number] })
					}
				>
					Chọn điểm bản đồ {index + 1}
				</button>
			))}
		</div>
	),
}));
vi.mock("./CreateCheckpointForm", () => ({
	CreateCheckpointForm: ({
		disabled,
		checkpoint,
		onSubmit,
		onCreated,
		onCancel,
		onSelectDangerArea,
	}: {
		disabled: boolean;
		onSelectDangerArea?: () => void;
		checkpoint?: RouteCheckpoint;
		onSubmit: (payload: RouteCheckpoint) => Promise<RouteCheckpoint | null>;
		onCreated: () => void;
		onCancel?: () => void;
	}) => (
		<div>
			<button
				type="button"
				disabled={disabled}
				onClick={async () => {
					if (!checkpoint) return;
					const saved = await onSubmit(checkpoint);
					if (saved) onCreated();
				}}
			>
				{checkpoint ? "Lưu thay đổi" : "Thêm điểm dừng"}
			</button>
			{checkpoint && (
				<button type="button" onClick={onCancel}>
					Hủy chỉnh điểm dừng
				</button>
			)}
			<button type="button" onClick={onSelectDangerArea}>
				Chọn khu vực nguy hiểm
			</button>
		</div>
	),
}));
const toastSuccess = vi.hoisted(() => vi.fn());
const mockRouteSubmissionPanel = vi.hoisted(() => vi.fn());
vi.mock("../../../shared/components/Toast", () => ({
	useToast: () => ({ success: toastSuccess }),
}));
vi.mock("./RouteSubmissionPanel", () => ({
	RouteSubmissionPanel: (props: unknown) => {
		mockRouteSubmissionPanel(props);
		return null;
	},
}));

const checkpoint: RouteCheckpoint = {
	id: "checkpoint-id",
	routeId: "route-one",
	name: "Rest",
	location: { type: "Point", coordinates: [108.46, 11.94] },
	radiusMeters: 30,
	type: "rest",
	expectedArrivalOffset: 30,
	instructions: "Rest here",
	nearbyWaterOrShelter: false,
	routePosition: 0.5,
	createdAt: "2026-08-25T00:00:00.000Z",
	updatedAt: "2026-08-25T00:00:00.000Z",
};

function route(id: string, status: CreatedTrekkingRoute["status"]): CreatedTrekkingRoute {
	return {
		id,
		name: id,
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
		createdAt: "2026-08-25T00:00:00.000Z",
		updatedAt: "2026-08-25T00:00:00.000Z",
	};
}

describe("RouteCheckpointsPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(useRouteCheckpoints).mockReturnValue({
			items: [checkpoint],
			isLoading: false,
			error: "",
			reload: vi.fn(),
		});
		vi.mocked(useCreateRouteCheckpoint).mockReturnValue({
			submit: vi.fn(),
			isSubmitting: false,
			error: "",
		});
		vi.mocked(useUpdateRouteCheckpoint).mockReturnValue({
			submit: vi.fn().mockResolvedValue(checkpoint),
			isSubmitting: false,
			error: "",
		});
		vi.mocked(useRouteDangerZones).mockReturnValue({
			items: [],
			isLoading: false,
			error: "",
			reload: vi.fn(),
		});
		vi.mocked(useCreateRouteDangerZone).mockReturnValue({
			submit: vi.fn(),
			isSubmitting: false,
			error: "",
		});
	});

	it("loads the selected route, enables draft create, and preserves the server list", () => {
		render(
			<RouteCheckpointsPanel
				route={route("route-one", "draft")}
				onRouteReload={vi.fn()}
				onRouteSubmitted={vi.fn()}
			/>
		);
		expect(useRouteCheckpoints).toHaveBeenCalledWith("route-one");
		expect(screen.getByRole("button", { name: "Thêm điểm dừng" })).toBeEnabled();
		expect(screen.getByText("Rest")).toBeInTheDocument();
		expect(screen.getByTestId("panel-map")).toHaveAttribute("data-disabled", "false");
		expect(screen.getByTestId("panel-map")).toHaveAttribute("data-mode", "checkpoint");
		expect(screen.getByTestId("danger-zones-empty")).toBeInTheDocument();
	});

	it("snaps an off-route map click onto the route line", () => {
		render(
			<RouteCheckpointsPanel
				route={route("route-one", "draft")}
				onRouteReload={vi.fn()}
				onRouteSubmitted={vi.fn()}
			/>
		);
		fireEvent.click(screen.getByRole("button", { name: "Chọn điểm bản đồ 2" }));
		expect(screen.getByTestId("panel-map")).toHaveAttribute("data-selected", "108.46,11.94");
	});

	it("exposes edit, shows the current map location, and cancel leaves the server item unchanged", () => {
		const updateSubmit = vi.fn().mockResolvedValue(checkpoint);
		vi.mocked(useUpdateRouteCheckpoint).mockReturnValue({
			submit: updateSubmit,
			isSubmitting: false,
			error: "",
		});
		render(
			<RouteCheckpointsPanel
				route={route("route-one", "draft")}
				onRouteReload={vi.fn()}
				onRouteSubmitted={vi.fn()}
			/>
		);
		fireEvent.click(screen.getByRole("button", { name: "Sửa" }));
		expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeEnabled();
		expect(screen.getByTestId("panel-map")).toHaveAttribute("data-selected", "108.46,11.94");
		fireEvent.click(screen.getByRole("button", { name: "Hủy chỉnh điểm dừng" }));
		expect(screen.getByRole("button", { name: "Thêm điểm dừng" })).toBeEnabled();
		expect(screen.getByText("Rest")).toBeInTheDocument();
		expect(updateSubmit).not.toHaveBeenCalled();
	});

	it("saves an edit and exits edit mode only after the update resolves", async () => {
		let resolve!: (value: RouteCheckpoint) => void;
		const updateSubmit = vi.fn().mockReturnValue(
			new Promise<RouteCheckpoint>((done) => {
				resolve = done;
			})
		);
		vi.mocked(useUpdateRouteCheckpoint).mockReturnValue({
			submit: updateSubmit,
			isSubmitting: false,
			error: "",
		});
		render(
			<RouteCheckpointsPanel
				route={route("route-one", "draft")}
				onRouteReload={vi.fn()}
				onRouteSubmitted={vi.fn()}
			/>
		);
		fireEvent.click(screen.getByRole("button", { name: "Sửa" }));
		fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
		expect(updateSubmit).toHaveBeenCalledWith("checkpoint-id", checkpoint);
		expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeInTheDocument();
		resolve(checkpoint);
		await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã cập nhật vị trí."));
		expect(screen.getByRole("button", { name: "Thêm điểm dừng" })).toBeInTheDocument();
	});

	it("switches explicit map modes and renders hazard loading/error/retry/success states", () => {
		const reload = vi.fn();
		vi.mocked(useRouteDangerZones).mockReturnValue({
			items: [],
			isLoading: true,
			error: "",
			reload,
		});
		const props = {
			route: route("route-one", "draft"),
			onRouteReload: vi.fn(),
			onRouteSubmitted: vi.fn(),
		};
		const { rerender } = render(<RouteCheckpointsPanel {...props} />);
		expect(screen.getByText("Đang tải khu vực nguy hiểm...")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Chọn khu vực nguy hiểm" }));
		expect(screen.getByTestId("panel-map")).toHaveAttribute("data-mode", "hazard-polygon");

		vi.mocked(useRouteDangerZones).mockReturnValue({
			items: [],
			isLoading: false,
			error: "hazard load failure",
			reload,
		});
		rerender(<RouteCheckpointsPanel {...props} />);
		expect(screen.getByRole("alert")).toHaveTextContent("hazard load failure");
		fireEvent.click(screen.getByRole("button", { name: "Tải lại khu vực nguy hiểm" }));
		expect(reload).toHaveBeenCalledTimes(1);

		vi.mocked(useRouteDangerZones).mockReturnValue({
			items: [
				{
					id: "zone-id",
					routeId: "route-one",
					geometry: { type: "Point", coordinates: [108.46, 11.94] },
					radiusMeters: 30,
					description: "Loose rock",
					severity: "high",
					createdAt: "2026-09-04T00:00:00.000Z",
					updatedAt: "2026-09-04T00:00:00.000Z",
				},
			],
			isLoading: false,
			error: "",
			reload,
		});
		rerender(<RouteCheckpointsPanel {...props} />);
		expect(screen.getByText("Loose rock")).toBeInTheDocument();
	});

	it("switches to the danger area form from the Vị trí dropdown and back on cancel", () => {
		render(
			<RouteCheckpointsPanel
				route={route("route-one", "draft")}
				onRouteReload={vi.fn()}
				onRouteSubmitted={vi.fn()}
			/>
		);
		expect(screen.queryByText("Thêm khu vực nguy hiểm")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Chọn khu vực nguy hiểm" }));
		expect(screen.queryByRole("button", { name: "Thêm điểm dừng" })).not.toBeInTheDocument();
		expect(screen.getByLabelText("Vị trí")).toHaveValue("danger_area");
		for (const index of [1, 2, 3]) {
			fireEvent.click(screen.getByRole("button", { name: `Chọn điểm bản đồ ${index}` }));
		}
		expect(screen.getByText("3 đỉnh đã chọn")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Hoàn tất khu vực" }));
		fireEvent.click(screen.getByRole("button", { name: "Hoàn tác đỉnh" }));
		expect(screen.getByText("2 đỉnh đã chọn")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Xóa khu vực" }));
		expect(screen.getByText("0 đỉnh đã chọn")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
		expect(screen.getByTestId("panel-map")).toHaveAttribute("data-mode", "checkpoint");
		expect(screen.getByRole("button", { name: "Thêm điểm dừng" })).toBeInTheDocument();
	});

	it.each(["pending_approval", "active", "closed"] as const)(
		"reloads for a switched %s route and keeps checkpoints viewable while create is disabled",
		(status) => {
			const onRouteReload = vi.fn();
			const { rerender } = render(
				<RouteCheckpointsPanel
					route={route("route-one", "draft")}
					onRouteReload={onRouteReload}
					onRouteSubmitted={vi.fn()}
				/>
			);
			rerender(
				<RouteCheckpointsPanel
					route={route("route-two", status)}
					onRouteReload={onRouteReload}
					onRouteSubmitted={vi.fn()}
				/>
			);
			expect(useRouteCheckpoints).toHaveBeenLastCalledWith("route-two");
			expect(screen.getByText("Đang chờ duyệt")).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Thêm điểm dừng" })).toBeDisabled();
			expect(screen.getByText("Rest")).toBeInTheDocument();
			expect(screen.getByTestId("panel-map")).toHaveAttribute("data-disabled", "true");
		}
	);

	it("renders checkpoint loading, error/retry, and empty states", () => {
		const reload = vi.fn();
		vi.mocked(useRouteCheckpoints).mockReturnValue({
			items: [],
			isLoading: true,
			error: "",
			reload,
		});
		const props = {
			route: route("route-one", "draft"),
			onRouteReload: vi.fn(),
			onRouteSubmitted: vi.fn(),
		};
		const { rerender } = render(<RouteCheckpointsPanel {...props} />);
		expect(screen.getByText("Đang tải vị trí...")).toBeInTheDocument();

		vi.mocked(useRouteCheckpoints).mockReturnValue({
			items: [],
			isLoading: false,
			error: "checkpoint load failure",
			reload,
		});
		rerender(<RouteCheckpointsPanel {...props} />);
		expect(screen.getByRole("alert")).toHaveTextContent("checkpoint load failure");
		fireEvent.click(screen.getByRole("button", { name: "Tải lại" }));
		expect(reload).toHaveBeenCalledTimes(1);

		vi.mocked(useRouteCheckpoints).mockReturnValue({
			items: [],
			isLoading: false,
			error: "",
			reload,
		});
		rerender(<RouteCheckpointsPanel {...props} />);
		expect(screen.getByTestId("checkpoints-empty")).toBeInTheDocument();
	});

	it("passes loaded checkpoints to RouteSubmissionPanel", () => {
		render(
			<RouteCheckpointsPanel
				route={route("route-one", "draft")}
				onRouteReload={vi.fn()}
				onRouteSubmitted={vi.fn()}
			/>
		);
		expect(mockRouteSubmissionPanel).toHaveBeenCalledWith(
			expect.objectContaining({
				checkpoints: [checkpoint],
				isLoadingCheckpoints: false,
				checkpointError: "",
			})
		);
	});

	it("selects start and finish route endpoints using quick select buttons", () => {
		render(
			<RouteCheckpointsPanel
				route={route("route-one", "draft")}
				onRouteReload={vi.fn()}
				onRouteSubmitted={vi.fn()}
			/>
		);
		fireEvent.click(screen.getByRole("button", { name: "📍 Điểm đầu tuyến (Start)" }));
		expect(screen.getByTestId("panel-map")).toHaveAttribute("data-selected", "108.45,11.94");

		fireEvent.click(screen.getByRole("button", { name: "🏁 Điểm cuối tuyến (Finish)" }));
		expect(screen.getByTestId("panel-map")).toHaveAttribute("data-selected", "108.47,11.94");
	});
});
