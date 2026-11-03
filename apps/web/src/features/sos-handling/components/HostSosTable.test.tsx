import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SosAlertItem } from "../types";
import { HostSosTable } from "./HostSosTable";

const mockItems: SosAlertItem[] = [
	{
		id: "sos-1",
		tripId: "trip-1",
		tripTitle: "Trekking Sơn Trà",
		senderId: "camper-1",
		senderName: "Nguyễn Văn A",
		senderEmail: "camper1@ctms.local",
		emergencyType: "medical",
		location: { latitude: 16.05, longitude: 108.2 },
		batteryLevel: 90,
		eventTime: "2026-10-27T03:00:00.000Z",
		status: "active",
		cancelledBy: null,
		cancelledAt: null,
		cancellationReason: null,
		acknowledgedBy: null,
		acknowledgedAt: null,
		closedBy: null,
		closedAt: null,
		resolutionNote: null,
		receivedAt: "2026-10-27T03:00:01.000Z",
		createdAt: "2026-10-27T03:00:01.000Z",
		updatedAt: "2026-10-27T03:00:01.000Z",
	},
	{
		id: "sos-2",
		tripId: "trip-1",
		tripTitle: "Trekking Sơn Trà",
		senderId: "camper-2",
		senderName: "Trần Thị B",
		senderEmail: "camper2@ctms.local",
		emergencyType: "injury",
		location: null,
		batteryLevel: 75,
		eventTime: "2026-10-27T03:15:00.000Z",
		status: "acknowledged",
		cancelledBy: null,
		cancelledAt: null,
		cancellationReason: null,
		acknowledgedBy: "host-1",
		acknowledgedByName: "Host Trần",
		acknowledgedAt: "2026-10-27T03:16:00.000Z",
		closedBy: null,
		closedAt: null,
		resolutionNote: null,
		receivedAt: "2026-10-27T03:15:01.000Z",
		createdAt: "2026-10-27T03:15:01.000Z",
		updatedAt: "2026-10-27T03:16:00.000Z",
	},
];

describe("HostSosTable", () => {
	it("renders table with items and handles action clicks", () => {
		const onViewDetail = vi.fn();
		const onAcknowledge = vi.fn();
		const onCloseSos = vi.fn();

		render(
			<HostSosTable
				items={mockItems}
				total={2}
				page={1}
				limit={10}
				onPageChange={vi.fn()}
				onViewDetail={onViewDetail}
				onAcknowledge={onAcknowledge}
				onCloseSos={onCloseSos}
			/>
		);

		expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
		expect(screen.getByText("Trần Thị B")).toBeInTheDocument();
		expect(screen.getByText("Sự cố y tế")).toBeInTheDocument();
		expect(screen.getByText("Chấn thương")).toBeInTheDocument();

		// Check buttons
		const ackButton = screen.getByRole("button", { name: "Tiếp nhận" });
		fireEvent.click(ackButton);
		expect(onAcknowledge).toHaveBeenCalledWith(mockItems[0]);

		const closeButton = screen.getByRole("button", { name: "Đóng SOS" });
		fireEvent.click(closeButton);
		expect(onCloseSos).toHaveBeenCalledWith(mockItems[1]);

		// View detail button
		const detailButtons = screen.getAllByRole("button", { name: "Xem chi tiết" });
		fireEvent.click(detailButtons[0]);
		expect(onViewDetail).toHaveBeenCalledWith(mockItems[0]);
	});

	it("renders empty state when items is empty", () => {
		render(
			<HostSosTable
				items={[]}
				total={0}
				page={1}
				limit={10}
				onPageChange={vi.fn()}
				onViewDetail={vi.fn()}
				onAcknowledge={vi.fn()}
				onCloseSos={vi.fn()}
			/>
		);

		expect(screen.getByText("Không có yêu cầu cứu trợ nào phù hợp")).toBeInTheDocument();
	});
});
