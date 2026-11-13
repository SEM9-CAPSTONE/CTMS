import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api/httpClient";
import { packagePolicyService } from "../services/package-policy.service";
import { DepartureBlockStatus } from "./DepartureBlockStatus";
import { DepartureInbox } from "./DepartureInbox";

vi.mock("../services/package-policy.service", () => ({
	packagePolicyService: { list: vi.fn(), read: vi.fn(), status: vi.fn() },
}));
const notice = {
	id: "notice-1",
	tripId: "trip-1",
	reasonCode: "SOURCE_FRESHNESS_UNAVAILABLE",
	createdAt: "2026-11-12T00:00:00Z",
	readAt: null,
	active: true,
	tripTitle: "Chuyến Sơn Trà",
	startsAt: "2026-11-13T00:00:00Z",
};
function mount(actor = "owner", withStatus = false) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>
			{withStatus && <DepartureBlockStatus actor={actor} trip="trip-1" />}
			<DepartureInbox key={actor} actor={actor} />
		</QueryClientProvider>
	);
}
describe("Host departure inbox", () => {
	beforeEach(() => vi.resetAllMocks());
	it("shows unread badge, links to trip and marks only the selected notice read", async () => {
		vi.mocked(packagePolicyService.list).mockResolvedValue([notice]);
		vi.mocked(packagePolicyService.read).mockResolvedValue({});
		mount();
		fireEvent.click(screen.getByRole("button", { name: /Thông báo khởi hành/ }));
		expect(await screen.findByText("Chưa sẵn sàng khởi hành")).toBeVisible();
		expect(screen.getByRole("link")).toHaveAttribute("href", "/trips/trip-1");
		fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc" }));
		await waitFor(() =>
			expect(packagePolicyService.read).toHaveBeenCalledWith("notice-1", expect.anything())
		);
	});
	it("shows permission failure without leaking a previous owner's notices", async () => {
		vi.mocked(packagePolicyService.list).mockRejectedValue(new HttpError("Forbidden", 403, {}));
		mount("different-owner");
		fireEvent.click(screen.getByRole("button", { name: /Thông báo khởi hành/ }));
		expect(await screen.findByRole("alert")).toHaveTextContent("Bạn không có quyền");
		expect(screen.queryByRole("link")).not.toBeInTheDocument();
		expect(packagePolicyService.read).not.toHaveBeenCalled();
	});
	it("reading the active notice leaves both inbox and authoritative Trip block visible", async () => {
		vi.mocked(packagePolicyService.list).mockResolvedValue([notice]);
		vi.mocked(packagePolicyService.status).mockResolvedValue({
			blocked: true,
			reasonCode: notice.reasonCode,
		});
		vi.mocked(packagePolicyService.read).mockImplementation(async () => {
			vi.mocked(packagePolicyService.list).mockResolvedValue([
				{ ...notice, readAt: "2026-11-12T01:00:00Z" },
			]);
			return {};
		});
		mount("owner", true);
		fireEvent.click(screen.getByRole("button", { name: /Thông báo khởi hành/ }));
		fireEvent.click(await screen.findByRole("button", { name: "Đánh dấu đã đọc" }));
		await waitFor(() =>
			expect(screen.queryByRole("button", { name: "Đánh dấu đã đọc" })).not.toBeInTheDocument()
		);
		expect(screen.getByTestId("departure-block-status")).toHaveTextContent(
			"Chưa sẵn sàng khởi hành"
		);
		expect(screen.getAllByText("Chưa sẵn sàng khởi hành")).toHaveLength(2);
		expect(screen.getByText("Đã đọc", { exact: true })).toBeVisible();
	});
	it("historical notices explicitly state that the status changed", async () => {
		vi.mocked(packagePolicyService.list).mockResolvedValue([{ ...notice, active: false }]);
		mount();
		fireEvent.click(screen.getByRole("button", { name: /Thông báo khởi hành/ }));
		expect(await screen.findByText("Thông báo trước đây · Đã thay đổi")).toBeVisible();
	});
	it("resolved cancelled notices do not contribute to unread badge", async () => {
		vi.mocked(packagePolicyService.list).mockResolvedValue([
			{ ...notice, active: false, resolved: true },
		]);
		mount();
		fireEvent.click(screen.getByRole("button", { name: /Thông báo khởi hành/ }));
		expect(await screen.findByText("Đã xử lý · Chuyến đã kết thúc")).toBeVisible();
		expect(screen.getByLabelText("Chưa đọc")).toHaveTextContent("(0)");
		expect(screen.getByText("Chuyến Sơn Trà")).toBeVisible();
		expect(screen.getByText(/Khởi hành:/)).toHaveTextContent("13/11/2026 07:00");
		expect(screen.queryByRole("button", { name: "Đánh dấu đã đọc" })).not.toBeInTheDocument();
	});
	it.each(["cancelled", "completed"] as const)(
		"%s Trip hides a cached blocking response",
		async (tripStatus) => {
			vi.mocked(packagePolicyService.status).mockResolvedValue({
				blocked: true,
				reasonCode: notice.reasonCode,
			});
			const client = new QueryClient();
			render(
				<QueryClientProvider client={client}>
					<DepartureBlockStatus actor="owner" trip="trip-1" tripStatus={tripStatus} />
				</QueryClientProvider>
			);
			expect(screen.queryByTestId("departure-block-status")).not.toBeInTheDocument();
		}
	);
});
