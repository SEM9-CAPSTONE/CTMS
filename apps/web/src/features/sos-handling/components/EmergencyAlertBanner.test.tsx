import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { OverviewSos } from "../../host-overview/types";
import { EmergencyAlertBanner } from "./EmergencyAlertBanner";

const mockActiveSos: OverviewSos = {
	id: "sos-active-1",
	tripId: "trip-1",
	emergencyType: "medical",
	eventTime: "2026-10-27T03:00:00.000Z",
	receivedAt: "2026-10-27T03:00:01.000Z",
	updatedAt: "2026-10-27T03:00:01.000Z",
	status: "active",
};

describe("EmergencyAlertBanner", () => {
	it("renders when active SOS is present", () => {
		const onNavigate = vi.fn();
		render(<EmergencyAlertBanner alerts={[mockActiveSos]} onNavigateToSosCenter={onNavigate} />);

		expect(screen.getByTestId("emergency-alert-banner")).toBeInTheDocument();
		expect(screen.getByText("Cần ứng cứu khẩn cấp ngay!")).toBeInTheDocument();
		expect(screen.getByText("Sự cố y tế")).toBeInTheDocument();

		const viewAllBtn = screen.getByRole("button", { name: /Tất cả/ });
		fireEvent.click(viewAllBtn);
		expect(onNavigate).toHaveBeenCalled();
	});

	it("returns null when no active SOS is present", () => {
		const { container } = render(<EmergencyAlertBanner alerts={[]} />);
		expect(container.firstChild).toBeNull();
	});
});
