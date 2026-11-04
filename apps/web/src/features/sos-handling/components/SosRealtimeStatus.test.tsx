import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SosRealtimeState } from "../hooks/useHostSosRealtime";
import { SosRealtimeStatus } from "./SosRealtimeStatus";

const mocks = vi.hoisted(() => ({ state: null as SosRealtimeState | null }));
vi.mock("./HostSosRealtimeProvider", () => ({ useSosRealtimeState: () => mocks.state }));

afterEach(() => {
	cleanup();
	mocks.state = null;
});

describe("SosRealtimeStatus (CTMS-079-T02 / CTMS-078-T02)", () => {
	it("renders nothing outside a Host SOS session", () => {
		const { container } = render(<SosRealtimeStatus />);
		expect(container).toBeEmptyDOMElement();
	});

	it.each<[SosRealtimeState, string, string]>([
		["connecting", "connecting", "Đang kết nối cảnh báo SOS…"],
		["live", "connected", "Đang nhận cảnh báo SOS theo thời gian thực"],
		["reconnecting", "reconnecting", "Mất kết nối — đang kết nối lại…"],
		[
			"disconnected",
			"disconnected",
			"Mất kết nối thời gian thực — đang thử lại, danh sách vẫn tự cập nhật định kỳ",
		],
		["auth_rejected", "auth_rejected", "Phiên đăng nhập hết hạn — đang khôi phục phiên…"],
		["recovered", "recovered", "Đã kết nối lại — đã tải lại các SOS có thể bị lỡ"],
	])("shows the %s delivery state", (state, displayState, label) => {
		mocks.state = state;
		render(<SosRealtimeStatus />);

		const status = screen.getByTestId("sos-realtime-status");
		expect(status).toHaveAttribute("data-state", displayState);
		expect(status).toHaveTextContent(label);
	});
});
