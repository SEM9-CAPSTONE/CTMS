import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { overviewFixture } from "../../../../tests/fixtures/host-overview";
import { HttpError } from "../../../core/api/httpClient";
import { OVERVIEW_TEXT as text } from "../constants";
import { hostOverviewService } from "../services/host-overview.service";
import type { HostOverview } from "../types";
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
		expect(screen.getByRole("region", { name: text.trips })).toBeInTheDocument();
		expect(screen.getByRole("region", { name: text.sos })).toBeInTheDocument();
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
		await waitFor(() =>
			expect(screen.getByRole("region", { name: text.trips })).toHaveTextContent(text.empty)
		);
		expect(screen.queryByRole("region", { name: text.bookings })).not.toBeInTheDocument();
		expect(screen.queryByRole("region", { name: text.porters })).not.toBeInTheDocument();
		expect(screen.queryByRole("region", { name: text.routes })).not.toBeInTheDocument();
		expect(screen.getByText("Hiện không có yêu cầu cứu trợ cần xử lý.")).toBeInTheDocument();
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
		show();
		fireEvent.click(await screen.findByRole("button", { name: text.refresh }));
		expect(await screen.findByRole("alert")).toHaveTextContent(text.restricted);
		expect(screen.queryByTestId("host-dashboard-overview")).not.toBeInTheDocument();
	});
	it("retains last authorized data with a compact status if refresh fails", async () => {
		let offline = false;
		vi.mocked(hostOverviewService.get).mockImplementation(async () => {
			if (offline) throw new Error("offline");
			return overviewFixture();
		});
		show();
		await screen.findByText("Chuyến Núi Chúa");
		offline = true;
		fireEvent.click(await screen.findByRole("button", { name: text.refresh }));
		expect(await screen.findByText("Chưa cập nhật")).toBeInTheDocument();
		expect(screen.queryByText(text.stale)).not.toBeInTheDocument();
		expect(
			within(screen.getByRole("region", { name: text.trips })).getByText("Chuyến Núi Chúa")
		).toBeInTheDocument();
	});
	it("requests the next backend page and isolates cache by Host identity", async () => {
		vi.mocked(hostOverviewService.get).mockImplementation(async (page): Promise<HostOverview> => {
			const fixture = overviewFixture();
			fixture.sos.data = { total: 6, items: fixture.sos.data?.items ?? [] };
			return { ...fixture, page };
		});
		const view = show();
		fireEvent.click(await screen.findByRole("button", { name: text.next }));
		await waitFor(() =>
			expect(hostOverviewService.get).toHaveBeenCalledWith(2, 5, expect.any(AbortSignal))
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
