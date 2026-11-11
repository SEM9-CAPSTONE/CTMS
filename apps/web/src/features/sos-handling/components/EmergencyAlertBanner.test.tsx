import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { OverviewSos } from "../../host-overview/types";
import { EmergencyAlertBanner } from "./EmergencyAlertBanner";

const mockActiveSos: OverviewSos = {
	id: "sos-active-1",
	tripId: "trip-1",
	tripTitle: "Trekking Sơn Trà",
	senderName: "Nguyễn Văn Camper",
	emergencyType: "medical",
	eventTime: "2026-10-27T03:00:00.000Z",
	receivedAt: "2026-10-27T03:00:01.000Z",
	updatedAt: "2026-10-27T03:00:01.000Z",
	status: "active",
};

describe("EmergencyAlertBanner", () => {
	it("renders when active SOS is present with sender and trip title", () => {
		const onNavigate = vi.fn();
		render(<EmergencyAlertBanner alerts={[mockActiveSos]} onNavigateToSosCenter={onNavigate} />);

		expect(screen.getByTestId("emergency-alert-banner")).toBeInTheDocument();
		expect(screen.getByText("Cần ứng cứu khẩn cấp ngay!")).toBeInTheDocument();
		expect(screen.getByText("Sự cố y tế")).toBeInTheDocument();
		expect(screen.getByText("Nguyễn Văn Camper")).toBeInTheDocument();
		expect(screen.getByText("Trekking Sơn Trà")).toBeInTheDocument();

		const viewAllBtn = screen.getByRole("button", { name: /Tất cả/ });
		fireEvent.click(viewAllBtn);
		expect(onNavigate).toHaveBeenCalled();
	});

	it("falls back to trip title from trips prop when not directly on SOS", () => {
		const alertWithoutDetails: OverviewSos = {
			...mockActiveSos,
			tripTitle: undefined,
			senderName: undefined,
		};
		render(
			<EmergencyAlertBanner
				alerts={[alertWithoutDetails]}
				trips={[{ id: "trip-1", title: "Tà Năng - Phan Dũng" } as never]}
			/>
		);
		expect(screen.getByText("Tà Năng - Phan Dũng")).toBeInTheDocument();
	});

	it("falls back to short tripId when no title is available", () => {
		const alertWithoutDetails: OverviewSos = {
			...mockActiveSos,
			tripId: "a1736fee-1234-5678-90ab-cdef12345678",
			tripTitle: undefined,
			senderName: undefined,
		};
		render(<EmergencyAlertBanner alerts={[alertWithoutDetails]} />);
		expect(screen.getByText("Mã chuyến: a1736fee")).toBeInTheDocument();
	});

	it("returns null when no active SOS is present", () => {
		const { container } = render(<EmergencyAlertBanner alerts={[]} />);
		expect(container.firstChild).toBeNull();
	});
});
