import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { overviewFixture } from "../../../../tests/fixtures/host-overview";
import { HttpError } from "../../../core/api/httpClient";
import { httpClient } from "../../../core/api/httpClient";
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
	it("opens an available list when today's Booking source is genuinely empty", async () => {
		const fixture = overviewFixture();
		fixture.bookings.data = { total: 0, items: [] };
		fixture.kpis.todaysBookings = 0;
		vi.mocked(hostOverviewService.get).mockResolvedValue(fixture);
		show();
		expect(await screen.findByRole("tab", { name: /^Tuyến/ })).toHaveAttribute(
			"aria-selected",
			"true"
		);
		expect(screen.getByRole("region", { name: text.routes })).toBeInTheDocument();
		fireEvent.click(screen.getByRole("tab", { name: /^Booking hôm nay/ }));
		expect(screen.getByRole("region", { name: text.bookings })).toHaveTextContent(text.empty);
	});
	it("resolves missing weather route labels through the authorized API", async () => {
		const fixture = overviewFixture();
		const weather = fixture.weather.data?.items[0];
		if (!weather) throw new Error("Missing weather fixture");
		weather.routeId = "route-two";
		vi.mocked(hostOverviewService.get).mockResolvedValue(fixture);
		const get = vi.spyOn(httpClient, "get").mockResolvedValue({ name: "Tuyến có tên từ máy chủ" });
		show();
		expect(await screen.findByText("Tuyến có tên từ máy chủ")).toBeInTheDocument();
		expect(get).toHaveBeenCalledWith(expect.stringContaining("route-two"));
	});
	it("keeps authoritative risk visible if optional route label lookup is denied", async () => {
		const fixture = overviewFixture();
		const weather = fixture.weather.data?.items[0];
		if (!weather) throw new Error("Missing weather fixture");
		weather.routeId = "route-two";
		vi.mocked(hostOverviewService.get).mockResolvedValue(fixture);
		vi.spyOn(httpClient, "get").mockRejectedValue(new HttpError("Forbidden", 403, {}));
		show();
		expect(await screen.findByText("Tuyến #route-tw")).toBeInTheDocument();
		expect(screen.getByText("Rủi ro cao")).toBeInTheDocument();
		expect(screen.queryByText(text.restricted)).not.toBeInTheDocument();
	});
	it("uses full backend KPIs rather than visible-page counts and navigates only to supported Trip details", async () => {
		vi.mocked(hostOverviewService.get).mockResolvedValue(overviewFixture());
		const view = show();
		await screen.findByTestId("host-dashboard-overview");
		expect(within(screen.getByLabelText("Chỉ số vận hành")).getByText("7")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("tab", { name: /^Porter/ }));
		expect(screen.getByText("Chờ xác nhận lại")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("tab", { name: /^Booking hôm nay/ }));
		const bookings = screen.getByRole("region", { name: text.bookings });
		fireEvent.click(within(bookings).getByRole("button", { name: text.tripDetail }));
		expect(view.onNavigateToTripDetail).toHaveBeenCalledWith("trip-one");
		fireEvent.click(screen.getByRole("tab", { name: /^Tuyến/ }));
		fireEvent.click(
			within(screen.getByRole("region", { name: text.routes })).getByRole("button", {
				name: text.routeDetail,
			})
		);
		expect(window.location.pathname).toBe("/host/trekking-routes/route-one");
	});
	it("distinguishes a missing source and missing risk from zero/low risk", async () => {
		const fixture = overviewFixture();
		fixture.bookings.availability = "unavailable";
		fixture.bookings.data = null;
		fixture.kpis.todaysBookings = null;
		const weather = fixture.weather.data?.items[0];
		if (!weather) throw new Error("Missing weather fixture");
		Object.assign(weather, {
			riskLevel: null,
			state: "unavailable",
			assessedAt: null,
			observedAt: null,
		});
		vi.mocked(hostOverviewService.get).mockResolvedValue(fixture);
		show();
		await screen.findByTestId("host-dashboard-overview");
		expect(screen.getByText(text.unavailable)).toBeInTheDocument();
		expect(screen.getByText(text.weatherUnavailable)).toBeInTheDocument();
		expect(screen.queryByText("Rủi ro thấp")).not.toBeInTheDocument();
	});
	it("renders genuine empty sections with zero KPIs", async () => {
		const fixture = overviewFixture();
		for (const section of [
			fixture.bookings,
			fixture.activeTrips,
			fixture.routes,
			fixture.porters,
			fixture.sos,
			fixture.weather,
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
		expect(screen.getAllByText(text.empty)).toHaveLength(3);
		fireEvent.click(screen.getByRole("tab", { name: /^Porter/ }));
		expect(screen.getByRole("region", { name: text.porters })).toHaveTextContent(text.empty);
		fireEvent.keyDown(screen.getByRole("tab", { name: /^Porter/ }), { key: "ArrowRight" });
		expect(screen.getByRole("tab", { name: /^Tuyến/ })).toHaveAttribute("aria-selected", "true");
		expect(screen.getByRole("region", { name: text.routes })).toHaveTextContent(text.empty);
		expect(screen.getByText("Không có SOS đang chờ xử lý.")).toBeInTheDocument();
		expect(screen.queryByText(text.unavailable)).not.toBeInTheDocument();
	});
	it("marks old response and persisted weather stale without recalculating risk", async () => {
		const fixture = overviewFixture();
		fixture.generatedAt = new Date(Date.now() - 120_000).toISOString();
		const weather = fixture.weather.data?.items[0];
		if (!weather) throw new Error("Missing weather fixture");
		weather.state = "stale";
		vi.mocked(hostOverviewService.get).mockResolvedValue(fixture);
		show();
		expect(await screen.findByText(text.stale)).toBeInTheDocument();
		expect(screen.getByText(text.oldRisk)).toBeInTheDocument();
		expect(screen.getByText("Đánh giá đã lưu: Rủi ro cao")).toBeInTheDocument();
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
	it("retains last authorized data with an explicit stale warning if refresh fails", async () => {
		vi.mocked(hostOverviewService.get)
			.mockResolvedValueOnce(overviewFixture())
			.mockRejectedValue(new Error("offline"));
		show();
		fireEvent.click(await screen.findByRole("button", { name: text.refresh }));
		expect(await screen.findByText(text.stale)).toBeInTheDocument();
		expect(
			within(screen.getByRole("region", { name: text.trips })).getByText("Chuyến Núi Chúa")
		).toBeInTheDocument();
	});
	it("requests the next backend page and isolates cache by Host identity", async () => {
		vi.mocked(hostOverviewService.get).mockImplementation(
			async (page): Promise<HostOverview> => ({ ...overviewFixture(), page })
		);
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
	it("keeps independent pages per inventory tab without replacing Trip, weather or KPI data", async () => {
		vi.mocked(hostOverviewService.get).mockImplementation(async (page) => {
			const fixture = overviewFixture();
			fixture.page = page;
			fixture.routes.data = {
				total: 11,
				items: [
					{
						id: "route-one",
						name: `Tuyến trang ${page}`,
						status: "active",
						updatedAt: fixture.generatedAt,
					},
				],
			};
			return fixture;
		});
		show();
		fireEvent.click(await screen.findByRole("tab", { name: /^Tuyến/ }));
		fireEvent.click(
			within(screen.getByRole("navigation", { name: "Phân trang Tuyến" })).getByRole("button", {
				name: "Sau",
			})
		);
		await screen.findByText("Tuyến trang 2");
		expect(within(screen.getByLabelText("Chỉ số vận hành")).getByText("7")).toBeInTheDocument();
		expect(
			within(screen.getByRole("region", { name: text.trips })).getByText("Chuyến Núi Chúa")
		).toBeInTheDocument();
		expect(screen.getByText("Rủi ro cao")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("tab", { name: /^Booking hôm nay/ }));
		expect(
			screen.getByRole("navigation", { name: "Phân trang Booking hôm nay" })
		).toHaveTextContent("1 / 2");
		fireEvent.click(screen.getByRole("tab", { name: /^Tuyến/ }));
		expect(screen.getByRole("navigation", { name: "Phân trang Tuyến" })).toHaveTextContent("2 / 3");
		expect(screen.getByText("Tuyến trang 2")).toBeInTheDocument();
	});
	it("supports retry and previous-page navigation when loading another inventory page fails", async () => {
		let failed = true;
		vi.mocked(hostOverviewService.get).mockImplementation(async (page) => {
			if (page === 2 && failed) throw new Error("offline");
			return { ...overviewFixture(), page };
		});
		show();
		fireEvent.click(await screen.findByRole("button", { name: "Sau" }));
		await screen.findByText("Không tải được trang danh sách.");
		expect(screen.getByRole("region", { name: text.trips })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Trước" })).toBeEnabled();
		failed = false;
		fireEvent.click(screen.getByRole("button", { name: text.retry }));
		await screen.findByRole("region", { name: text.bookings });
		expect(
			screen.getByRole("navigation", { name: "Phân trang Booking hôm nay" })
		).toHaveTextContent("2 / 2");
	});
	it("hides all cached dashboard values when authorization is revoked on an inventory page", async () => {
		vi.mocked(hostOverviewService.get).mockImplementation(async (page) => {
			if (page === 2) throw new HttpError("Forbidden", 403, {});
			return overviewFixture();
		});
		show();
		fireEvent.click(await screen.findByRole("button", { name: "Sau" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(text.restricted);
		await waitFor(() =>
			expect(screen.queryByTestId("host-dashboard-overview")).not.toBeInTheDocument()
		);
	});
});
