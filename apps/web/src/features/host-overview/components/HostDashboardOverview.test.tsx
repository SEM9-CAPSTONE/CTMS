import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { overviewFixture } from "../../../../tests/fixtures/host-overview";
import { HttpError } from "../../../core/api/httpClient";
import { queryKeys } from "../../../core/api/queryKeys";
import { OVERVIEW_TEXT as text } from "../constants";
import { hostOverviewService } from "../services/host-overview.service";
import { HostDashboardOverview } from "./HostDashboardOverview";

vi.mock("../services/host-overview.service", () => ({ hostOverviewService: { get: vi.fn() } }));

function show(hostId = "host-one", onNavigateToTripDetail = vi.fn()) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
	return {
		client,
		onNavigateToTripDetail,
		...render(
			<QueryClientProvider client={client}>
				<HostDashboardOverview
					key={hostId}
					hostId={hostId}
					onNavigateToTripDetail={onNavigateToTripDetail}
				/>
			</QueryClientProvider>
		),
	};
}
describe("CTMS-378 HostDashboardOverview", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		window.history.replaceState({}, "", "/dashboard");
	});
	afterEach(() => vi.restoreAllMocks());
	it("shows loading until the server responds", () => {
		vi.mocked(hostOverviewService.get).mockReturnValue(new Promise(() => {}));
		show();
		expect(screen.getByRole("status")).toHaveTextContent(text.loading);
		expect(screen.queryByLabelText("Chỉ số vận hành")).not.toBeInTheDocument();
	});
	it("omits duplicated booking, porter, and route tables from the dashboard", async () => {
		const fixture = overviewFixture();
		fixture.bookings.data = { total: 0, items: [] };
		fixture.kpis.todaysBookings = 0;
		vi.mocked(hostOverviewService.get).mockResolvedValue(fixture);
		show();
		await screen.findByTestId("host-dashboard-overview");
		expect(screen.queryByRole("tablist", { name: "Danh sách vận hành" })).not.toBeInTheDocument();
		expect(screen.queryByRole("region", { name: text.trips })).not.toBeInTheDocument();
		expect(screen.queryByRole("region", { name: text.sos })).not.toBeInTheDocument();
		expect(screen.queryByText("Hoạt động & cảnh báo")).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: text.refresh })).not.toBeInTheDocument();
	});
	it("uses server KPIs and navigates to Host details", async () => {
		vi.mocked(hostOverviewService.get).mockResolvedValue(overviewFixture());
		const view = show();
		await screen.findByTestId("host-dashboard-overview");
		expect(within(screen.getByLabelText("Chỉ số vận hành")).getByText("7")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: /Đặt chỗ hôm nay/ }));
		expect(window.location.pathname).toBe("/host/campers");
		expect(new URLSearchParams(window.location.search).get("status")).toBe("published");
		window.history.replaceState({}, "", "/dashboard");
		fireEvent.click(screen.getByRole("button", { name: /Chuyến đi đang diễn ra/ }));
		expect(window.location.pathname).toBe("/host/campers");
		expect(new URLSearchParams(window.location.search).get("status")).toBe("ongoing");
		window.history.replaceState({}, "", "/dashboard");
		fireEvent.click(screen.getByRole("button", { name: /Tuyến của tôi/ }));
		expect(window.location.pathname).toBe("/host/trekking-routes");
		window.history.replaceState({}, "", "/dashboard");
		fireEvent.click(screen.getByRole("button", { name: /Người hỗ trợ được phân công/ }));
		expect(window.location.pathname).toBe("/host/porter");
		expect(new URLSearchParams(window.location.search).get("view")).toBe("assigned");
		expect(view.onNavigateToTripDetail).not.toHaveBeenCalled();
	});
	it("distinguishes a missing booking source from a genuine zero", async () => {
		const fixture = overviewFixture();
		fixture.bookings.availability = "unavailable";
		fixture.bookings.data = null;
		fixture.kpis.todaysBookings = null;
		vi.mocked(hostOverviewService.get).mockResolvedValue(fixture);
		show();
		await screen.findByTestId("host-dashboard-overview");
		expect(screen.getByText(text.noMetrics)).toBeInTheDocument();
		expect(within(screen.getByLabelText("Chỉ số vận hành")).getByText("—")).toBeInTheDocument();
	});
	it("renders genuine empty sections with zero KPIs", async () => {
		const fixture = overviewFixture();
		for (const section of [
			fixture.bookings,
			fixture.activeTrips,
			fixture.routes,
			fixture.porters,
			fixture.sos,
		])
			section.data = { total: 0, items: [] };
		fixture.kpis = {
			todaysBookings: 0,
			activeTrips: 0,
			routes: 0,
			assignedPorters: 0,
			unresolvedSos: 0,
		};
		vi.mocked(hostOverviewService.get).mockResolvedValue(fixture);
		show();
		await screen.findByTestId("host-dashboard-overview");
		expect(screen.queryByRole("region", { name: text.trips })).not.toBeInTheDocument();
		expect(screen.queryByRole("region", { name: text.bookings })).not.toBeInTheDocument();
		expect(screen.queryByRole("region", { name: text.porters })).not.toBeInTheDocument();
		expect(screen.queryByRole("region", { name: text.routes })).not.toBeInTheDocument();
		expect(screen.queryByRole("region", { name: text.sos })).not.toBeInTheDocument();
		expect(screen.queryByText(text.unavailable)).not.toBeInTheDocument();
	});
	it("keeps an old response identifiable without duplicate warning banners", async () => {
		const fixture = overviewFixture();
		fixture.generatedAt = new Date(Date.now() - 120_000).toISOString();
		vi.mocked(hostOverviewService.get).mockResolvedValue(fixture);
		show();
		expect(await screen.findByText("Chưa cập nhật")).toBeInTheDocument();
		expect(screen.queryByText(text.stale)).not.toBeInTheDocument();
		expect(screen.queryByText(/Cập nhật .*Asia\/Ho_Chi_Minh/)).not.toBeInTheDocument();
	});
	it("allows retry on a normal error", async () => {
		vi.mocked(hostOverviewService.get)
			.mockRejectedValueOnce(new Error("network"))
			.mockResolvedValue(overviewFixture());
		show();
		fireEvent.click(await screen.findByRole("button", { name: text.retry }));
		expect(await screen.findByTestId("host-dashboard-overview")).toBeInTheDocument();
	});
	it("removes cached values after authorization is revoked", async () => {
		vi.mocked(hostOverviewService.get)
			.mockResolvedValueOnce(overviewFixture())
			.mockRejectedValue(new HttpError("Forbidden", 403, {}));
		const view = show();
		await screen.findByTestId("host-dashboard-overview");
		await act(() =>
			view.client.invalidateQueries({ queryKey: queryKeys.hostOverview.forHost("host-one") })
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(text.restricted);
		expect(screen.queryByTestId("host-dashboard-overview")).not.toBeInTheDocument();
	});
	it("retains last authorized data with a compact status if refresh fails", async () => {
		let offline = false;
		vi.mocked(hostOverviewService.get).mockImplementation(async () => {
			if (offline) throw new Error("offline");
			return overviewFixture();
		});
		const view = show();
		await screen.findByTestId("host-dashboard-overview");
		offline = true;
		await act(() =>
			view.client.invalidateQueries({ queryKey: queryKeys.hostOverview.forHost("host-one") })
		);
		expect(await screen.findByText("Chưa cập nhật")).toBeInTheDocument();
		expect(screen.queryByText(text.stale)).not.toBeInTheDocument();
		expect(within(screen.getByLabelText("Chỉ số vận hành")).getByText("7")).toBeInTheDocument();
	});
	it("omits section pagination and isolates cache by Host identity", async () => {
		const fixture = overviewFixture();
		fixture.sos.data = { total: 6, items: fixture.sos.data?.items ?? [] };
		vi.mocked(hostOverviewService.get).mockResolvedValue(fixture);
		const view = show();
		await screen.findByTestId("host-dashboard-overview");
		expect(screen.queryByRole("button", { name: text.next })).not.toBeInTheDocument();
		await waitFor(() =>
			expect(hostOverviewService.get).toHaveBeenCalledWith(1, 5, expect.any(AbortSignal))
		);
		await screen.findByTestId("host-dashboard-overview");
		view.unmount();
		expect(
			view.client
				.getQueryCache()
				.getAll()
				.every((q) => q.queryKey[1] === "host-one")
		).toBe(true);
	});
});
