import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import type { TripIncidentsApi } from "../services/trip-incidents.service";
import {
	type IncidentQueueStore,
	createMemoryIncidentQueueStore,
} from "../storage/incident-queue.store";
import type { ReportIncidentPayload, TripIncident } from "../types";
import { TripIncidentsPanel } from "./TripIncidentsPanel";

function toServerIncident(payload: ReportIncidentPayload): TripIncident {
	return {
		...payload,
		tripId: "trip-1",
		reporterId: "porter-1",
		reporterName: "Porter",
		status: "open",
		locationStatus: payload.location ? "fresh" : "unavailable",
		media: null,
		receivedAt: new Date().toISOString(),
	};
}

function setOnline(value: boolean) {
	Object.defineProperty(window.navigator, "onLine", { value, configurable: true });
}

function mockGeolocation(succeed: boolean) {
	const getCurrentPosition = vi.fn((success: PositionCallback, failure?: PositionErrorCallback) => {
		if (succeed) {
			success({
				coords: { latitude: 16.054321, longitude: 108.234567, accuracy: 9 },
				timestamp: Date.now(),
			} as GeolocationPosition);
		} else {
			failure?.({ code: 1, message: "denied" } as GeolocationPositionError);
		}
	});
	Object.defineProperty(window.navigator, "geolocation", {
		value: { getCurrentPosition },
		configurable: true,
	});
}

describe("TripIncidentsPanel", () => {
	let store: IncidentQueueStore;
	let serverIncidents: TripIncident[];
	let api: TripIncidentsApi;

	beforeEach(() => {
		localStorage.setItem("authUser", JSON.stringify({ id: "porter-1" }));
		setOnline(true);
		mockGeolocation(true);
		store = createMemoryIncidentQueueStore();
		serverIncidents = [];
		api = {
			report: vi.fn(async (_tripId: string, payload: ReportIncidentPayload) => {
				const incident = toServerIncident(payload);
				if (!serverIncidents.some((item) => item.id === incident.id))
					serverIncidents.push(incident);
				return { outcome: "created" as const, incident };
			}),
			list: vi.fn(async () => ({ items: [...serverIncidents] })),
			uploadMedia: vi.fn(),
		};
	});

	afterEach(() => {
		localStorage.clear();
		setOnline(true);
	});

	function renderPanel(tripStatus: "ongoing" | "published" = "ongoing") {
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		return render(
			<QueryClientProvider client={queryClient}>
				<TripIncidentsPanel tripId="trip-1" tripStatus={tripStatus} store={store} api={api} />
			</QueryClientProvider>
		);
	}

	async function fillAndSubmit(description: string) {
		fireEvent.click(await screen.findByRole("button", { name: /Báo cáo sự cố/ }));
		const form = await screen.findByRole("form", { name: "Báo cáo sự cố" });
		fireEvent.change(within(form).getByLabelText("Mô tả"), { target: { value: description } });
		fireEvent.change(within(form).getByLabelText("Mức độ"), { target: { value: "critical" } });
		await within(form).findByText(/16.05432, 108.23457/);
		fireEvent.submit(form);
	}

	it("saves an offline incident on the device as pending, then syncs it once online (AC3/AC4/AC5)", async () => {
		setOnline(false);
		renderPanel();
		expect(await screen.findByText("Ngoại tuyến")).toBeInTheDocument();

		await fillAndSubmit("Thành viên bị trượt chân ở suối");

		const list = await screen.findByRole("list", { name: "Danh sách sự cố" });
		expect(await within(list).findByText("Chờ đồng bộ")).toBeInTheDocument();
		expect(within(list).queryByText("Đã đồng bộ")).not.toBeInTheDocument();
		expect(
			screen.getByText("Đã lưu sự cố trên thiết bị. Sự cố sẽ được gửi khi có kết nối.")
		).toBeInTheDocument();
		expect(api.report).not.toHaveBeenCalled();

		const [stored] = await store.list("trip-1", "porter-1");
		expect(stored.payload).toMatchObject({
			description: "Thành viên bị trượt chân ở suối",
			severity: "critical",
			capturedOffline: true,
			location: { latitude: 16.054321, longitude: 108.234567, accuracyMeters: 9 },
		});

		setOnline(true);
		act(() => {
			window.dispatchEvent(new Event("online"));
		});

		expect(await within(list).findByText("Đã đồng bộ")).toBeInTheDocument();
		expect(api.report).toHaveBeenCalledTimes(1);
		expect(api.report).toHaveBeenCalledWith("trip-1", stored.payload);
		await waitFor(async () => expect(await store.list("trip-1", "porter-1")).toHaveLength(0));
		expect(within(list).getAllByRole("listitem")).toHaveLength(1);
	});

	it("submits without coordinates when the device cannot locate", async () => {
		mockGeolocation(false);
		renderPanel();

		fireEvent.click(await screen.findByRole("button", { name: /Báo cáo sự cố/ }));
		const form = await screen.findByRole("form", { name: "Báo cáo sự cố" });
		expect(
			await within(form).findByText("Không lấy được vị trí. Sự cố sẽ được gửi không kèm tọa độ.")
		).toBeInTheDocument();
		fireEvent.change(within(form).getByLabelText("Mô tả"), { target: { value: "Cây đổ" } });
		fireEvent.submit(form);

		await waitFor(() => expect(api.report).toHaveBeenCalledTimes(1));
		expect(vi.mocked(api.report).mock.calls[0][1].location).toBeNull();
	});

	it("shows a server rejection as failed with its reason and lets the Porter discard it", async () => {
		api.report = vi
			.fn()
			.mockRejectedValue(new HttpError("x", 409, { code: "INCIDENT_TRIP_NOT_IN_PROGRESS" }));
		renderPanel();

		await fillAndSubmit("Mất liên lạc với đoàn sau");

		expect(await screen.findByText("Đồng bộ thất bại")).toBeInTheDocument();
		expect(
			screen.getByText("Chuyến đi không ở trạng thái cho phép báo cáo sự cố.")
		).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Xóa khỏi thiết bị" }));
		expect(await screen.findByText("Chưa có sự cố nào được báo cáo.")).toBeInTheDocument();
	});

	it("validates the required description", async () => {
		renderPanel();
		fireEvent.click(await screen.findByRole("button", { name: /Báo cáo sự cố/ }));
		const form = await screen.findByRole("form", { name: "Báo cáo sự cố" });
		await within(form).findByText(/16.05432/);
		fireEvent.submit(form);

		expect(await within(form).findByText("Vui lòng mô tả sự cố")).toBeInTheDocument();
		expect(await store.list("trip-1", "porter-1")).toHaveLength(0);
	});

	it("keeps the form and never claims a local save when durable storage fails", async () => {
		store.put = vi.fn().mockRejectedValue(new Error("QuotaExceededError"));
		renderPanel();
		await fillAndSubmit("Báo cáo cần giữ lại khi hết bộ nhớ");
		expect(await screen.findByRole("alert")).toHaveTextContent("Chưa lưu được sự cố trên thiết bị");
		expect(screen.getByRole("form", { name: "Báo cáo sự cố" })).toBeInTheDocument();
		expect(screen.getByLabelText("Mô tả")).toHaveValue("Báo cáo cần giữ lại khi hết bộ nhớ");
		expect(api.report).not.toHaveBeenCalled();
		expect(screen.queryByText(/Đã lưu sự cố trên thiết bị và/)).not.toBeInTheDocument();
	});

	it("does not offer new reports when the Trip is not ongoing (AC1)", async () => {
		renderPanel("published");

		expect(
			await screen.findByText("Chỉ có thể báo cáo sự cố mới khi chuyến đi đang diễn ra.")
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /Báo cáo sự cố/ })).not.toBeInTheDocument();
	});
});
