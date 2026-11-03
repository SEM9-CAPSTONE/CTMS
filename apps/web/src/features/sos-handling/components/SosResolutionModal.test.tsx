import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SosHandlingService } from "../services/sos-handling.service";
import type { SosAlertItem } from "../types";
import { SosResolutionModal } from "./SosResolutionModal";

const mockSampleSos: SosAlertItem = {
	id: "sos-123",
	tripId: "trip-456",
	senderId: "camper-789",
	emergencyType: "medical",
	location: { latitude: 16.05, longitude: 108.2 },
	batteryLevel: 80,
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

describe("SosResolutionModal (CTMS-080, BR-261)", () => {
	it("renders active SOS with acknowledge button and transitions to acknowledged", async () => {
		const mockService: SosHandlingService = {
			acknowledge: vi.fn().mockResolvedValue({
				...mockSampleSos,
				status: "acknowledged",
				acknowledgedBy: "host-1",
				acknowledgedAt: new Date().toISOString(),
			}),
			close: vi.fn(),
			listByTrip: vi.fn(),
			listForHost: vi.fn(),
		};
		const onUpdated = vi.fn();

		render(
			<SosResolutionModal
				isOpen={true}
				onClose={vi.fn()}
				sos={mockSampleSos}
				onUpdated={onUpdated}
				service={mockService}
			/>
		);

		expect(screen.getByText("Y tế khẩn cấp")).toBeInTheDocument();
		expect(screen.getByText("Chờ tiếp nhận")).toBeInTheDocument();
		const ackButton = screen.getByRole("button", { name: "Tiếp nhận SOS" });
		expect(ackButton).toBeInTheDocument();

		fireEvent.click(ackButton);

		await waitFor(() => {
			expect(mockService.acknowledge).toHaveBeenCalledWith("trip-456", "sos-123");
			expect(onUpdated).toHaveBeenCalled();
		});
	});

	it("renders acknowledged SOS with resolution note textarea and close button", async () => {
		const acknowledgedSos: SosAlertItem = {
			...mockSampleSos,
			status: "acknowledged",
			acknowledgedBy: "host-1",
			acknowledgedAt: "2026-10-27T03:02:00.000Z",
		};
		const mockService: SosHandlingService = {
			acknowledge: vi.fn(),
			close: vi.fn().mockResolvedValue({
				...acknowledgedSos,
				status: "closed",
				closedBy: "host-1",
				closedAt: new Date().toISOString(),
				resolutionNote: "Đã cứu hộ xong",
			}),
			listByTrip: vi.fn(),
			listForHost: vi.fn(),
		};
		const onUpdated = vi.fn();
		const onClose = vi.fn();

		render(
			<SosResolutionModal
				isOpen={true}
				onClose={onClose}
				sos={acknowledgedSos}
				onUpdated={onUpdated}
				service={mockService}
			/>
		);

		expect(screen.getByText("Đã tiếp nhận (Đang hỗ trợ)")).toBeInTheDocument();
		const disabledAckButton = screen.getByRole("button", { name: "Đã tiếp nhận" });
		expect(disabledAckButton).toBeDisabled();

		const textarea = screen.getByLabelText("Ghi chú kết quả xử lý");
		const closeButton = screen.getByRole("button", { name: "Đóng SOS" });

		// Disabled when empty
		expect(closeButton).toBeDisabled();

		// Enter note
		fireEvent.change(textarea, {
			target: { value: "Đã điều động porter hỗ trợ và đưa về an toàn" },
		});
		expect(closeButton).not.toBeDisabled();

		fireEvent.click(closeButton);

		await waitFor(() => {
			expect(mockService.close).toHaveBeenCalledWith(
				"trip-456",
				"sos-123",
				"Đã điều động porter hỗ trợ và đưa về an toàn"
			);
			expect(onUpdated).toHaveBeenCalled();
			expect(onClose).toHaveBeenCalled();
		});
	});

	it("translates error to Vietnamese and disables acknowledge button when already acknowledged", async () => {
		const mockService: SosHandlingService = {
			acknowledge: vi.fn().mockRejectedValue({
				error: "SOS_ALREADY_ACKNOWLEDGED",
				message: "SOS alert has already been acknowledged",
			}),
			close: vi.fn(),
			listByTrip: vi.fn(),
			listForHost: vi.fn(),
		};
		const onUpdated = vi.fn();

		render(
			<SosResolutionModal
				isOpen={true}
				onClose={vi.fn()}
				sos={mockSampleSos}
				onUpdated={onUpdated}
				service={mockService}
			/>
		);

		const ackButton = screen.getByRole("button", { name: "Tiếp nhận SOS" });
		fireEvent.click(ackButton);

		await waitFor(() => {
			expect(
				screen.getByText("Yêu cầu cứu trợ này đã được tiếp nhận xử lý trước đó")
			).toBeInTheDocument();
			const disabledAckButton = screen.getByRole("button", { name: "Đã tiếp nhận" });
			expect(disabledAckButton).toBeDisabled();
		});
	});
});
