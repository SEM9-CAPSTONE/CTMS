import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { PorterRequestCard } from "../components/PorterRequestCard";
import { tripsService } from "../services/trips.service";
import type { PorterRequest } from "../types";
import { PorterRequestsPage } from "./PorterRequestsPage";

vi.mock("../services/trips.service", () => ({
	tripsService: {
		getMyPorterRequests: vi.fn(),
		acceptPorterRequest: vi.fn(),
		declinePorterRequest: vi.fn(),
	},
}));

function fixture(overrides: Partial<PorterRequest> = {}): PorterRequest {
	return {
		id: "request",
		tripId: "trip",
		porterId: "porter",
		requestedBy: "host",
		requestedRole: "support",
		note: null,
		status: "pending",
		expiresAt: new Date(Date.now() + 60_000).toISOString(),
		respondedAt: null,
		createdAt: "2026-01-01T00:00:00Z",
		updatedAt: "2026-01-01T00:00:00Z",
		...overrides,
	};
}

describe("Porter Request response flow", () => {
	let client: QueryClient;
	beforeEach(() => {
		vi.resetAllMocks();
		client = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
		});
		vi.mocked(tripsService.getMyPorterRequests).mockResolvedValue([fixture()]);
	});
	afterEach(() => {
		cleanup();
		client.clear();
		vi.useRealTimers();
	});
	function showPage() {
		return render(
			<QueryClientProvider client={client}>
				<PorterRequestsPage />
			</QueryClientProvider>
		);
	}

	it("renders loading and an empty response list", async () => {
		vi.mocked(tripsService.getMyPorterRequests).mockResolvedValue([]);
		showPage();
		expect(screen.getByText("Đang tải yêu cầu Porter...")).toBeInTheDocument();
		expect(await screen.findByText("Chưa có yêu cầu tham gia Trip.")).toBeInTheDocument();
	});

	it.each(["accept", "decline"] as const)(
		"confirms %s and uses the server terminal state",
		async (action) => {
			const result = fixture({ status: action === "accept" ? "accepted" : "declined" });
			const method =
				action === "accept" ? tripsService.acceptPorterRequest : tripsService.declinePorterRequest;
			vi.mocked(method).mockImplementation(async () => {
				vi.mocked(tripsService.getMyPorterRequests).mockResolvedValue([result]);
				return result;
			});
			showPage();
			fireEvent.click(
				await screen.findByRole("button", { name: action === "accept" ? "Chấp nhận" : "Từ chối" })
			);
			expect(method).not.toHaveBeenCalled();
			fireEvent.click(screen.getByTestId("confirm-modal-submit"));
			await waitFor(() => expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument());
			expect(method).toHaveBeenCalledExactlyOnceWith("request");
			expect(
				screen.getByText(action === "accept" ? "Đã chấp nhận" : "Đã từ chối")
			).toBeInTheDocument();
			expect(screen.queryByRole("button", { name: "Chấp nhận" })).not.toBeInTheDocument();
		}
	);

	it("cancels confirmation without submitting", async () => {
		showPage();
		fireEvent.click(await screen.findByRole("button", { name: "Chấp nhận" }));
		fireEvent.click(screen.getByTestId("confirm-modal-cancel"));
		expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument();
		expect(tripsService.acceptPorterRequest).not.toHaveBeenCalled();
	});

	it("blocks duplicate confirmation and waits for the server before accepting", async () => {
		let resolve!: (value: PorterRequest) => void;
		vi.mocked(tripsService.acceptPorterRequest).mockReturnValue(
			new Promise((done) => {
				resolve = done;
			})
		);
		showPage();
		fireEvent.click(await screen.findByRole("button", { name: "Chấp nhận" }));
		const submit = screen.getByTestId("confirm-modal-submit");
		fireEvent.click(submit);
		fireEvent.click(submit);
		await waitFor(() => expect(tripsService.acceptPorterRequest).toHaveBeenCalledTimes(1));
		expect(screen.getByText("Đang chờ phản hồi")).toBeInTheDocument();
		expect(screen.getByTestId("confirm-modal-cancel")).toBeDisabled();
		const accepted = fixture({ status: "accepted" });
		vi.mocked(tripsService.getMyPorterRequests).mockResolvedValue([accepted]);
		await act(async () => {
			resolve(accepted);
		});
		await waitFor(() => expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument());
	});

	it("shows a network failure inside the modal and permits a safe retry", async () => {
		vi.mocked(tripsService.acceptPorterRequest).mockRejectedValueOnce(new Error("offline"));
		showPage();
		fireEvent.click(await screen.findByRole("button", { name: "Chấp nhận" }));
		fireEvent.click(screen.getByTestId("confirm-modal-submit"));
		expect(await within(screen.getByTestId("confirm-modal")).findByRole("alert")).toHaveTextContent(
			"Vui lòng thử lại"
		);
		await waitFor(() => expect(screen.getByTestId("confirm-modal-submit")).toBeEnabled());
		expect(screen.getByText("Đang chờ phản hồi")).toBeInTheDocument();
		const accepted = fixture({ status: "accepted" });
		vi.mocked(tripsService.acceptPorterRequest).mockResolvedValue(accepted);
		vi.mocked(tripsService.getMyPorterRequests).mockResolvedValue([accepted]);
		fireEvent.click(screen.getByTestId("confirm-modal-submit"));
		await waitFor(() => expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument());
		expect(tripsService.acceptPorterRequest).toHaveBeenCalledTimes(2);
	});

	it("reconciles a cancelled request after a conflict and removes stale actions", async () => {
		vi.mocked(tripsService.acceptPorterRequest).mockImplementation(async () => {
			vi.mocked(tripsService.getMyPorterRequests).mockResolvedValue([
				fixture({ status: "cancelled" }),
			]);
			throw new HttpError("conflict", 409, null);
		});
		showPage();
		fireEvent.click(await screen.findByRole("button", { name: "Chấp nhận" }));
		fireEvent.click(screen.getByTestId("confirm-modal-submit"));
		expect(await screen.findByText("Đã hủy")).toBeInTheDocument();
		await waitFor(() => expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument());
		expect(screen.getByRole("alert")).toHaveTextContent("Yêu cầu không còn hợp lệ");
		expect(screen.queryByRole("button", { name: "Chấp nhận" })).not.toBeInTheDocument();
	});

	it.each([
		[401, "Phiên đăng nhập đã hết hạn"],
		[403, "Bạn không có quyền"],
		[404, "Không tìm thấy"],
	])("explains HTTP %s response failures", async (status, message) => {
		vi.mocked(tripsService.acceptPorterRequest).mockRejectedValue(
			new HttpError("error", Number(status), null)
		);
		showPage();
		fireEvent.click(await screen.findByRole("button", { name: "Chấp nhận" }));
		fireEvent.click(screen.getByTestId("confirm-modal-submit"));
		expect(await screen.findByRole("alert")).toHaveTextContent(String(message));
	});

	it.each(["accepted", "declined", "cancelled", "expired"] as const)(
		"renders %s as read only",
		async (status) => {
			vi.mocked(tripsService.getMyPorterRequests).mockResolvedValue([fixture({ status })]);
			showPage();
			await screen.findByRole("listitem");
			expect(screen.queryByRole("button", { name: "Chấp nhận" })).not.toBeInTheDocument();
			expect(screen.queryByRole("button", { name: "Từ chối" })).not.toBeInTheDocument();
		}
	);

	it("disables response actions at the exact deadline without changing server status", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2035-01-01T00:00:00Z"));
		render(
			<PorterRequestCard request={fixture({ expiresAt: "2035-01-01T00:00:01Z" })} mode="porter" />
		);
		expect(screen.getByRole("button", { name: "Chấp nhận" })).toBeEnabled();
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(screen.getByRole("button", { name: "Chấp nhận" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Từ chối" })).toBeDisabled();
		expect(screen.getByText("Đang chờ phản hồi")).toBeInTheDocument();
		expect(screen.getByText(/Đã quá hạn phản hồi/)).toBeInTheDocument();
	});
});
