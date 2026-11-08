import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api/httpClient";
import { createFakeConnection } from "../../../core/realtime/fakeRealtimeSocket.test-utils";
import type { EmergencyBroadcastsService } from "../services/emergency-broadcasts.service";
import type { EmergencyBroadcast } from "../types";
import { ReceivedEmergencyBroadcastsCard } from "./ReceivedEmergencyBroadcastsCard";

const TRIP_ID = "trip-1";
const received = (id: string, content: string, createdAt: string): EmergencyBroadcast => ({
	id,
	tripId: TRIP_ID,
	hostId: "host-1",
	alertType: "route_hazard",
	content,
	recipientCount: null,
	createdAt,
});

let fake: ReturnType<typeof createFakeConnection>;

function renderCard(list: EmergencyBroadcastsService["list"], enabled = true) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
	return render(
		<ReceivedEmergencyBroadcastsCard
			tripId={TRIP_ID}
			enabled={enabled}
			service={{ list, create: vi.fn() }}
			connection={fake.connection}
		/>,
		{ wrapper }
	);
}

beforeEach(() => {
	localStorage.setItem("accessToken", "camper-token");
	fake = createFakeConnection();
});

afterEach(() => {
	cleanup();
	localStorage.clear();
});

describe("ReceivedEmergencyBroadcastsCard", () => {
	it("recovers alerts sent while offline and highlights the newest", async () => {
		renderCard(
			vi
				.fn()
				.mockResolvedValue([
					received("b-2", "Sạt lở ở km 3, đi đường vòng.", "2026-11-08T04:00:00.000Z"),
					received("b-1", "Đường trơn, đi chậm.", "2026-11-08T03:00:00.000Z"),
				])
		);
		const latest = await screen.findByTestId("received-emergency-broadcast-latest");
		expect(latest).toHaveTextContent("Nguy hiểm trên tuyến");
		expect(latest).toHaveTextContent("Sạt lở ở km 3, đi đường vòng.");
		expect(screen.getByTestId("received-emergency-broadcast-item")).toHaveTextContent(
			"Đường trơn, đi chậm."
		);
		expect(screen.queryByText(/người nhận/)).not.toBeInTheDocument();
	});

	it("renders nothing when there is no alert or the list cannot be read", async () => {
		const list = vi.fn().mockResolvedValue([]);
		const { container } = renderCard(list);
		await vi.waitFor(() => expect(list).toHaveBeenCalled());
		expect(container).toBeEmptyDOMElement();
		cleanup();
		const failing = vi.fn().mockRejectedValue(new HttpError("x", 404, {}));
		const second = renderCard(failing);
		await vi.waitFor(() => expect(failing).toHaveBeenCalled());
		expect(second.container).toBeEmptyDOMElement();
	});

	it("shows a new alert as soon as the socket announces it", async () => {
		const list = vi
			.fn()
			.mockResolvedValueOnce([])
			.mockResolvedValue([received("b-3", "Dừng lại chờ Porter.", "2026-11-08T05:00:00.000Z")]);
		renderCard(list);
		await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(1));
		await act(async () => {}); // let the socket listener effect run before the server frame
		act(() => fake.latest().serverEmit("emergency.broadcast", { eventId: "b-3", tripId: TRIP_ID }));
		expect(await screen.findByText("Dừng lại chờ Porter.")).toBeInTheDocument();
	});

	it("fetches nothing when disabled", () => {
		const list = vi.fn();
		const { container } = renderCard(list, false);
		expect(container).toBeEmptyDOMElement();
		expect(list).not.toHaveBeenCalled();
	});
});
