import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SosAlertItem } from "../types";
import { HostSosDetailModal } from "./HostSosDetailModal";

const mockSos: SosAlertItem = {
	id: "e0500000-0000-4000-8000-000000000001",
	tripId: "a1736fee-62be-4991-9478-a62288e9b80a",
	tripTitle: "Trekking Sơn Trà - Bãi Bắc",
	senderId: "camper-1",
	senderName: "Nguyễn Văn Camper",
	senderEmail: "camper@ctms.local",
	emergencyType: "medical",
	location: { latitude: 16.12, longitude: 108.28 },
	batteryLevel: 85,
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
};

describe("HostSosDetailModal", () => {
	it("renders detailed SOS information and triggers action", () => {
		const onClose = vi.fn();
		const onAcknowledge = vi.fn();

		render(
			<HostSosDetailModal
				isOpen={true}
				onClose={onClose}
				sos={mockSos}
				onAcknowledge={onAcknowledge}
			/>
		);

		expect(screen.getByText("Chi tiết yêu cầu cứu trợ")).toBeInTheDocument();
		expect(screen.getByText("Nguyễn Văn Camper")).toBeInTheDocument();
		expect(screen.getByText("Trekking Sơn Trà - Bãi Bắc")).toBeInTheDocument();
		expect(screen.getByText("85%")).toBeInTheDocument();
		expect(screen.getByText("Xem bản đồ")).toBeInTheDocument();

		const ackBtn = screen.getByRole("button", { name: "Tiếp nhận cứu trợ" });
		fireEvent.click(ackBtn);
		expect(onAcknowledge).toHaveBeenCalledWith(mockSos);
		expect(onClose).toHaveBeenCalled();
	});

	it("renders acknowledged SOS with disabled acknowledge button and active close button", () => {
		const onClose = vi.fn();
		const onCloseSos = vi.fn();
		const acknowledgedSos: SosAlertItem = {
			...mockSos,
			status: "acknowledged",
			acknowledgedBy: "host-1",
			acknowledgedByName: "Host Trần",
			acknowledgedAt: "2026-10-27T03:05:00.000Z",
		};

		render(
			<HostSosDetailModal
				isOpen={true}
				onClose={onClose}
				sos={acknowledgedSos}
				onCloseSos={onCloseSos}
			/>
		);

		const disabledBtn = screen.getByRole("button", { name: "Đã tiếp nhận" });
		expect(disabledBtn).toBeDisabled();

		const closeBtn = screen.getByRole("button", { name: "Đóng SOS" });
		fireEvent.click(closeBtn);
		expect(onCloseSos).toHaveBeenCalledWith(acknowledgedSos);
		expect(onClose).toHaveBeenCalled();
	});

	it("renders closed SOS with disabled Đã đóng button", () => {
		const closedSos: SosAlertItem = {
			...mockSos,
			status: "closed",
			closedBy: "host-1",
			closedAt: "2026-10-27T03:10:00.000Z",
			resolutionNote: "Đã an toàn",
		};

		render(<HostSosDetailModal isOpen={true} onClose={vi.fn()} sos={closedSos} />);

		const disabledBtn = screen.getByRole("button", { name: "Đã đóng" });
		expect(disabledBtn).toBeDisabled();
	});

	it("does not render when isOpen is false", () => {
		render(<HostSosDetailModal isOpen={false} onClose={vi.fn()} sos={mockSos} />);

		expect(screen.queryByText("Chi tiết yêu cầu cứu trợ")).not.toBeInTheDocument();
	});
});
