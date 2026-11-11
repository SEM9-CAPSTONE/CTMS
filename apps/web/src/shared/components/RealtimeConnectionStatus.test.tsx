import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
	DEFAULT_REALTIME_LABELS,
	RealtimeConnectionStatus,
	type RealtimeDisplayState,
} from "./RealtimeConnectionStatus";

afterEach(cleanup);

describe("RealtimeConnectionStatus (CTMS-078-T02)", () => {
	it("renders nothing without a state", () => {
		const { container } = render(<RealtimeConnectionStatus state={null} />);
		expect(container).toBeEmptyDOMElement();
	});

	it.each(Object.keys(DEFAULT_REALTIME_LABELS) as RealtimeDisplayState[])(
		"labels the %s state",
		(state) => {
			render(<RealtimeConnectionStatus state={state} />);

			const status = screen.getByTestId("realtime-connection-status");
			expect(status).toHaveAttribute("data-state", state);
			expect(status).toHaveTextContent(DEFAULT_REALTIME_LABELS[state]);
		}
	);

	it("uses feature-specific wording when given", () => {
		render(
			<RealtimeConnectionStatus
				state="connected"
				labels={{ connected: "Đang nhận cảnh báo SOS theo thời gian thực" }}
				testId="sos-status"
			/>
		);

		expect(screen.getByTestId("sos-status")).toHaveTextContent(
			"Đang nhận cảnh báo SOS theo thời gian thực"
		);
	});
});
