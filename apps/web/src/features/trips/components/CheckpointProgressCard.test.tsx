import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as hookModule from "../hooks/useConfirmCheckpointArrival";
import type { TripOperationalProgress } from "../types";
import { CheckpointProgressCard } from "./CheckpointProgressCard";

vi.mock("../hooks/useConfirmCheckpointArrival");

function wrapper({ children }: { children: ReactNode }) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const sampleProgress: TripOperationalProgress = {
	tripId: "trip-1",
	status: "ongoing",
	totalCheckpoints: 2,
	visitedCheckpoints: 1,
	progressPercentage: 50,
	lastVisitedCheckpoint: {
		checkpointId: "cp-1",
		name: "Trạm Dừng Chân 1",
		arrivedAt: "2026-10-24T10:00:00.000Z",
		confirmedById: "porter-1",
	},
	checkpoints: [
		{
			checkpointId: "cp-1",
			name: "Trạm Dừng Chân 1",
			type: "rest",
			routePosition: 0.3,
			radiusMeters: 50,
			status: "arrival_confirmed",
			arrivedAt: "2026-10-24T10:00:00.000Z",
			confirmedById: "porter-1",
			visitedMembersCount: 4,
			totalJoinedMembersCount: 4,
			visits: [],
		},
		{
			checkpointId: "cp-2",
			name: "Đỉnh Núi",
			type: "finish",
			routePosition: 1.0,
			radiusMeters: 50,
			status: "not_visited",
			arrivedAt: null,
			confirmedById: null,
			visitedMembersCount: 0,
			totalJoinedMembersCount: 4,
			visits: [],
		},
	],
};

describe("CheckpointProgressCard (CTMS-056 / BR-234)", () => {
	const mockConfirmArrival = vi.fn();
	const mockSyncOfflineArrivals = vi.fn();
	const mockRefetchProgress = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(hookModule.useConfirmCheckpointArrival).mockReturnValue({
			progress: sampleProgress,
			isProgressLoading: false,
			progressError: null,
			refetchProgress: mockRefetchProgress,
			confirmArrival: mockConfirmArrival,
			isConfirming: false,
			confirmError: null,
			pendingOfflineCount: 0,
			pendingQueue: [],
			syncOfflineArrivals: mockSyncOfflineArrivals,
			isSyncing: false,
			syncError: null,
		});
	});

	it("renders the progress overview and checkpoint list", () => {
		render(<CheckpointProgressCard tripId="trip-1" />, { wrapper });

		expect(screen.getByText("Tiến độ hành trình")).toBeInTheDocument();
		expect(screen.getByText("1 / 2 điểm kiểm soát")).toBeInTheDocument();
		expect(screen.getByText("50%")).toBeInTheDocument();

		expect(screen.getByText("Trạm Dừng Chân 1")).toBeInTheDocument();
		expect(screen.getByText("Đã đến")).toBeInTheDocument();

		expect(screen.getByText("Đỉnh Núi")).toBeInTheDocument();
		expect(screen.getByText("Chưa đến")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Xác nhận đến/i })).toBeInTheDocument();
	});

	it("shows loading indicator while progress is being fetched", () => {
		vi.mocked(hookModule.useConfirmCheckpointArrival).mockReturnValue({
			progress: undefined,
			isProgressLoading: true,
			progressError: null,
			refetchProgress: mockRefetchProgress,
			confirmArrival: mockConfirmArrival,
			isConfirming: false,
			confirmError: null,
			pendingOfflineCount: 0,
			pendingQueue: [],
			syncOfflineArrivals: mockSyncOfflineArrivals,
			isSyncing: false,
			syncError: null,
		});

		render(<CheckpointProgressCard tripId="trip-1" />, { wrapper });
		expect(screen.getByText("Đang tải tiến độ hành trình...")).toBeInTheDocument();
	});

	it("shows error state when fetching fails", () => {
		vi.mocked(hookModule.useConfirmCheckpointArrival).mockReturnValue({
			progress: undefined,
			isProgressLoading: false,
			progressError: new Error("Network error"),
			refetchProgress: mockRefetchProgress,
			confirmArrival: mockConfirmArrival,
			isConfirming: false,
			confirmError: null,
			pendingOfflineCount: 0,
			pendingQueue: [],
			syncOfflineArrivals: mockSyncOfflineArrivals,
			isSyncing: false,
			syncError: null,
		});

		render(<CheckpointProgressCard tripId="trip-1" />, { wrapper });
		expect(screen.getByText("Không thể tải tiến độ hành trình.")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
	});

	it("confirms checkpoint arrival when button is clicked", async () => {
		mockConfirmArrival.mockResolvedValueOnce({
			success: true,
			offline: false,
			progress: sampleProgress,
		});

		render(<CheckpointProgressCard tripId="trip-1" />, { wrapper });

		const confirmBtn = screen.getByRole("button", { name: /Xác nhận đến/i });
		fireEvent.click(confirmBtn);

		expect(mockConfirmArrival).toHaveBeenCalledWith({
			checkpointId: "cp-2",
			checkpointName: "Đỉnh Núi",
		});
	});

	it("displays offline banner and triggers sync when pending offline items exist", () => {
		vi.mocked(hookModule.useConfirmCheckpointArrival).mockReturnValue({
			progress: sampleProgress,
			isProgressLoading: false,
			progressError: null,
			refetchProgress: mockRefetchProgress,
			confirmArrival: mockConfirmArrival,
			isConfirming: false,
			confirmError: null,
			pendingOfflineCount: 2,
			pendingQueue: [
				{
					id: "off-1",
					tripId: "trip-1",
					checkpointId: "cp-2",
					checkpointName: "Đỉnh Núi",
					porterId: "porter-1",
					arrivedAt: "2026-10-24T11:00:00.000Z",
					location: null,
					syncStatus: "pending",
					createdAt: "2026-10-24T11:00:00.000Z",
				},
			],
			syncOfflineArrivals: mockSyncOfflineArrivals,
			isSyncing: false,
			syncError: null,
		});

		render(<CheckpointProgressCard tripId="trip-1" />, { wrapper });

		expect(screen.getByRole("status")).toHaveTextContent(
			/Có 2 điểm danh đang chờ đồng bộ ngoại tuyến/i
		);

		const syncBtn = screen.getByRole("button", { name: /Đồng bộ ngay/i });
		fireEvent.click(syncBtn);
		expect(mockSyncOfflineArrivals).toHaveBeenCalled();
	});
});
