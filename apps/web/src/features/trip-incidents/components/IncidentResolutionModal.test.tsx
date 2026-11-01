import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TripIncidentsApi } from "../services/trip-incidents.service";
import type { IncidentListItem } from "../types";
import { IncidentResolutionModal } from "./IncidentResolutionModal";

const mockIncident: IncidentListItem = {
	id: "inc-1",
	tripId: "trip-1",
	reporterName: "Porter Bao",
	assignedTo: null,
	assignedToName: null,
	category: "injury",
	severity: "high",
	status: "open",
	description: "Camper fell on steep trail",
	occurredAt: "2026-10-12T04:30:00.000Z",
	location: {
		latitude: 16.05,
		longitude: 108.23,
		accuracyMeters: 8,
		capturedAt: "2026-10-12T04:30:00.000Z",
	},
	locationStatus: "fresh",
	syncState: "synced",
	mediaState: "none",
	mediaUrl: null,
	lastError: null,
};

function createMockApi(overrides: Partial<TripIncidentsApi> = {}): TripIncidentsApi {
	return {
		report: vi.fn(),
		list: vi.fn().mockResolvedValue({ items: [] }),
		uploadMedia: vi.fn(),
		assign: vi.fn().mockResolvedValue({
			...mockIncident,
			assignedTo: "user-2",
			assignedToName: "Lead Porter",
		}),
		updateStatus: vi.fn().mockResolvedValue({
			...mockIncident,
			status: "investigating",
		}),
		listHistory: vi.fn().mockResolvedValue({
			items: [
				{
					id: "act-1",
					incidentId: "inc-1",
					actorId: "user-1",
					actorName: "Porter Bao",
					actorRole: "porter",
					action: "reported",
					fromStatus: null,
					toStatus: "open",
					note: null,
					createdAt: "2026-10-12T04:30:00.000Z",
				},
			],
		}),
		...overrides,
	};
}

describe("IncidentResolutionModal (CTMS-086)", () => {
	it("renders incident details and loads action history", async () => {
		const api = createMockApi();
		render(
			<IncidentResolutionModal
				isOpen={true}
				onClose={vi.fn()}
				incident={mockIncident}
				tripId="trip-1"
				onIncidentUpdated={vi.fn()}
				api={api}
			/>
		);

		expect(screen.getByText("Quản lý sự cố chuyến đi")).toBeInTheDocument();
		expect(screen.getByText("Chấn thương")).toBeInTheDocument();
		expect(screen.getByText("Cao")).toBeInTheDocument();
		expect(screen.getByText("Mở")).toBeInTheDocument();
		expect(screen.getByText("Camper fell on steep trail")).toBeInTheDocument();

		await waitFor(() => {
			expect(api.listHistory).toHaveBeenCalledWith("trip-1", "inc-1");
			expect(screen.getByText("Báo cáo sự cố")).toBeInTheDocument();
		});
	});

	it("updates incident status through valid transition", async () => {
		const api = createMockApi();
		const onUpdated = vi.fn();

		render(
			<IncidentResolutionModal
				isOpen={true}
				onClose={vi.fn()}
				incident={mockIncident}
				tripId="trip-1"
				onIncidentUpdated={onUpdated}
				api={api}
			/>
		);

		const noteInput = screen.getByLabelText(/Ghi chú xử lý/i);
		fireEvent.change(noteInput, { target: { value: "Medical kit dispatched" } });

		const submitBtn = screen.getByRole("button", { name: /Chuyển sang "Đang xử lý"/i });
		fireEvent.click(submitBtn);

		await waitFor(() => {
			expect(api.updateStatus).toHaveBeenCalledWith("trip-1", "inc-1", {
				status: "investigating",
				note: "Medical kit dispatched",
			});
			expect(onUpdated).toHaveBeenCalled();
			expect(
				screen.getByText(/Đã cập nhật trạng thái sự cố sang: Đang xử lý/i)
			).toBeInTheDocument();
		});
	});

	it("assigns handling responsibility to a user", async () => {
		const api = createMockApi();
		const onUpdated = vi.fn();

		render(
			<IncidentResolutionModal
				isOpen={true}
				onClose={vi.fn()}
				incident={mockIncident}
				tripId="trip-1"
				onIncidentUpdated={onUpdated}
				api={api}
			/>
		);

		const assigneeInput = screen.getByLabelText(/Mã người xử lý/i);
		fireEvent.change(assigneeInput, { target: { value: "user-2" } });

		const assignBtn = screen.getByRole("button", { name: /Phân công/i });
		fireEvent.click(assignBtn);

		await waitFor(() => {
			expect(api.assign).toHaveBeenCalledWith("trip-1", "inc-1", {
				assignedTo: "user-2",
				note: undefined,
			});
			expect(onUpdated).toHaveBeenCalled();
			expect(screen.getByText(/Đã phân công người xử lý sự cố/i)).toBeInTheDocument();
		});
	});

	it("shows terminal state message when incident is closed", () => {
		const api = createMockApi();
		const closedIncident: IncidentListItem = { ...mockIncident, status: "closed" };

		render(
			<IncidentResolutionModal
				isOpen={true}
				onClose={vi.fn()}
				incident={closedIncident}
				tripId="trip-1"
				onIncidentUpdated={vi.fn()}
				api={api}
			/>
		);

		expect(
			screen.getByText(
				/Sự cố đã ở trạng thái kết thúc \(Đã đóng\)\. Không thể chuyển trạng thái\./i
			)
		).toBeInTheDocument();
	});

	it("renders error message if updateStatus fails", async () => {
		const api = createMockApi({
			updateStatus: vi.fn().mockRejectedValue(new Error("Trạng thái bị xung đột")),
		});

		render(
			<IncidentResolutionModal
				isOpen={true}
				onClose={vi.fn()}
				incident={mockIncident}
				tripId="trip-1"
				onIncidentUpdated={vi.fn()}
				api={api}
			/>
		);

		const submitBtn = screen.getByRole("button", { name: /Chuyển sang "Đang xử lý"/i });
		fireEvent.click(submitBtn);

		await waitFor(() => {
			expect(screen.getByRole("alert")).toHaveTextContent("Trạng thái bị xung đột");
		});
	});
});
