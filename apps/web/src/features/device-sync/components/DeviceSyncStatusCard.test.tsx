import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deviceSyncService } from "../services/device-sync.service";
import { createMemoryGpsQueueStore } from "../storage/gps-queue.store";
import { DeviceSyncState, type LocalGpsLogRecord } from "../types";
import { DeviceSyncStatusCard } from "./DeviceSyncStatusCard";

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}

describe("DeviceSyncStatusCard (CTMS-067)", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("renders metrics distinguishing local pending from server-confirmed (PB AC-1, AC-2, AC-6, BR-226)", async () => {
		vi.spyOn(deviceSyncService, "getServerStatus").mockResolvedValue({
			tripId: "trip-1",
			userId: "user-1",
			participantRole: "porter",
			serverConfirmedGpsCount: 40,
			serverConfirmedSafetyCount: 2,
			lastReceivedAt: "2026-10-23T10:00:00.000Z",
			packageVersion: "pkg-v2",
			configVersion: "v3",
		});

		const sampleLog: LocalGpsLogRecord = {
			id: "log-1",
			tripId: "trip-1",
			userId: "user-1",
			eventTime: "2026-10-23T10:05:00.000Z",
			latitude: 16.0,
			longitude: 108.0,
			accuracyMeters: 5,
			configVersion: "v3",
			syncState: DeviceSyncState.PENDING,
			savedAt: "2026-10-23T10:05:01.000Z",
		};
		const gpsStore = createMemoryGpsQueueStore([sampleLog]);

		render(<DeviceSyncStatusCard tripId="trip-1" userId="user-1" gpsStore={gpsStore} />, {
			wrapper: createWrapper(),
		});

		// Header
		expect(screen.getByText("Đồng bộ thiết bị")).toBeInTheDocument();

		// Pending count (PB AC-1)
		await waitFor(() => {
			expect(screen.getByText("1")).toBeInTheDocument(); // pending GPS
		});
		expect(screen.getAllByText("Chờ đồng bộ tại thiết bị").length).toBeGreaterThan(0);

		// Server confirmed count (PB AC-6)
		expect(screen.getByText("40")).toBeInTheDocument();
		expect(screen.getAllByText("Máy chủ đã nhận").length).toBeGreaterThan(0);

		// Version context (PB AC-3)
		expect(screen.getByText(/pkg-v2 · v3/)).toBeInTheDocument();

		// Retry button is enabled because 1 pending GPS log exists (PB AC-5)
		const retryBtn = screen.getByTestId("retry-sync-button");
		expect(retryBtn).toBeEnabled();
	});

	it("displays error banner when synchronization error is present (PB AC-4)", async () => {
		vi.spyOn(deviceSyncService, "getServerStatus").mockResolvedValue({
			tripId: "trip-1",
			userId: "user-1",
			participantRole: "porter",
			serverConfirmedGpsCount: 0,
			serverConfirmedSafetyCount: 0,
			lastReceivedAt: null,
			packageVersion: null,
			configVersion: "v3",
		});

		const failedLog: LocalGpsLogRecord = {
			id: "log-fail",
			tripId: "trip-1",
			userId: "user-1",
			eventTime: "2026-10-23T10:05:00.000Z",
			latitude: 16.0,
			longitude: 108.0,
			accuracyMeters: 5,
			configVersion: "v3",
			syncState: DeviceSyncState.FAILED,
			lastError: "Không có kết nối mạng tới máy chủ.",
			savedAt: "2026-10-23T10:05:01.000Z",
		};
		const gpsStore = createMemoryGpsQueueStore([failedLog]);

		render(<DeviceSyncStatusCard tripId="trip-1" userId="user-1" gpsStore={gpsStore} />, {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(screen.getByTestId("sync-error-banner")).toBeInTheDocument();
		});
		expect(screen.getByText("Không có kết nối mạng tới máy chủ.")).toBeInTheDocument();
	});

	it("disables retry button when there are no pending or failed items (PB AC-5)", async () => {
		vi.spyOn(deviceSyncService, "getServerStatus").mockResolvedValue({
			tripId: "trip-1",
			userId: "user-1",
			participantRole: "porter",
			serverConfirmedGpsCount: 10,
			serverConfirmedSafetyCount: 0,
			lastReceivedAt: "2026-10-23T10:00:00.000Z",
			packageVersion: null,
			configVersion: "v3",
		});

		const emptyGpsStore = createMemoryGpsQueueStore([]);

		render(<DeviceSyncStatusCard tripId="trip-1" userId="user-1" gpsStore={emptyGpsStore} />, {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(screen.getByTestId("retry-sync-button")).toBeDisabled();
		});
	});

	it("triggers retry workflow when retry button is clicked (PB AC-5)", async () => {
		const user = userEvent.setup();
		vi.spyOn(deviceSyncService, "getServerStatus").mockResolvedValue({
			tripId: "trip-1",
			userId: "user-1",
			participantRole: "porter",
			serverConfirmedGpsCount: 0,
			serverConfirmedSafetyCount: 0,
			lastReceivedAt: null,
			packageVersion: null,
			configVersion: "v3",
		});

		const uploadSpy = vi.spyOn(deviceSyncService, "uploadGpsLogs").mockResolvedValue({
			results: [{ id: "log-1", status: "accepted" }],
		});

		const sampleLog: LocalGpsLogRecord = {
			id: "log-1",
			tripId: "trip-1",
			userId: "user-1",
			eventTime: "2026-10-23T10:05:00.000Z",
			latitude: 16.0,
			longitude: 108.0,
			accuracyMeters: 5,
			configVersion: "v3",
			syncState: DeviceSyncState.PENDING,
			savedAt: "2026-10-23T10:05:01.000Z",
		};
		const gpsStore = createMemoryGpsQueueStore([sampleLog]);

		render(<DeviceSyncStatusCard tripId="trip-1" userId="user-1" gpsStore={gpsStore} />, {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(screen.getByTestId("retry-sync-button")).toBeEnabled();
		});

		await user.click(screen.getByTestId("retry-sync-button"));

		await waitFor(() => {
			expect(uploadSpy).toHaveBeenCalledWith("trip-1", [expect.objectContaining({ id: "log-1" })]);
		});
	});
});
