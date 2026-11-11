import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFakeConnection } from "../../../core/realtime/fakeRealtimeSocket.test-utils";
import { useEmergencyBroadcastListener } from "../hooks/useEmergencyBroadcastListener";
import { createEmergencyBroadcastInbox } from "../store/emergencyBroadcastInbox";
import type { EmergencyBroadcastEvent } from "../types";
import { EmergencyBroadcastAlerts } from "./EmergencyBroadcastAlerts";

const event: EmergencyBroadcastEvent = {
	eventId: "b-1",
	broadcastId: "b-1",
	tripId: "trip-1",
	tripTitle: "Khám Phá Bán Đảo Sơn Trà",
	hostId: "host-1",
	alertType: "evacuation",
	content: "Cả đoàn quay về điểm xuất phát ngay.",
	createdAt: "2026-11-08T03:00:00.000Z",
};

let fake: ReturnType<typeof createFakeConnection>;
let inbox: ReturnType<typeof createEmergencyBroadcastInbox>;

function listen(enabled: boolean, userId: string | null = "camper-1") {
	return renderHook(() =>
		useEmergencyBroadcastListener(enabled, userId, { connection: fake.connection, inbox })
	);
}

beforeEach(() => {
	localStorage.setItem("accessToken", "camper-token");
	fake = createFakeConnection();
	inbox = createEmergencyBroadcastInbox();
});

afterEach(() => {
	cleanup();
	localStorage.clear();
});

describe("Emergency broadcast receiving (Camper/Porter)", () => {
	it("shows an urgent banner with type, Trip, content when the alert arrives", () => {
		listen(true);
		render(<EmergencyBroadcastAlerts inbox={inbox} />);
		expect(screen.queryByTestId("emergency-broadcast-alert")).not.toBeInTheDocument();

		act(() => fake.latest().serverEmit("emergency.broadcast", event));

		const banner = screen.getByRole("alert", { name: "Cảnh báo khẩn từ Host" });
		expect(banner).toHaveTextContent("Sơ tán");
		expect(banner).toHaveTextContent("Khám Phá Bán Đảo Sơn Trà");
		expect(banner).toHaveTextContent("Cả đoàn quay về điểm xuất phát ngay.");
	});

	it("shows a redelivered alert only once, even after it was read", () => {
		listen(true);
		render(<EmergencyBroadcastAlerts inbox={inbox} />);
		act(() => fake.latest().serverEmit("emergency.broadcast", event));
		act(() => fake.latest().serverEmit("emergency.broadcast", event));
		expect(screen.getAllByTestId("emergency-broadcast-alert")).toHaveLength(1);

		fireEvent.click(screen.getByRole("button", { name: "Đã đọc" }));
		expect(screen.queryByTestId("emergency-broadcast-alert")).not.toBeInTheDocument();
		act(() => fake.latest().serverEmit("emergency.broadcast", event));
		expect(screen.queryByTestId("emergency-broadcast-alert")).not.toBeInTheDocument();
	});

	it("stacks different alerts newest first", () => {
		listen(true);
		render(<EmergencyBroadcastAlerts inbox={inbox} />);
		act(() => fake.latest().serverEmit("emergency.broadcast", event));
		act(() =>
			fake
				.latest()
				.serverEmit("emergency.broadcast", { ...event, eventId: "b-2", content: "Tin mới hơn" })
		);
		const banners = screen.getAllByTestId("emergency-broadcast-alert");
		expect(banners).toHaveLength(2);
		expect(banners[0]).toHaveTextContent("Tin mới hơn");
	});

	it("ignores the sender's own echo", () => {
		listen(true, "host-1");
		render(<EmergencyBroadcastAlerts inbox={inbox} />);
		act(() => fake.latest().serverEmit("emergency.broadcast", event));
		expect(screen.queryByTestId("emergency-broadcast-alert")).not.toBeInTheDocument();
	});

	it("opens no socket for visitors and other roles", () => {
		listen(false, null);
		expect(fake.sockets).toHaveLength(0);
	});
});
